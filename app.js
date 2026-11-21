"use strict";
/* Gravo Finance — 마통 관리
   저장: Firebase Firestore (동기화 코드별 문서 하나) + 이 기기 localStorage 사본
   인식: /api/recognize (Vercel 서버리스 → Anthropic API) */

const FB = { apiKey: 'AIzaSyAN7s01gb9AsmeMVdgWGY6pllX9cm1SLJ0', projectId: 'endoapp-cc066' };
const COLL = 'gravo_finance_v2';
const LS = { code: 'gf_mt_code', pass: 'gf_mt_pass', key: 'gf_mt_userkey', cache: 'gf_mt_cache', auto: 'gf_mt_autosave', push: 'gf_mt_push' };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } };

const S = {
  data: { ref: {}, tx: {}, captures: {} }, fb: null, docRef: null, code: lsGet(LS.code, 'gravo2026'), sync: 'off', ready: false,
  files: {}, edits: {}, ctl: {}, editId: null, running: new Set(), thumbs: {}, tab: 'home', txf: 'all', armed: null, view: null, surplus: null, qsig: '', calYm: null, calDay: null, cardEdit: null, ensured: false, memoId: null, txq: '',
};
const TABS = ['home', 'tx', 'cal', 'cards', 'tax', 'plan'];
const CARDS = ['농협', '롯데', '신한', '삼성', '현대', '국민', '기타'];
const CARD_CODE = { '농협': 'nh', '롯데': 'lotte', '신한': 'shinhan', '삼성': 'samsung', '현대': 'hyundai', '국민': 'kb', '기타': 'etc' };
const ACCT_CODE = { '우리': 'woori', '농협': 'nh', '신한': 'shinhan', '기타': 'etc' };
const ACCT_LABEL = { '우리': '우리 통장', '농협': '농협 통장', '신한': '신한 FNA 통장', '기타': '기타 통장' };
const ACCTS = ['우리', '농협', '신한', '기타'];
const acctLabel = (a) => ACCT_LABEL[a] || ((a || '') + ' 통장');
const BANK_CATS = ['급여', '카드대금', '본인이체', '투자·증권', '적금·저축', '대출·이자', '세금', '기타'];
const CARD_CATS = ['외식·카페', '마트·생활', '쇼핑', '교통·차량', '의료', '통신·구독', '보험', '세금', '기타'];
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ymOf = (s) => String(s || '').slice(0, 7);
const monthsBack = (n) => { const d = new Date(); return Array.from({ length: n }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return x.getFullYear() + '-' + pad(x.getMonth() + 1); }); };
const toNum = (v) => { if (v == null || v === '') return NaN; if (typeof v === 'number') return v; const s = String(v).replace(/[−–—]/g, '-').replace(/[^\d.\-+]/g, ''); return s ? Number(s) : NaN; };
const won = (n) => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
const man = (n, dec = 0) => { const v = n / 1e4; const s = Math.abs(v).toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return (v < 0 && Math.abs(v) >= (dec ? 0.05 : 0.5) ? '-' : '') + s; };
const manv = (v, dec = 0) => man(v * 1e4, dec);
const signed = (n, dec = 0) => (n > 0 ? '+' : '') + man(n, dec);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v; else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3400); }
function notice(msg) { const n = $('notice'); n.textContent = msg || ''; n.hidden = !msg; }

/* ================= storage ================= */
function cacheSave() { try { localStorage.setItem(LS.cache + ':' + S.code, JSON.stringify(S.data)); } catch (e) { } }
function cacheLoad() { try { const raw = localStorage.getItem(LS.cache + ':' + S.code); if (raw) S.data = Object.assign({ ref: {}, tx: {}, captures: {} }, JSON.parse(raw)); } catch (e) { } }
function setSync(st, text) {
  S.sync = st; const d = $('syncDot'); d.className = 'sync ' + ({ ok: 'ok', error: 'err', connecting: 'wait' }[st] || '');
  $('syncText').textContent = text || ({ ok: '동기화 연결됨 · 다른 기기에서 같은 코드를 쓰면 같은 데이터가 보입니다.', error: '동기화 연결 실패 · 이 기기에만 저장 중입니다.', connecting: '동기화 연결 중…', off: '이 기기에만 저장 중입니다.' }[st]);
}
const FV = () => firebase.firestore.FieldValue;
const FP = (...p) => new firebase.firestore.FieldPath(...p);
async function remote(fn) { if (!S.docRef) return; try { await fn(S.docRef); } catch (e) { console.warn(e); setSync('error'); toast('클라우드에 저장하지 못했습니다. 이 기기에는 저장되었습니다.'); } }
const store = {
  async setTx(key, t) { S.data.tx[key] = t; cacheSave(); render(); await remote((d) => d.set({ tx: { [key]: t } }, { merge: true })); },
  async delTx(key) { delete S.data.tx[key]; cacheSave(); render(); await remote((d) => d.update(FP('tx', key), FV().delete())); },
  async setCap(id, patch) { S.data.captures[id] = Object.assign({}, S.data.captures[id] || {}, patch); cacheSave(); render(); await remote((d) => d.set({ captures: { [id]: patch } }, { merge: true })); },
  async replaceCap(id, full) { S.data.captures[id] = full; cacheSave(); render(); await remote((d) => d.update(FP('captures', id), full)); },
  async delCap(id) { delete S.data.captures[id]; cacheSave(); render(); await remote((d) => d.update(FP('captures', id), FV().delete())); if (S.fb) S.fb.collection(COLL).doc(S.code + '__img__' + id).delete().catch(() => { }); try { localStorage.removeItem('gf_mt_img:' + id); } catch (e) { } },
  async setRef(name, value) { S.data.ref[name] = value; cacheSave(); render(); await remote((d) => d.update(FP('ref', name), value)); },
  async saveImg(id, dataUrl) {
    S.thumbs[id] = dataUrl;
    if (S.fb) { try { await S.fb.collection(COLL).doc(S.code + '__img__' + id).set({ img: dataUrl, at: Date.now() }); return; } catch (e) { console.warn(e); } }
    try { localStorage.setItem('gf_mt_img:' + id, dataUrl); } catch (e) { }
  },
  async getImg(id) {
    if (S.thumbs[id]) return S.thumbs[id];
    try { const l = localStorage.getItem('gf_mt_img:' + id); if (l) return (S.thumbs[id] = l); } catch (e) { }
    if (S.fb) { try { const s = await S.fb.collection(COLL).doc(S.code + '__img__' + id).get(); if (s.exists) return (S.thumbs[id] = s.data().img); } catch (e) { } }
    return null;
  },
};
function seedData() {
  const sd = window.GF_SEED || { ref: {}, tx: [] }; const tx = {};
  sd.tx.forEach((t, i) => { const r = Object.assign({ time: '', balance: null, account: null, card: null, seq: 0, source: 'seed', savedAt: new Date().toISOString() }, t); tx[txKey(r)] = r; });
  return { ref: JSON.parse(JSON.stringify(sd.ref)), tx, captures: {} };
}
async function migrateOld(db) {
  // 기존 앱(gravo_finance_v2/<코드>)에 남은 카드 자동결제·주담대 값을 가져옵니다.
  try {
    const s = await db.collection(COLL).doc(S.code).get(); if (!s.exists) return {};
    const old = JSON.parse(s.data()._data || '{}'); const out = {};
    if (Array.isArray(old.auto_pays) && old.auto_pays.length) out.autopays = old.auto_pays.map((a) => ({ card: normCard(a.cardCo) || '기타', name: a.service, amount: +a.amount || 0, day: +a.day || 0 }));
    if (old.mortgage && old.mortgage.balance) out.mortgage = Object.assign({ source: '기존 앱 기록' }, old.mortgage);
    return out;
  } catch (e) { return {}; }
}
// 이 기기가 가진 데이터를 현재 동기화 코드의 클라우드 문서로 올립니다(덮어쓰기). 기준은 "이 기기에 보이는 데이터".
async function copyImgs(ids, srcCode) {
  for (const id of ids) {
    try {
      let img = null; try { img = localStorage.getItem('gf_mt_img:' + id); } catch (e) { }
      if (!img && S.thumbs[id]) img = S.thumbs[id];
      if (!img && srcCode !== S.code) { const sn = await S.fb.collection(COLL).doc(srcCode + '__img__' + id).get(); if (sn.exists) img = sn.data().img; }
      if (img) await S.fb.collection(COLL).doc(S.code + '__img__' + id).set({ img, at: Date.now() });
    } catch (e) { console.warn(e); }
  }
}
async function pushToCloud(srcCode) {
  let src = null;
  try { const raw = localStorage.getItem(LS.cache + ':' + srcCode); if (raw) src = JSON.parse(raw); } catch (e) { }
  if (!src && S.fb && srcCode !== S.code) { try { const sn = await S.fb.collection(COLL).doc(srcCode + '__mt').get(); if (sn.exists) src = sn.data(); } catch (e) { } }
  const n = src ? Object.keys(src.tx || {}).length : 0;
  if (!n) { lsSet(LS.push, ''); toast('이 기기에는 올릴 데이터가 없습니다.'); return false; }
  const data = { ref: src.ref || {}, tx: src.tx || {}, captures: src.captures || {} };
  try { await S.docRef.set(Object.assign({}, data, { createdAt: Date.now(), pushedAt: Date.now() })); }
  catch (e) { console.warn(e); setSync('error', '클라우드에 올리지 못했습니다 (' + (e.code || e.message) + ').'); toast('클라우드에 올리지 못했습니다.'); return false; }
  await copyImgs(Object.keys(data.captures), srcCode);
  lsSet(LS.push, ''); S.data = data; S.ready = true; cacheSave(); render();
  toast('이 기기 데이터를 올렸습니다 · 거래 ' + n + '건'); return true;
}
async function connect() {
  cacheLoad(); S.ready = Object.keys(S.data.ref || {}).length > 0; render();
  if (typeof firebase === 'undefined') { setSync('off', '동기화 서비스를 불러오지 못했습니다. 이 기기에만 저장 중입니다.'); if (!S.ready) { S.data = seedData(); cacheSave(); S.ready = true; render(); } ensureRef(); return; }
  setSync('connecting');
  try {
    let app; try { app = firebase.app('gravo-mt'); } catch (e) { app = firebase.initializeApp({ apiKey: FB.apiKey, projectId: FB.projectId, authDomain: FB.projectId + '.firebaseapp.com' }, 'gravo-mt'); }
    S.fb = firebase.firestore(app);
    S.docRef = S.fb.collection(COLL).doc(S.code + '__mt');
    const pushSrc = lsGet(LS.push, ''); if (pushSrc) await pushToCloud(pushSrc);
    const snap = await S.docRef.get();
    if (!snap.exists) {
      const base = S.ready ? S.data : seedData();
      const mig = await migrateOld(S.fb); Object.assign(base.ref, mig);
      await S.docRef.set(Object.assign({}, base, { createdAt: Date.now() }));
      S.data = base; S.ready = true; cacheSave(); render();
    }
    S.docRef.onSnapshot((d) => {
      if (!d.exists) return; const v = d.data();
      S.data = { ref: v.ref || {}, tx: v.tx || {}, captures: v.captures || {} }; S.ready = true; cacheSave(); setSync('ok'); render(); ensureRef();
    }, (err) => { console.warn(err); setSync('error'); });
  } catch (e) {
    console.warn(e); setSync('error', '동기화 연결 실패 (' + (e.code || e.message) + '). 이 기기에만 저장 중입니다.');
    if (!S.ready) { S.data = seedData(); cacheSave(); S.ready = true; render(); }
    ensureRef();
  }
}

/* ================= keys & reference ================= */
const hash = (s) => { let x = 5381; for (const c of String(s)) x = ((x * 33) ^ c.codePointAt(0)) >>> 0; return x.toString(36); };
function txKey(r, n) {
  const d = String(r.date).replace(/-/g, ''); const t = String(r.time || '').replace(':', '') || 'x';
  const a = (r.amount < 0 ? 'm' : 'p') + Math.abs(Math.round(r.amount)); const sfx = n > 0 ? '-' + n : '';
  if (r.type === 'card') return ['c', CARD_CODE[r.card] || 'etc', d, t, a, hash(r.desc || '')].join('-') + sfx;
  const b = r.balance == null ? 'x' : (r.balance < 0 ? 'm' : 'p') + Math.abs(Math.round(r.balance));
  return ['b', ACCT_CODE[r.account] || 'etc', d, t, a, b].join('-') + sfx;
}
// 같은 지문의 거래가 이미 있으면 -1, -2 … 를 붙여 덮어쓰지 않게 합니다 (같은 날 같은 금액 2건 등)
function uniqueKey(t, taken) { let n = 0, k = txKey(t, 0); while (taken(k) && n < 50) { n++; k = txKey(t, n); } return k; }
const normDesc = (s) => String(s || '').toLowerCase().replace(/[\s\-_.·,()（）\[\]/]/g, '');
const isSummary = (t) => !!t.summary || /(이용|월)\s*합계/.test(t.desc || '');
function descSim(a, b) {
  a = normDesc(a); b = normDesc(b); if (a === b) return 1; if (!a || !b) return 0; if (a.includes(b) || b.includes(a)) return 0.9;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let hit = 0, na = 0, nb = 0; A.forEach((v, k) => { na += v; hit += Math.min(v, B.get(k) || 0); }); B.forEach((v) => { nb += v; });
  return na + nb ? (2 * hit) / (na + nb) : 0;
}
const timeCompat = (a, b) => !a || !b || a === b;
const cfg = () => Object.assign({ od_limit_man: 15000, rate: 0.052, salary_man: 1400, surplus_man: 300, steps: [3500, 2000, 1000], nh3m_goal_man: 100 }, S.data.ref.config || {});
const refList = (k) => (Array.isArray(S.data.ref[k]) ? S.data.ref[k] : []);
const txs = () => Object.entries(S.data.tx || {}).map(([id, t]) => Object.assign({ id }, t));
const caps = () => Object.entries(S.data.captures || {}).map(([id, c]) => Object.assign({ id }, c));

/* ================= derived numbers ================= */
const txSort = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time || '') < String(b.time || '') ? -1 : String(a.time || '') > String(b.time || '') ? 1 : (a.seq || 0) - (b.seq || 0));
function series() {
  const m = new Map();
  refList('history').forEach((r) => { if (r.date && Number.isFinite(+r.balance)) m.set(r.date, { date: r.date, v: +r.balance, src: '분석' }); });
  txs().filter((t) => t.type === 'bank' && t.account === '우리' && Number.isFinite(t.balance)).sort(txSort).forEach((t) => m.set(t.date, { date: t.date, v: t.balance, src: '캡처·기록' }));
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
function simulate(debtMan, sMan, rate) { let b = debtMan, m = 0; const path = []; while (b > 0 && m < 120) { b = b * (1 + rate / 12) - sMan; m++; path.push(Math.max(0, b)); } return { months: m, path }; }
const addMonths = (ds, n) => { const d = new Date(ds + 'T00:00:00'); const x = new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), 28)); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
// 월 합계 행은 같은 카드·같은 달에 개별 내역이 있으면 집계에서 뺍니다 (이중 집계 방지)
function cardTxs() {
  const all = txs().filter((t) => t.type === 'card'); const detail = new Set(all.filter((t) => !isSummary(t)).map((t) => t.card + '|' + ymOf(t.date)));
  return all.filter((t) => !isSummary(t) || !detail.has(t.card + '|' + ymOf(t.date)));
}
function cardUsed(members, months, ids) { return cardTxs().filter((t) => members.includes(t.card) && months.includes(ymOf(t.date)) && (!ids || ids.includes(cardIdOf(t)))).reduce((a, t) => a + (+t.amount || 0), 0); }

/* ================= render: top + KPIs ================= */
/* ---- 카드 상품(같은 카드사의 여러 카드) ----
   거래의 card는 카드사, cardId는 ref.cards의 항목 id입니다. cardId가 없는 옛 거래는 카드사의 대표 카드로(세금 분류는 세금 전용 카드로) 봅니다. */
const CARD_KW = { 'lotte-tax': 'SKY|스카이|세금', lotte: 'KT|DC ?PLUS', 'samsung-mile': 'MILEAGE|마일리지|스카이', samsung: 'THE|PLATINUM|플래티넘', 'hyundai-kal': '대한항공|070|KAL', hyundai: '코스트코|COSTCO|리워드' };
const cardsOf = (issuer) => refList('cards').filter((c) => c.card === issuer);
function kwCardId(issuer, text) {
  const t = String(text || ''); if (!t) return '';
  const list = cardsOf(issuer);
  for (const id of Object.keys(CARD_KW)) { if (list.some((c) => c.id === id) && new RegExp(CARD_KW[id], 'i').test(t)) return id; }
  return '';
}
function defaultCardId(issuer, category) {
  const l = cardsOf(issuer); if (!l.length) return '';
  const tax = l.find((c) => /세금/.test(c.product || ''));
  if (tax && category === '세금') return tax.id;
  return (l.find((c) => !/세금/.test(c.product || '')) || l[0]).id;
}
const cardIdOf = (t) => (t.cardId && cardsOf(t.card).some((c) => c.id === t.cardId) ? t.cardId : defaultCardId(t.card, t.category));
const cardShortIssuer = (c) => c.card + '카드';
const cardShort = (c) => c.short || c.product || c.name || '';
function cardLabel(issuer, id) {
  const l = cardsOf(issuer); const c = l.find((x) => x.id === id);
  return c ? (c.name || (issuer + '카드')) : (issuer || '기타') + '카드';
}
// 카드 선택 목록: value는 '카드사|id'
function cardChoices() {
  const out = []; const seen = new Set();
  CARDS.forEach((k) => { const l = cardsOf(k); if (!l.length) { out.push({ v: k + '|', card: k, id: '', label: k }); return; } seen.add(k);
    l.forEach((c) => out.push({ v: k + '|' + c.id, card: k, id: c.id, label: c.name || k })); });
  return out;
}
const splitCardVal = (v) => { const [card, id] = String(v || '').split('|'); return { card: card || '', id: id || '' }; };
function cardOptions(selVal) { return cardChoices().map((o) => h('option', { value: o.v, text: o.label, selected: o.v === selVal })); }

function renderTop(cur) { $('topBal').replaceChildren(cur ? man(cur.v) + '만' : '—', h('small', { text: cur ? cur.date + ' 마통 잔액' : '마통 잔액' })); }
function renderKpis(ser) {
  const c = cfg(); const k = $('kpis'); k.replaceChildren(); const cur = ser[ser.length - 1];
  if (!cur) { k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '마통 잔액' }), h('span', { class: 'v', text: '—' }), h('span', { class: 's', text: S.ready ? '아직 잔액 기록이 없습니다' : '불러오는 중…' }))); return; }
  const debt = -cur.v / 1e4; const used = debt / c.od_limit_man * 100;
  const prevEnd = [...ser].reverse().find((p) => ymOf(p.date) < ymOf(cur.date)); const chg = prevEnd ? cur.v - prevEnd.v : null;
  k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '마통 잔액' }), h('span', { class: 'v' }, man(cur.v), h('small', { text: '만 원' })),
    h('span', { class: 's' + (chg == null ? '' : chg >= 0 ? ' ok' : ' bad'), text: chg == null ? cur.date + ' 기준' : '전월 말 대비 ' + signed(chg) + '만' })));
  const ub = h('i', { class: used >= 60 ? 'bad' : used >= 35 ? 'warn' : '' }); ub.style.width = Math.min(100, Math.max(0, used)) + '%';
  k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '한도 사용률' }), h('span', { class: 'v' }, used.toFixed(1), h('small', { text: '%' })), h('div', { class: 'bar' }, ub), h('span', { class: 's', text: '남은 한도 ' + manv(c.od_limit_man - debt) + '만' })));
  const step = (c.steps || []).filter((s) => s < debt).sort((a, b) => b - a)[0];
  k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '월 이자 (추정)' }), h('span', { class: 'v' }, (Math.max(0, debt) * c.rate / 12).toFixed(1), h('small', { text: '만 원' })),
    h('span', { class: 's', text: step != null ? '다음 단계 ' + manv(step) + '만까지 ' + manv(debt - step) + '만' : '연 ' + (c.rate * 100).toFixed(1) + '% 가정' })));
  const lim = refList('limits').find((l) => l.id === 'nh'); const ms = monthsBack(3);
  const nh = cardUsed(lim ? lim.members : ['농협'], ms) / 1e4; const goal = c.nh3m_goal_man; const p = nh / goal * 100;
  const nb = h('i', { class: p >= 100 ? '' : p >= 60 ? 'warn' : 'bad' }); nb.style.width = Math.min(100, p) + '%';
  k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '올바른SAFE카드 3개월 실적' }), h('span', { class: 'v' }, nh.toFixed(1), h('small', { text: '/ ' + goal + '만' })), h('div', { class: 'bar' }, nb),
    h('span', { class: 's', text: ms[2].slice(2).replace('-', '.') + '~' + ms[0].slice(2).replace('-', '.') + (p >= 100 ? ' · 달성' : ' · ' + Math.round(goal - nh) + '만 남음') })));
}

/* ================= render: chart ================= */
function renderChart(ser) {
  const el = $('chart'); el.replaceChildren();
  if (!ser.length || typeof d3 === 'undefined') { el.append(h('p', { class: 'empty', text: '잔액 기록이 생기면 그래프가 그려집니다.' })); return; }
  const c = cfg(); const sMan = S.surplus ?? c.surplus_man; const last = ser[ser.length - 1];
  $('lgProj').textContent = '상환 예상 (월 ' + sMan + '만 원 잔류)';
  const P = simulate(-last.v / 1e4, sMan, c.rate).path.map((v, i) => ({ date: addMonths(last.date, i + 1), v: -v * 1e4, src: '상환 예상' }));
  const parse = (d) => new Date(d + 'T00:00:00');
  const A = ser.map((p) => ({ ...p, t: parse(p.date) })); const B = P.map((p) => ({ ...p, t: parse(p.date) })); const all = [...A, ...B];
  const W = Math.max(300, el.clientWidth || 600), H = W < 560 ? 240 : 300, m = { t: 14, r: 44, b: 26, l: 48 };
  const x = d3.scaleTime().domain(d3.extent(all, (d) => d.t)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([Math.floor(d3.min(A, (d) => d.v / 1e4) / 1000) * 1000, 0]).range([H - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('viewBox', [0, 0, W, H]).attr('role', 'img').attr('aria-label', '마통 잔액 추이 (만 원)와 상환 예상선');
  y.ticks(6).forEach((t) => { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--line)'); svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t.toLocaleString('ko-KR')); });
  svg.append('text').attr('x', m.l - 6).attr('y', 10).attr('text-anchor', 'end').text('만 원');
  x.ticks(W < 560 ? 4 : 7).forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 7).attr('text-anchor', 'middle').text(d3.timeFormat('%y.%m')(t)));
  (c.steps || []).forEach((s) => { if (-s < y.domain()[0]) return; svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(-s)).attr('y2', y(-s)).attr('stroke', 'var(--mute)').attr('stroke-dasharray', '2 4'); svg.append('text').attr('x', W - m.r + 4).attr('y', y(-s) + 4).text('-' + s.toLocaleString('ko-KR')); });
  const line = d3.line().x((d) => x(d.t)).y((d) => y(d.v / 1e4)); const lastA = A[A.length - 1];
  if (B.length) svg.append('path').attr('d', line([lastA, ...B])).attr('fill', 'none').attr('stroke', 'var(--mute)').attr('stroke-width', 1.8).attr('stroke-dasharray', '5 4');
  svg.append('path').attr('d', line(A)).attr('fill', 'none').attr('stroke', 'var(--accent)').attr('stroke-width', 2.2).attr('stroke-linejoin', 'round');
  A.forEach((d) => svg.append('circle').attr('cx', x(d.t)).attr('cy', y(d.v / 1e4)).attr('r', 2.6).attr('fill', 'var(--panel)').attr('stroke', 'var(--accent)').attr('stroke-width', 1.5));
  svg.append('circle').attr('cx', x(lastA.t)).attr('cy', y(lastA.v / 1e4)).attr('r', 5).attr('fill', 'var(--accent)');
  svg.append('text').attr('x', x(lastA.t) - 8).attr('y', y(lastA.v / 1e4) - 9).attr('text-anchor', 'end').style('font-weight', 600).style('fill', 'var(--ink)').text(man(lastA.v));
  if (B.length) { const e = B[B.length - 1]; svg.append('text').attr('x', Math.min(x(e.t), W - m.r)).attr('y', y(0) + 14).attr('text-anchor', 'end').text(e.date.slice(0, 7) + ' 완납'); }
  const tip = h('div', { class: 'tip' }); el.append(tip);
  const dot = svg.append('circle').attr('r', 5).attr('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-width', 1.5).style('display', 'none');
  const bis = d3.bisector((d) => d.t).center;
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [px] = d3.pointer(ev, svg.node()); const d = all[bis(all, x.invert(px))]; if (!d) return;
      dot.style('display', null).attr('cx', x(d.t)).attr('cy', y(d.v / 1e4));
      tip.textContent = d.date + ' · ' + man(d.v) + '만 원 (' + d.src + ')'; tip.style.display = 'block';
      const k = el.clientWidth / W; const left = Math.min(Math.max(4, x(d.t) * k - tip.offsetWidth / 2), el.clientWidth - tip.offsetWidth - 4);
      tip.style.left = left + 'px'; tip.style.top = Math.max(0, y(d.v / 1e4) * k - 40) + 'px';
    })
    .on('pointerleave', () => { dot.style('display', 'none'); tip.style.display = 'none'; });
}

/* ================= render: card limits + flow ================= */
function renderLimits() {
  const el = $('limits'); el.replaceChildren(); const ym = monthsBack(1)[0];
  $('limTitle').textContent = '카드별 ' + Number(ym.slice(5)) + '월 사용액';
  const items = refList('limits'); if (!items.length) { el.append(h('p', { class: 'empty', text: '카드 한도 기준값이 없습니다.' })); return; }
  items.forEach((l) => {
    const used = cardUsed(l.members || [], [ym], l.ids) / 1e4; const cap = +l.cap_man || 0; const tgt = +l.target_man || 0; const scale = Math.max(cap, used, 1);
    const fill = h('i', { class: used > cap ? 'bad' : used > cap * 0.85 ? 'warn' : '' }); fill.style.width = Math.min(100, used / scale * 100) + '%';
    const tr = h('div', { class: 'track' }, fill); if (tgt > 0) { const u = h('u'); u.style.left = (tgt / scale * 100) + '%'; tr.append(u); }
    const left = cap - used; const tgtTxt = tgt > 0 ? (used >= tgt ? ' · 목표 ' + tgt + '만 달성' : ' · 목표까지 ' + (tgt - used).toFixed(1) + '만') : '';
    el.append(h('div', { class: 'lim-row' }, h('div', { class: 'lim-head' }, h('span', { text: l.name }), h('b', { text: used.toFixed(1) + ' / ' + cap + '만' })), tr,
      h('div', { class: 'lim-sub', text: (left >= 0 ? '상한까지 ' + left.toFixed(1) + '만' : '상한 ' + (-left).toFixed(1) + '만 초과') + tgtTxt + (l.note ? ' · ' + l.note : '') })));
  });
}
function renderFlow() {
  const ym = monthsBack(1)[0]; $('flowTitle').textContent = Number(ym.slice(5)) + '월 우리 통장 흐름';
  const t = txs().filter((x) => x.type === 'bank' && x.account === '우리' && ymOf(x.date) === ym);
  const inn = t.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0); const out = t.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0);
  $('flow').replaceChildren(
    h('div', {}, h('span', { class: 'sub', text: '들어온 돈' }), h('b', { text: man(inn) + '만', style: 'color:var(--ok)' })),
    h('div', {}, h('span', { class: 'sub', text: '나간 돈' }), h('b', { text: man(out) + '만', style: 'color:var(--bad)' })),
    h('div', {}, h('span', { class: 'sub', text: '순변동' }), h('b', { text: signed(inn + out) + '만' })),
    h('div', {}, h('span', { class: 'sub', text: '기록 건수' }), h('b', { text: t.length + '건' })));
  const cats = $('cats'); cats.replaceChildren();
  if (!t.length) { cats.append(h('p', { class: 'empty', text: '이번 달 우리 통장 캡처가 아직 없습니다.' })); return; }
  const by = d3.rollups(t.filter((x) => x.amount < 0), (v) => -d3.sum(v, (x) => x.amount), (x) => x.category || '기타').sort((a, b) => b[1] - a[1]); const mx = by.length ? by[0][1] : 1;
  by.forEach(([k, v]) => { const i = h('i'); i.style.width = (v / mx * 100) + '%'; cats.append(h('div', { class: 'cat' }, h('span', { text: k + ' 출금' }), h('div', { class: 't' }, i), h('span', { class: 'n', text: man(v) + '만' }))); });
}

/* ================= recognition ================= */
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했습니다.')); i.src = src; }); }
async function makeTiles(img) {
  // 긴 캡처는 여러 조각으로 잘라 보냅니다 (글자가 작아지지 않게)
  const w = img.naturalWidth, H = img.naturalHeight; const slices = [];
  if (H <= w * 2.3) slices.push([0, H]);
  else { let n = Math.min(6, Math.ceil(H / (w * 1.5))); const ov = Math.round(w * 0.12); const sh = Math.ceil((H + ov * (n - 1)) / n); for (let i = 0; i < n; i++) { const y0 = Math.max(0, Math.min(i * (sh - ov), H - sh)); slices.push([y0, Math.min(sh, H - y0)]); } }
  return slices.map(([y0, sh]) => {
    const scale = Math.min(1, 1568 / Math.max(w, sh), Math.sqrt(1150000 / (w * sh)));
    const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(sh * scale);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, y0, w, sh, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
}
function thumbOf(img) {
  // 보관용 사본: 폭 720px, 전체 크기 약 800KB 이하
  let scale = Math.min(1, 720 / img.naturalWidth); let q = 0.72; let url = '';
  for (let i = 0; i < 6; i++) {
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * scale); cv.height = Math.round(img.naturalHeight * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); url = cv.toDataURL('image/jpeg', q);
    if (url.length < 800000) break; scale *= 0.8; q = Math.max(0.5, q - 0.05);
  }
  return url;
}
function fixDate(s, today) {
  const str = String(s || '').trim(); let y, mo, d, inferred = false;
  let m = str.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { m = str.match(/(\d{1,2})\D+(\d{1,2})/); if (!m) return null; mo = +m[1]; d = +m[2]; y = +today.slice(0, 4); inferred = true; }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  let ds = y + '-' + pad(mo) + '-' + pad(d);
  const tomorrow = (() => { const t = new Date(today + 'T00:00:00'); t.setDate(t.getDate() + 1); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); })();
  if (ds > tomorrow && (inferred || y === +today.slice(0, 4))) ds = (y - 1) + '-' + pad(mo) + '-' + pad(d);
  return ds;
}
const fixTime = (t) => { const m = String(t || '').match(/(\d{1,2})\s*[:시]\s*(\d{2})/); return m ? pad(+m[1]) + ':' + m[2] : ''; };
function normCard(c) { const s = String(c || ''); if (!s || s === 'null') return null; if (/농협|NH|올바른/i.test(s)) return '농협'; if (/롯데|KT|SKYPASS|LOCA/i.test(s)) return '롯데'; if (/신한/.test(s)) return '신한'; if (/삼성/.test(s)) return '삼성'; if (/현대|코스트코/.test(s)) return '현대'; if (/국민|KB/i.test(s)) return '국민'; return '기타'; }
const normAcct = (a) => { const s = String(a || ''); if (/우리/.test(s)) return '우리'; if (/농협|NH/i.test(s)) return '농협'; if (/신한/.test(s)) return '신한'; return s ? '기타' : '우리'; };
function chainCheck(rows) {
  const run = (dir) => { let ok = 0, bad = 0; const res = rows.map(() => null);
    for (let i = 0; i < rows.length - 1; i++) {
      const a = dir > 0 ? rows[i] : rows[i + 1], b = dir > 0 ? rows[i + 1] : rows[i];
      if (a.include === false || b.include === false || a.balance == null || b.balance == null) continue;
      const good = Math.abs(a.balance - a.amount - b.balance) < 1; const idx = dir > 0 ? i : i + 1;
      res[idx] = good ? 'ok' : 'bad'; if (good) ok++; else bad++;
    } return { ok, bad, res }; };
  const f = run(1), r = run(-1); const best = r.ok > f.ok ? r : f;
  rows.forEach((x, i) => { x.chk = best.res[i]; });
  return { ok: best.ok, bad: best.bad, dir: best === r ? -1 : 1 };
}

/* ================= duplicate matching ================= */
// 캡처 행을 이미 저장된 거래와 대조합니다.
// st: new(신규) · same(이미 있음) · upgrade(기존 행에 시각·잔액 보완) · maybe(중복 의심) · nodate(날짜 확인 필요)
const ST_LABEL = { new: '신규', same: '이미 있음', upgrade: '보완', maybe: '의심', nodate: '날짜 확인', skip: '제외' };
// 카드·토스 화면의 행 종류: 결제·취소만 카드 사용으로 저장하고, 이체·입금은 통장 캡처로 기록합니다.
const KIND_LABEL = { spend: '결제', refund: '취소·환불', own_transfer: '내 계좌 이체', transfer: '송금', income: '입금·정산', other: '기타' };
const SPENDY = (k) => !k || k === 'spend' || k === 'refund';
function matchRows(rows, res) {
  const bank = res.screen === 'bank'; const account = res.account || '우리';
  const pool = txs().filter((t) => (bank ? t.type === 'bank' && t.account === account : t.type === 'card' && !isSummary(t)));
  const used = new Set(); const sum = { new: 0, same: 0, upgrade: 0, maybe: 0, nodate: 0, skip: 0, extra: [], gap: null };
  rows.forEach((r) => { r.m = { st: !bank && !SPENDY(r.kind) ? 'skip' : r.date && !r.out && Number.isFinite(r.amount) ? 'new' : 'nodate' }; });
  const live = rows.filter((r) => r.m.st === 'new');
  const cand = (r, f) => pool.find((t) => !used.has(t.id) && t.date === r.date && t.amount === r.amount && (bank || (t.card === r.card && (!t.cardId || !r.cardId || t.cardId === r.cardId))) && f(t));
  const take = (r, t, st) => { used.add(t.id); r.m = { st, id: t.id }; };
  // 1) 확실히 같은 거래: 통장은 잔액까지 같음, 카드는 가맹점명이 같고 시각이 모순되지 않음
  live.forEach((r) => {
    const t = bank ? cand(r, (x) => x.balance != null && r.balance != null && x.balance === r.balance) : cand(r, (x) => descSim(x.desc, r.desc) === 1 && timeCompat(x.time, r.time));
    if (t) take(r, t, 'same');
  });
  // 2) 통장: 시각이나 잔액이 비어 있던 기존 행(시드·직접 입력)과 날짜·금액이 같으면 같은 거래로 보고 보완
  if (bank) live.filter((r) => r.m.st === 'new').forEach((r) => {
    const t = cand(r, (x) => (x.balance == null || r.balance == null) && timeCompat(x.time, r.time));
    if (t) take(r, t, (t.balance == null && r.balance != null) || (!t.time && r.time) ? 'upgrade' : 'same');
  });
  // 3) 날짜·금액은 같은데 잔액(통장)이나 가맹점명(카드)이 조금 다르면 중복 의심
  live.filter((r) => r.m.st === 'new').forEach((r) => {
    const t = bank ? cand(r, (x) => timeCompat(x.time, r.time)) : cand(r, (x) => descSim(x.desc, r.desc) >= 0.6 && timeCompat(x.time, r.time));
    if (t) take(r, t, 'maybe');
  });
  rows.forEach((r) => { sum[r.m.st]++; });
  // 캡처 날짜 범위 안쪽(양 끝 날짜 제외)에 있는데 캡처에 없는 기존 거래
  const ds = live.map((r) => r.date).sort(); const from = ds[0], to = ds[ds.length - 1];
  if (from && to && from < to) {
    const cards = new Set(live.map((r) => r.card));
    pool.filter((t) => !used.has(t.id) && t.date > from && t.date < to && (bank || cards.has(t.card))).slice(0, 8).forEach((t) => sum.extra.push({ date: t.date, desc: t.desc || '', amount: t.amount }));
  }
  // 통장: 이 캡처의 가장 오래된 거래가 신규일 때 기존 마지막 잔액과 이어지는지 확인
  if (bank) {
    const wb = rows.filter((r) => r.m.st !== 'nodate' && r.balance != null); const ck = res.check || {};
    const oldest = !wb.length ? null : wb.length === 1 ? wb[0] : ck.ok > 0 ? (ck.dir > 0 ? wb[wb.length - 1] : wb[0]) : null;
    if (oldest && oldest.m.st === 'new') {
      const prior = pool.filter((t) => !used.has(t.id) && t.balance != null && (t.date < oldest.date || (t.date === oldest.date && t.time && oldest.time && t.time < oldest.time))).sort(txSort).pop();
      const need = oldest.balance - oldest.amount;
      if (prior) sum.gap = prior.balance === need ? { ok: true, text: '기존 마지막 잔액(' + prior.date + ' ' + won(prior.balance) + '원)과 정확히 이어집니다.' }
        : { ok: false, text: '기존 마지막 잔액 ' + won(prior.balance) + '원(' + prior.date + ')과 이 캡처 시작 직전 잔액 ' + won(need) + '원이 ' + won(Math.abs(need - prior.balance)) + '원 다릅니다. 그 사이 거래가 빠졌을 수 있습니다.' };
    }
  }
  return sum;
}
const defaultInclude = (rows) => rows.forEach((r) => { r.include = r.m.st === 'new' || r.m.st === 'upgrade'; });

// 카드·토스 화면 검증: 화면에 보이는 날짜별 합계나 목록 합계와 읽은 행의 합을 비교합니다 (통장의 잔액 검증 역할).
function cardCheck(rows, res) {
  const out = { ok: 0, bad: 0, partial: 0, days: {}, list: null };
  const valid = rows.filter((r) => r.date && Number.isFinite(r.amount)); const ds = valid.map((r) => r.date).sort(); const lo = ds[0], hi = ds[ds.length - 1];
  const shown = (r) => (SPENDY(r.kind) ? -r.amount : r.amount); // 화면 표시 부호: 결제는 나간 돈
  (res.dayTotals || []).forEach((d) => {
    const rs = valid.filter((r) => r.date === d.date); if (!rs.length) return;
    const inS = rs.reduce((a, r) => a + Math.max(0, shown(r)), 0), outS = rs.reduce((a, r) => a + Math.max(0, -shown(r)), 0);
    const good = (d.in == null || Math.abs(inS - d.in) < 1) && (d.out == null || Math.abs(outS - d.out) < 1);
    const st = good ? 'ok' : d.date === lo || d.date === hi ? 'partial' : 'bad'; out.days[d.date] = st; out[st]++;
  });
  if (Number.isFinite(res.listTotal)) {
    const s = valid.filter((r) => SPENDY(r.kind)).reduce((a, r) => a + r.amount, 0);
    out.list = Math.abs(s - res.listTotal) < 1 ? 'ok' : 'bad'; out[out.list]++;
  }
  return out;
}
// 카드 화면 자동 반영 조건: 결제 행의 모든 날짜가 합계로 확인되고 의심·날짜 확인 행이 없을 때
function cardAutoOK(res) {
  const ck = res.check || {}; const m = res.match || {}; const spend = res.rows.filter((r) => r.m && r.m.st !== 'skip');
  if (!spend.length || ck.bad || m.maybe || m.nodate) return false;
  if (ck.list === 'ok') return true;
  return spend.every((r) => (ck.days || {})[r.date] === 'ok');
}
const TAX_RE = /국세|지방세|세금|ETAX|이택스|위택스|홈택스|국세청|종합소득세|부가가치세|부가세|재산세|자동차세|주민세|취득세|지방소득세|소득세|법인세|과태료/i;
function normalize(out, today, hint) {
  const items = Array.isArray(out && out.items) ? out.items : [];
  const screen = ['bank', 'card', 'mixed'].includes(out && out.screen) ? out.screen : (items.some((i) => i && i.balance != null) ? 'bank' : 'card');
  const bank = screen === 'bank';
  const account = bank ? normAcct((out && (out.account || out.institution)) || '우리') : null;
  const topCard = normCard(out && out.card); const rules = S.data.ref.catRules || {}; const hv = splitCardVal(hint); hint = hv.card;
  // 날짜를 먼저 읽습니다: 화면의 날짜 범위(period)를 정하고, 거래 날짜가 범위 밖이면 확인을 요구합니다.
  const pf = fixDate(out && out.period && out.period.from, today), pt = fixDate(out && out.period && out.period.to, today);
  const rows = []; const seen = new Set();
  items.forEach((it) => {
    if (!it) return; const amount = toNum(it.amount); if (!Number.isFinite(amount) || amount === 0) return;
    const date = fixDate(it.date, today) || ''; const bal = it.balance == null || it.balance === '' ? null : toNum(it.balance);
    if (Number.isFinite(bal)) { const k = [date, it.time, amount, bal].join('|'); if (seen.has(k)) return; seen.add(k); } // 잔액까지 같은 행은 조각 겹침으로 본 중복
    const out_ = !!(date && pf && pt && (date < pf || date > pt));
    let kind = null, amt = Math.round(amount), card = null;
    if (!bank) {
      kind = KIND_LABEL[it.kind] ? it.kind : (screen === 'card' ? (amt < 0 ? 'refund' : 'spend') : 'other');
      if (kind === 'spend') amt = Math.abs(amt); if (kind === 'refund') amt = -Math.abs(amt); // 토스처럼 결제가 -로 보여도 결제는 +
      if (SPENDY(kind)) { const c = normCard(it.card); card = hint || (c && c !== '기타' ? c : topCard && topCard !== '기타' ? topCard : '기타'); }
    }
    const desc = String(it.desc || '').slice(0, 60);
    const r = { include: !!date && !out_, date, time: fixTime(it.time), desc, amount: amt, balance: bank && Number.isFinite(bal) ? Math.round(bal) : null,
      card, kind, method: String(it.method || '').slice(0, 20), category: String(it.category || '기타').slice(0, 20) };
    if (card) r.cardId = (hv.card && hv.card === card && hv.id) || kwCardId(card, it.product) || kwCardId(card, out && out.product) || '';
    const rule = !bank && SPENDY(kind) ? rules[normDesc(desc).slice(0, 40)] : null;
    if (rule) { r.category = rule; r.ruled = true; } // 사용자가 전에 고친 분류를 우선 적용
    // 세금 낱말이 보이는 출금·결제는 모델이 다른 분류를 줘도 세금으로 보정 (사용자가 직접 고친 분류는 존중)
    if (!r.ruled && r.category !== '세금' && TAX_RE.test(desc) && (bank ? amt < 0 : kind === 'spend')) r.category = '세금';
    if (card) r.cardId = r.cardId || defaultCardId(card, r.category);
    if (out_) r.out = true; // Firestore는 undefined 값을 저장하지 못하므로 필요할 때만 넣습니다
    rows.push(r);
  });
  const ds = rows.map((r) => r.date).filter(Boolean).sort();
  const sb = toNum(out && out.screen_balance); const lt = toNum(out && out.list_total);
  const dayTotals = (Array.isArray(out && out.day_totals) ? out.day_totals : []).map((d) => {
    const date = fixDate(d && d.date, today); const i = toNum(d && d.in), o = toNum(d && d.out);
    return date ? { date, in: Number.isFinite(i) ? Math.abs(Math.round(i)) : null, out: Number.isFinite(o) ? Math.abs(Math.round(o)) : null } : null;
  }).filter(Boolean).slice(0, 14);
  const res = { screen, account, card: topCard || null, hint: hint || null, hintId: hv.id || null, rows, period: { from: pf || ds[0] || null, to: pt || ds[ds.length - 1] || null },
    dayTotals, listTotal: Number.isFinite(lt) ? Math.round(lt) : null, screenBalance: Number.isFinite(sb) ? sb : null, notes: String((out && out.notes) || '').slice(0, 300) };
  res.check = bank ? chainCheck(rows) : cardCheck(rows, res);
  res.match = matchRows(rows, res); defaultInclude(rows);
  return res;
}
async function callApi(tiles, hint) {
  const headers = { 'Content-Type': 'application/json' };
  const pass = lsGet(LS.pass, ''); if (pass) headers['x-app-passcode'] = pass;
  const key = lsGet(LS.key, ''); if (key) headers['x-user-api-key'] = key;
  const r = await fetch('/api/recognize', { method: 'POST', headers, body: JSON.stringify({ images: tiles, today: todayStr(), cardHint: splitCardVal(hint).card, cardProduct: (() => { const c = cardsOf(splitCardVal(hint).card).find((x) => x.id === splitCardVal(hint).id); return c && cardsOf(c.card).length > 1 ? c.product || '' : ''; })() }) });
  let data = {}; try { data = await r.json(); } catch (e) { }
  if (!r.ok) throw new Error(data.error || ('서버 오류 (' + r.status + ')'));
  return data.result;
}
async function recognize(id) {
  const src = S.files[id]; if (!src) { toast('원본 이미지가 이 기기에 없습니다. 캡처를 다시 올려주세요.'); return; }
  if (S.running.has(id)) return; S.running.add(id);
  try {
    const hint = (S.data.captures[id] || {}).cardHint || '';
    await store.setCap(id, { status: 'recognizing', error: null });
    const img = await loadImg(src); const tiles = await makeTiles(img); const today = todayStr();
    const result = normalize(await callApi(tiles, hint), today, hint);
    delete S.edits[id];
    await store.setCap(id, { status: result.rows.length ? 'review' : 'failed', result, error: result.rows.length ? null : '거래를 찾지 못했습니다. 거래 목록이 보이게 캡처해 주세요.', recognizedAt: new Date().toISOString() });
    const auto = $('autoSave').checked; const m = result.match || {}; const bank = result.screen === 'bank';
    const bankOK = bank && result.check.ok > 0 && result.check.bad === 0 && result.rows.every((r) => r.balance != null) && !m.maybe && !m.nodate;
    if (result.rows.length && auto && (bankOK || (!bank && cardAutoOK(result)))) {
      const o = await saveRows(id, result, result.rows);
      const why = bank ? '잔액 검증 ' + result.check.ok + '곳 일치' : result.check.list === 'ok' ? '목록 합계 일치' : '날짜별 합계 일치';
      toast(o.added + o.upgraded === 0 ? '새 거래가 없습니다. ' + (m.same || 0) + '건 모두 이미 반영되어 있습니다.' : '신규 ' + o.added + '건' + (o.upgraded ? ' · 보완 ' + o.upgraded + '건' : '') + ' 반영, 이미 있는 ' + (m.same || 0) + '건은 건너뜀 (' + why + ')');
    } else if (result.rows.length) toast(m.maybe || m.nodate ? '중복 의심 또는 날짜 확인이 필요한 행이 있습니다. 확인 후 저장하세요.' : '인식 완료. 확인 후 저장을 눌러주세요.');
  } catch (e) {
    await store.setCap(id, { status: 'failed', error: (e && e.message) || '인식하지 못했습니다.' });
  } finally { S.running.delete(id); renderQueue(true); }
}
async function addImages(files) {
  const list = [...files].filter((f) => f && /^image\//.test(f.type));
  if (!list.length) { toast('이미지만 올릴 수 있습니다.'); return; }
  const hint = $('capCard') ? $('capCard').value : ''; if ($('capCard')) $('capCard').value = ''; // 카드 지정은 이번 업로드에만 적용
  for (const f of list) {
    const id = uid(); const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const ih = hash(url.length + ':' + url); // 같은 캡처를 다시 올리면 막습니다 (인식 비용·중복 방지)
    const dup = caps().find((c) => c.imgHash === ih && ['saved', 'review', 'recognizing'].includes(c.status));
    if (dup) { toast('이미 올린 캡처입니다 (' + String(dup.createdAt || '').slice(0, 16).replace('T', ' ') + '). 거래 탭의 캡처 기록에서 확인하세요.'); continue; }
    S.files[id] = url;
    try { const img = await loadImg(url); const th = thumbOf(img); store.saveImg(id, th); } catch (e) { }
    await store.setCap(id, { status: 'recognizing', createdAt: new Date().toISOString(), name: f.name || '', imgHash: ih, cardHint: hint, device: navigator.userAgent.slice(0, 60) });
    recognize(id);
  }
}

/* ================= category learning ================= */
// 가맹점 이름 → 분류 규칙. 확인 화면이나 거래 수정에서 사용자가 정한 분류를 기억했다가 다음 인식에 먼저 적용합니다.
async function learnRules(list) {
  const cur = Object.assign({}, S.data.ref.catRules || {}); let ch = false;
  list.forEach(({ desc, category }) => { const k = normDesc(desc).slice(0, 40); if (!k || !category || category === '기타' || !CARD_CATS.includes(category)) return; if (cur[k] !== category) { delete cur[k]; cur[k] = category; ch = true; } });
  const keys = Object.keys(cur); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => { delete cur[k]; });
  if (ch) await store.setRef('catRules', cur);
}

/* ================= save ================= */
async function saveRows(capId, result, rows, opts) {
  const bank = result.screen === 'bank';
  matchRows(rows, Object.assign({}, result, { check: bank ? chainCheck(rows) : cardCheck(rows, result) })); // 저장 직전 최신 데이터로 다시 대조
  const keep = rows.filter((r) => r.include !== false && r.m.st !== 'skip' && Number.isFinite(r.amount) && r.amount !== 0 && r.date);
  const now = new Date().toISOString(); const batch = {}; const del = []; let added = 0, upgraded = 0;
  const taken = (k) => !!(batch[k] || (S.data.tx[k] && !del.includes(k)));
  keep.forEach((r, i) => {
    const t = { type: bank ? 'bank' : 'card', account: bank ? (result.account || '우리') : null, card: bank ? null : (r.card || '기타'), cardId: bank ? null : (r.cardId || defaultCardId(r.card || '기타', r.category) || null), date: r.date, time: r.time || '', desc: r.desc || '',
      amount: r.amount, balance: bank && Number.isFinite(r.balance) ? r.balance : null, category: r.category || '기타', seq: keep.length - i, captureId: capId, source: 'capture', savedAt: now };
    if (!bank && r.method) t.method = r.method;
    const old = r.m && r.m.st === 'upgrade' ? S.data.tx[r.m.id] : null;
    if (old) { // 시각·잔액이 비어 있던 기존 행을 채웁니다 (새 행을 더하지 않음)
      const merged = Object.assign({}, old, { time: t.time || old.time || '', balance: t.balance != null ? t.balance : (old.balance == null ? null : old.balance), desc: old.desc || t.desc,
        category: old.category && old.category !== '기타' ? old.category : t.category, captureId: capId, source: 'capture', savedAt: now,
        prev: { time: old.time || '', balance: old.balance == null ? null : old.balance, source: old.source || '', captureId: old.captureId || null } });
      del.push(r.m.id); batch[uniqueKey(merged, taken)] = merged; upgraded++;
    } else { batch[uniqueKey(t, taken)] = t; added++; }
  });
  const dels = del.filter((k) => !(k in batch));
  Object.assign(S.data.tx, batch); dels.forEach((k) => { delete S.data.tx[k]; }); cacheSave(); render();
  await remote(async (d) => { await d.set({ tx: batch }, { merge: true }); for (const k of dels) await d.update(FP('tx', k), FV().delete()); });
  const prev = S.data.captures[capId] || {};
  // 저장 후에는 인식 결과 상세를 지워 문서 크기를 작게 유지합니다 (거래는 tx에 남음)
  await store.replaceCap(capId, { status: 'saved', savedCount: added + upgraded, savedAt: now, createdAt: prev.createdAt || now, name: prev.name || '', imgHash: prev.imgHash || null,
    result: { screen: result.screen, account: result.account || null, count: (result.rows || []).length } });
  delete S.edits[capId];
  if (!bank && opts && opts.learn) await learnRules(keep); // 사용자가 확인하고 저장한 분류만 학습
  return { added, upgraded, skipped: (result.rows || []).length - keep.length };
}

/* ================= render: queue ================= */
function editRows(c) { if (!S.edits[c.id]) S.edits[c.id] = JSON.parse(JSON.stringify((c.result && c.result.rows) || [])); return S.edits[c.id]; }
function statusPill(c) {
  const st = c.status;
  if (st === 'recognizing') return S.running.has(c.id) ? h('span', { class: 'pill run' }, h('span', { class: 'dot' }), '읽는 중…') : h('span', { class: 'pill', text: '다른 기기에서 인식 중이거나 중단됨' });
  if (st === 'review') return h('span', { class: 'pill warn', text: '확인 필요' });
  if (st === 'saved') return h('span', { class: 'pill ok', text: '반영 완료 ' + (c.savedCount || 0) + '건' });
  if (st === 'undone') return h('span', { class: 'pill', text: '반영 취소됨' });
  return h('span', { class: 'pill bad', text: '인식 실패' });
}
function imgEl(id, cls, alt, onclick) {
  const im = h('img', { class: cls, alt, onclick }); if (S.thumbs[id]) im.src = S.thumbs[id]; else store.getImg(id).then((u) => { if (u) im.src = u; });
  return im;
}
function bigImg(id) {
  const im = h('img', { alt: '원본 캡처', onclick: () => openViewer(id) });
  if (S.thumbs[id]) im.src = S.thumbs[id];
  store.getImg(id).then((u) => { if (u) im.src = u; });
  return im;
}
function renderQueue(force) {
  const active = caps().filter((c) => ['recognizing', 'review', 'failed'].includes(c.status)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const sig = active.map((c) => c.id + ':' + c.status + ':' + (c.recognizedAt || '')).join(',') + '|' + [...S.running].join(',');
  if (!force && sig === S.qsig) return; S.qsig = sig;
  const el = $('queue'); el.replaceChildren();
  active.forEach((c) => {
    const res = c.result || {};
    const kind = res.screen === 'bank' ? acctLabel(res.account || '') : res.screen === 'mixed' ? '결제·이체 혼합 내역' : res.screen === 'card' ? ((res.hint || res.card || '') ? (res.hint || res.card) + '카드 ' : '카드 ') + '이용내역' : '캡처';
    const info = h('div', { class: 'q-info' }, h('span', { class: 'q-title', text: kind + (res.rows ? ' · ' + res.rows.length + '건' : '') }), statusPill(c));
    if (c.status === 'recognizing' && c.cardHint) { const hv = splitCardVal(c.cardHint); info.append(h('span', { class: 'sub', text: cardLabel(hv.card, hv.id) + '로 지정됨' })); }
    if (c.error) info.append(h('span', { class: 'sub', text: c.error }));
    if (res.notes) info.append(h('details', { class: 'memo' }, h('summary', { text: '인식 메모' }), h('span', { class: 'sub', text: res.notes })));
    const acts = h('div', { class: 'row' });
    if (!S.running.has(c.id) && S.files[c.id]) acts.append(h('button', { class: 'btn small', type: 'button', text: '다시 인식', onclick: () => recognize(c.id) }));
    acts.append(h('button', { class: 'btn small ghost', type: 'button', text: '버리기', onclick: () => discard(c) }));
    const box = h('div', { class: 'q' }, h('div', { class: 'q-head' }, imgEl(c.id, 'q-thumb', '캡처', () => openViewer(c.id)), info), acts);
    if (c.status === 'review') {
      box.append(reviewTable(c));
      // PC 넓은 화면: 원본 캡처를 표 옆에 크게 띄워 대조하며 검수 (좁은 화면에서는 CSS로 숨김)
      box.classList.add('has-rv'); box.append(h('div', { class: 'q-big' }, bigImg(c.id)));
    }
    el.append(box);
  });
}
const md = (d) => (d ? Number(d.slice(5, 7)) + '/' + Number(d.slice(8)) : '');
function reviewTable(c) {
  const res = c.result; const rows = editRows(c); const bank = res.screen === 'bank'; const tb = h('tbody'); const trs = []; const sumEl = h('div', { class: 'msum' });
  const saveBtn = h('button', { class: 'btn primary', type: 'button' });
  // 입력이 바뀔 때마다 검증(잔액 사슬 또는 합계)과 기존 거래 대조를 다시 계산해 상태 열·요약·저장 버튼을 갱신합니다.
  const rematch = () => {
    const prevSt = rows.map((r) => (r.m || {}).st);
    const ck = bank ? chainCheck(rows) : cardCheck(rows, res); const m = matchRows(rows, Object.assign({}, res, { check: ck }));
    rows.forEach((r, i) => {
      const tr = trs[i]; if (!tr) return; const st = r.m.st;
      if (prevSt[i] === 'skip' && st !== 'skip') r.include = st === 'new' || st === 'upgrade';
      if (st === 'skip') r.include = false;
      tr.className = (st === 'same' || st === 'skip' ? 'dim' : '') + (st === 'skip' ? ' skip' : ''); const e = tr.querySelector('[data-st]'); e.className = 'st ' + st; e.textContent = ST_LABEL[st];
      const cb = tr.querySelector('td.ck input'); cb.checked = r.include !== false; cb.disabled = st === 'skip';
      const k = tr.querySelector('[data-chk]'); if (k) { k.className = 'chk ' + (r.chk || ''); k.textContent = r.chk === 'ok' ? '일치' : r.chk === 'bad' ? '불일치' : '—'; }
    });
    sumEl.replaceChildren();
    if (res.period && res.period.from) sumEl.append(h('div', { class: 'sub', text: '화면 날짜 ' + res.period.from + (res.period.to && res.period.to !== res.period.from ? ' ~ ' + res.period.to : '') }));
    sumEl.append(h('div', { class: 'mline', text: ['new', 'same', 'upgrade', 'maybe', 'nodate', 'skip'].filter((k) => m[k]).map((k) => ST_LABEL[k] + ' ' + m[k]).join(' · ') || '거래 없음' }));
    if (bank) sumEl.append(h('div', { class: 'sub ' + (ck.bad ? 'warnt' : ck.ok ? 'okt' : ''), text: '잔액 검증: 일치 ' + ck.ok + '곳, 불일치 ' + ck.bad + '곳' }));
    else {
      const by = (st) => Object.entries(ck.days || {}).filter(([, v]) => v === st).map(([d]) => md(d)).join(', ');
      if (by('ok')) sumEl.append(h('div', { class: 'sub okt', text: '날짜별 합계 일치: ' + by('ok') }));
      if (by('partial')) sumEl.append(h('div', { class: 'sub', text: '화면 끝에 걸려 일부만 보이는 날: ' + by('partial') + ' (나머지는 다음 캡처로)' }));
      if (by('bad')) sumEl.append(h('div', { class: 'sub warnt', text: '날짜별 합계 불일치: ' + by('bad') + ' · 빠졌거나 잘못 읽은 행이 있을 수 있습니다.' }));
      if (ck.list) sumEl.append(h('div', { class: 'sub ' + (ck.list === 'ok' ? 'okt' : 'warnt'), text: ck.list === 'ok' ? '화면 이용금액 합계와 일치합니다.' : '화면 이용금액 합계(' + won(res.listTotal) + '원)와 다릅니다. 기간이 다르거나 빠진 행이 있을 수 있습니다.' }));
      if (!ck.ok && !ck.bad && !ck.partial) sumEl.append(h('div', { class: 'sub', text: '화면에 합계가 없어 자동 검증을 못 했습니다. 금액을 한 번 확인해 주세요.' }));
    }
    if (m.skip) sumEl.append(h('div', { class: 'sub', text: '결제가 아닌 행(이체·송금·입금) ' + m.skip + '건은 카드 사용으로 저장하지 않습니다. 실제 결제면 종류를 "결제"로 바꾸세요.' }));
    const ruled = rows.filter((r) => r.ruled && r.m.st !== 'skip').length; if (ruled) sumEl.append(h('div', { class: 'sub', text: '전에 고친 분류를 ' + ruled + '건에 적용했습니다.' }));
    if (m.upgrade) sumEl.append(h('div', { class: 'sub', text: '보완: 시각·잔액이 비어 있던 기존 거래에 값을 채웁니다 (새 거래로 더하지 않음).' }));
    if (m.maybe) sumEl.append(h('div', { class: 'sub warnt', text: '의심: 날짜·금액은 같은데 잔액이나 가맹점명이 조금 다른 기존 거래가 있습니다. 같은 거래면 체크를 끄고, 다른 거래면 체크하세요.' }));
    if (m.nodate) sumEl.append(h('div', { class: 'sub warnt', text: '날짜를 읽지 못했거나 화면 날짜 범위 밖인 행이 있습니다. 날짜를 직접 고치고 체크하세요.' }));
    if (m.gap) sumEl.append(h('div', { class: 'sub ' + (m.gap.ok ? 'okt' : 'warnt'), text: m.gap.text }));
    if (m.extra.length) sumEl.append(h('div', { class: 'sub', text: '앱에는 있는데 이 캡처에는 없는 거래 ' + m.extra.length + '건 (날짜 범위 안쪽): ' + m.extra.map((x) => md(x.date) + ' ' + (x.desc || '') + ' ' + won(x.amount)).join(', ') }));
    const n = rows.filter((r) => r.include !== false && r.m.st !== 'skip' && r.date).length;
    saveBtn.textContent = n ? n + '건 저장해서 반영' : '저장할 거래 없음 · 완료 처리';
  };
  rows.forEach((r) => {
    const num = (k) => k === 'amount' || k === 'balance';
    const inp = (key, type, cls, label) => h('input', { type: type || 'text', class: cls || '', 'aria-label': label, value: num(key) ? (r[key] == null ? '' : won(r[key])) : (r[key] || ''), inputMode: num(key) ? 'numeric' : null,
      oninput: (e) => { const v = e.target.value; if (num(key)) { const n = toNum(v); r[key] = v.trim() === '' && key === 'balance' ? null : (Number.isFinite(n) ? Math.round(n) : r[key]); } else { r[key] = v; if (key === 'date') delete r.out; } rematch(); } });
    const amtInp = inp('amount', 'text', 'num', '금액');
    const cells = [h('td', { class: 'ck' }, h('input', { type: 'checkbox', checked: r.include !== false, 'aria-label': '저장에 포함', onchange: (e) => { r.include = e.target.checked; rematch(); } })),
      h('td', { class: 'stc' }, h('span', { 'data-st': '1', class: 'st new', text: '신규' })),
      h('td', { class: 'dt' }, inp('date', 'date', '', '날짜')), h('td', { class: 'tm' }, inp('time', 'text', '', '시각')), h('td', { class: 'ds' }, inp('desc', 'text', '', '내용')), h('td', { class: 'am' }, amtInp)];
    if (bank) cells.push(h('td', { class: 'bl' }, inp('balance', 'text', 'num', '잔액')), h('td', { class: 'vc' }, h('span', { 'data-chk': '1', class: 'chk ' + (r.chk || ''), text: r.chk === 'ok' ? '일치' : r.chk === 'bad' ? '불일치' : '—' })));
    else {
      const cardSel = h('select', { 'aria-label': '카드', onchange: (e) => { const v = splitCardVal(e.target.value); r.card = v.card || '기타'; r.cardId = v.id || defaultCardId(r.card, r.category); rematch(); } }, cardOptions((r.card || '기타') + '|' + (r.cardId || '')));
      cells.push(h('td', { class: 'cd' }, cardSel), h('td', { class: 'kd' }, h('select', { 'aria-label': '종류', onchange: (e) => {
        r.kind = e.target.value; if (r.kind === 'spend') r.amount = Math.abs(r.amount); if (r.kind === 'refund') r.amount = -Math.abs(r.amount);
        if (SPENDY(r.kind) && !r.card) { r.card = '기타'; r.cardId = ''; cardSel.value = '기타|'; } amtInp.value = won(r.amount); rematch(); } }, Object.entries(KIND_LABEL).map(([k, v]) => h('option', { value: k, text: v, selected: (r.kind || 'spend') === k })))));
    }
    cells.push(h('td', { class: 'ct' }, h('select', { 'aria-label': '분류', class: r.ruled ? 'ruled' : '', onchange: (e) => { r.category = e.target.value; r.ruled = false; e.target.className = ''; } }, (bank ? BANK_CATS : CARD_CATS).map((k) => h('option', { value: k, text: k, selected: r.category === k })))));
    const tr = h('tr', {}, cells); trs.push(tr); tb.append(tr);
  });
  rematch();
  const head = ['', '상태', '날짜', '시각', '내용', bank ? '금액(입금+)' : '금액(결제+)'].concat(bank ? ['잔액', '검증'] : ['카드', '종류']).concat(['분류']);
  const tools = bank ? null : h('div', { class: 'row rvtools' }, h('label', { class: 'fld inline' }, '카드 한꺼번에 바꾸기',
    h('select', { onchange: (e) => { const v = e.target.value; if (!v) return; const sv = splitCardVal(v); rows.forEach((r) => { if (SPENDY(r.kind)) { r.card = sv.card; r.cardId = sv.id || defaultCardId(sv.card, r.category); } }); renderQueue(true); toast('결제 행의 카드를 ' + cardLabel(sv.card, sv.id) + '로 바꿨습니다.'); } }, [h('option', { value: '', text: '선택' })].concat(cardChoices().map((o) => h('option', { value: o.v, text: o.label }))))));
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try { const o = await saveRows(c.id, res, rows, { learn: true }); toast('신규 ' + o.added + '건' + (o.upgraded ? ' · 보완 ' + o.upgraded + '건' : '') + ' 반영했습니다. 제외한 ' + o.skipped + '건은 저장하지 않았습니다.'); }
    catch (e) { saveBtn.disabled = false; toast('저장하지 못했습니다.'); }
  });
  return h('div', { class: 'rvwrap' }, sumEl, tools, h('div', { class: 'scroll-x' }, h('table', { class: 'rv ' + (bank ? 'rv-bank' : 'rv-card') }, h('thead', {}, h('tr', {}, head.map((t) => h('th', { text: t })))), tb)), h('div', { class: 'savebar' }, saveBtn));
}
// 캡처 한 장으로 반영된 거래를 한 번에 되돌립니다 (보완했던 기존 행은 원래 값으로 복원, 직접 수정한 행은 그대로 둠)
async function undoCap(c) {
  const key = 'u' + c.id;
  if (S.armed !== key) { S.armed = key; renderCapLog(); toast('한 번 더 누르면 이 캡처로 반영된 거래를 되돌립니다.'); setTimeout(() => { if (S.armed === key) { S.armed = null; renderCapLog(); } }, 4000); return; }
  S.armed = null; const list = txs().filter((t) => t.captureId === c.id); let n = 0, kept = 0;
  for (const t of list) {
    if (t.edited) { kept++; continue; }
    if (t.prev) {
      const o = Object.assign({}, t); delete o.id; Object.assign(o, { time: t.prev.time || '', balance: t.prev.balance == null ? null : t.prev.balance, source: t.prev.source || 'seed', captureId: t.prev.captureId || null, prev: null });
      const nk = uniqueKey(o, (k) => !!S.data.tx[k] && k !== t.id); await store.setTx(nk, o); if (nk !== t.id) await store.delTx(t.id);
    } else await store.delTx(t.id);
    n++;
  }
  await store.setCap(c.id, { status: 'undone', savedCount: 0 }); toast(n + '건을 되돌렸습니다.' + (kept ? ' 직접 수정한 ' + kept + '건은 남겼습니다.' : ''));
}
async function discard(c) {
  if (S.armed !== 'd' + c.id) { S.armed = 'd' + c.id; toast('한 번 더 누르면 지웁니다. 저장된 거래는 남습니다.'); setTimeout(() => { if (S.armed === 'd' + c.id) S.armed = null; }, 4000); return; }
  S.armed = null; delete S.edits[c.id]; delete S.files[c.id]; await store.delCap(c.id); toast('지웠습니다.');
}

/* ================= render: transactions / captures ================= */
function txEditor(t) {
  const bank = t.type === 'bank'; const L = (label, el) => h('label', { class: 'fld' }, label, el);
  const date = h('input', { type: 'date', value: t.date }); const time = h('input', { type: 'text', value: t.time || '', placeholder: '16:43' });
  const desc = h('input', { type: 'text', value: t.desc || '', maxLength: 60 }); const amt = h('input', { type: 'text', inputMode: 'numeric', value: won(t.amount) });
  const bal = h('input', { type: 'text', inputMode: 'numeric', value: t.balance == null ? '' : won(t.balance) });
  const who = bank ? h('select', {}, ACCTS.map((k) => h('option', { value: k, text: acctLabel(k), selected: t.account === k }))) : h('select', {}, cardOptions((t.card || '기타') + '|' + (cardIdOf(t) || '')));
  const memo = h('textarea', { rows: 3, maxLength: 1000, placeholder: '왜 쓴 돈인지, 어떤 이유였는지 적어 두세요.' }); memo.value = t.memo || '';
  const cat = h('select', {}, (bank ? BANK_CATS : CARD_CATS).map((k) => h('option', { value: k, text: k, selected: t.category === k })));
  const close = () => { S.editId = null; renderTx(true); };
  const save = async () => {
    const a = toNum(amt.value); if (!Number.isFinite(a) || a === 0 || !date.value) { toast('날짜와 금액을 확인하세요.'); return; }
    const n = Object.assign({}, t); delete n.id;
    Object.assign(n, { date: date.value, time: fixTime(time.value), desc: desc.value.trim(), amount: Math.round(a), category: cat.value, edited: true });
    if (bank) { const b = toNum(bal.value); n.balance = Number.isFinite(b) ? Math.round(b) : null; n.account = who.value; } else { const cv = splitCardVal(who.value); n.card = cv.card || '기타'; n.cardId = cv.id || defaultCardId(n.card, n.category) || null; }
    n.memo = memo.value.trim();
    if (t.prev) n.prev = null;
    if (n.type === 'card' && n.category !== t.category) learnRules([{ desc: n.desc, category: n.category }]);
    const nk = uniqueKey(n, (k) => !!S.data.tx[k] && k !== t.id);
    S.editId = null;
    if (nk === t.id) await store.setTx(nk, n); else { await store.setTx(nk, n); await store.delTx(t.id); }
    renderTx(true); toast('수정했습니다.');
  };
  return h('div', { class: 'txed' }, h('div', { class: 'form' }, L('날짜', date), L('시각', time), L('내용', desc), L(bank ? '금액 (입금 +, 출금 −)' : '금액 (결제 +, 취소 −)', amt), bank ? L('거래 후 잔액', bal) : null, L(bank ? '계좌' : '카드', who), L('분류', cat), h('label', { class: 'fld wide' }, '메모', memo)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary small', type: 'button', text: '수정 저장', onclick: save }), h('button', { class: 'btn small', type: 'button', text: '취소', onclick: close })));
}
function memoEditor(t) {
  const ta = h('textarea', { rows: 3, maxLength: 1000, placeholder: '왜 쓴 돈인지, 어떤 이유였는지 적어 두세요. (예: 어머니 생신 선물, 일회성 지출)' }); ta.value = t.memo || '';
  const save = async () => { const v = ta.value.trim(); S.memoId = null; const n = Object.assign({}, t); delete n.id; n.memo = v; await store.setTx(t.id, n); renderTx(true); toast(v ? '메모를 저장했습니다.' : '메모를 지웠습니다.'); };
  setTimeout(() => ta.focus(), 30);
  return h('div', { class: 'memo-ed' }, ta, h('div', { class: 'row' }, h('button', { class: 'btn primary small', type: 'button', text: '메모 저장', onclick: save }), h('button', { class: 'btn small', type: 'button', text: '취소', onclick: () => { S.memoId = null; renderTx(true); } })));
}
function renderTx(force) {
  if ((S.editId || S.memoId) && !force) return; // 수정 중에는 다른 기기의 변경이 와도 입력이 지워지지 않게 다시 그리지 않습니다
  const el = $('txList'); el.replaceChildren(); const f = S.txf;
  const list = txs().filter((t) => f === 'all' || (f === 'woori' && t.type === 'bank' && t.account === '우리') || (f === 'nh' && t.type === 'bank' && t.account === '농협') || (f === 'shinhan' && t.type === 'bank' && t.account === '신한') || (f === 'card' && t.type === 'card') || (f === 'memo' && !!t.memo))
    .filter((t) => !S.txq || [t.desc, t.memo, t.category, t.card, t.account].join(' ').toLowerCase().includes(S.txq)).sort(txSort).reverse().slice(0, 400);
  if (!list.length) { el.append(h('p', { class: 'empty', text: S.ready ? '거래가 없습니다. 홈에서 캡처를 붙여넣어 보세요.' : '불러오는 중…' })); return; }
  let day = '';
  list.forEach((t) => {
    if (t.date !== day) { day = t.date; el.append(h('div', { class: 'day', text: t.date })); }
    const who = t.type === 'card' ? cardLabel(t.card || '기타', cardIdOf(t)) : acctLabel(t.account);
    const del = h('button', { class: 'btn small ghost danger', type: 'button', text: S.armed === t.id ? '삭제 확인' : '삭제', onclick: async () => { if (S.armed !== t.id) { S.armed = t.id; renderTx(true); return; } S.armed = null; if (S.editId === t.id) S.editId = null; await store.delTx(t.id); renderTx(true); } });
    const edit = h('button', { class: 'btn small ghost', type: 'button', text: S.editId === t.id ? '닫기' : '수정', onclick: () => { S.editId = S.editId === t.id ? null : t.id; S.memoId = null; renderTx(true); } });
    const memoBtn = h('button', { class: 'btn small ghost' + (t.memo ? ' has' : ''), type: 'button', text: t.memo ? '메모 ✎' : '메모', onclick: () => { S.memoId = S.memoId === t.id ? null : t.id; S.editId = null; renderTx(true); } });
    const inflow = t.type === 'bank' && t.amount > 0;
    el.append(h('div', { class: 'li' }, h('span', { class: 'd', text: t.desc || '(내용 없음)' }), h('span', { class: 'a' + (inflow ? ' in' : ''), text: (inflow ? '+' : '') + won(t.amount) + '원' }),
      h('span', { class: 'm', text: [t.time, who, t.category, t.balance != null ? '잔액 ' + won(t.balance) : '', isSummary(t) ? '월 합계' : '', t.edited ? '수정됨' : ''].filter(Boolean).join(' · ') }), h('span', { class: 'x acts' }, memoBtn, edit, del)));
    if (t.memo && S.memoId !== t.id) el.append(h('div', { class: 'memo-row', text: t.memo, title: '눌러서 메모 수정', onclick: () => { S.memoId = t.id; S.editId = null; renderTx(true); } }));
    if (S.memoId === t.id) el.append(memoEditor(t));
    if (S.editId === t.id) el.append(txEditor(t));
  });
}
function renderCapLog() {
  const el = $('capLog'); el.replaceChildren();
  const list = caps().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 60);
  if (!list.length) { el.append(h('p', { class: 'empty', text: '올린 캡처가 없습니다.' })); return; }
  list.forEach((c) => {
    el.append(h('div', { class: 'li' }, h('span', { class: 'd' }, h('button', { class: 'btn small ghost', type: 'button', text: '보기', onclick: () => openViewer(c.id) }), ' ', String(c.createdAt || '').slice(0, 16).replace('T', ' ')),
      statusPill(c), h('span', { class: 'm', text: c.result ? (c.result.screen === 'bank' ? (c.result.account || '') + ' 통장' : '카드') + ' · ' + (c.result.count != null ? c.result.count : (c.result.rows || []).length) + '건 인식' : (c.error || '') }),
      h('span', { class: 'x acts' }, c.status === 'saved' && c.savedCount ? h('button', { class: 'btn small ghost', type: 'button', text: S.armed === 'u' + c.id ? '되돌리기 확인' : '반영 취소', onclick: () => undoCap(c) }) : null,
        h('button', { class: 'btn small ghost danger', type: 'button', text: '기록 삭제', onclick: () => discard(c) }))));
  });
}
function openViewer(id) {
  S.view = S.view === id ? null : id; const v = $('viewer'); v.replaceChildren(); if (!S.view) return;
  if (S.tab !== 'tx') setTab('tx');
  v.append(h('button', { class: 'btn small', type: 'button', text: '닫기', onclick: () => openViewer(id) }), imgEl(id, '', '캡처 원본'));
  v.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ================= render: plan ================= */
function renderPlan(ser) {
  const c = cfg(); const cur = ser[ser.length - 1]; const sel = $('surplusSel'); const want = S.surplus ?? c.surplus_man;
  if (!sel.options.length) for (let v = 150; v <= 700; v += 50) sel.append(h('option', { value: v, text: '월 ' + v + '만 원' }));
  sel.value = String(want);
  const pt = $('payoff'); pt.replaceChildren();
  if (cur) {
    const debt = -cur.v / 1e4;
    $('payoffNote').textContent = cur.date + ' 잔액 ' + man(cur.v) + '만 원 기준. 월급 ' + c.salary_man + '만 원 중 제2계좌로 보내고 남은 금액이 마통을 줄입니다. 이자 연 ' + (c.rate * 100).toFixed(1) + '% 반영, 주식 매도 같은 일회성 입금은 제외.';
    pt.append(h('thead', {}, h('tr', {}, ['마통 잔류(월)', '제2계좌 이체', '완납까지', '완납 시기'].map((t, i) => h('th', { class: i < 3 ? 'n' : '', text: t })))));
    const tb = h('tbody');
    [...new Set([200, 300, 400, 500, want])].sort((a, b) => a - b).forEach((s) => { const sim = simulate(debt, s, c.rate); tb.append(h('tr', { class: s === want ? 'hi' : '' }, h('td', { class: 'n', text: s + '만' + (s === c.surplus_man ? ' (권고)' : '') }), h('td', { class: 'n', text: (c.salary_man - s) + '만' }), h('td', { class: 'n', text: sim.months >= 120 ? '10년 이상' : sim.months + '개월' }), h('td', { text: sim.months >= 120 ? '—' : addMonths(cur.date, sim.months).slice(0, 7) }))); });
    pt.append(tb);
  } else $('payoffNote').textContent = '잔액 기록이 필요합니다.';
  const items = refList('plan'); const baseSum = d3.sum(items.filter((r) => !r.optional), (r) => +r.man); const optSum = d3.sum(items.filter((r) => r.optional), (r) => +r.man); const transfer = c.salary_man - want;
  $('planNote').textContent = '필요액 ' + baseSum.toFixed(0) + '만 원 (선택 항목 포함 ' + (baseSum + optSum).toFixed(0) + '만). 월 ' + want + '만 원을 마통에 남기면 이체 ' + transfer + '만 원, 완충 ' + (transfer - baseSum - optSum).toFixed(0) + '만 원입니다.';
  $('planTbl').replaceChildren(h('thead', {}, h('tr', {}, ['항목', '월(만 원)', '날짜', '메모'].map((t, i) => h('th', { class: i === 1 || i === 2 ? 'n' : '', text: t })))),
    h('tbody', {}, items.map((r) => h('tr', { class: r.optional ? 'opt' : '' }, h('td', { text: r.item }), h('td', { class: 'n', text: (+r.man).toLocaleString('ko-KR') }), h('td', { class: 'n', text: r.day ? r.day + '일' : '' }), h('td', { text: r.note || '' })))),
    h('tfoot', {}, h('tr', {}, h('td', { text: '합계 (선택 제외)' }), h('td', { class: 'n', text: baseSum.toLocaleString('ko-KR') }), h('td'), h('td'))));
  const fixed = refList('fixed').filter((r) => r.group === '현금'); const fsum = d3.sum(fixed, (r) => +r.man);
  $('fixCash').replaceChildren(h('thead', {}, h('tr', {}, h('th', { text: '항목' }), h('th', { text: '출금' }), h('th', { class: 'n', text: '월(만 원)' }))),
    h('tbody', {}, fixed.map((r) => h('tr', {}, h('td', { text: r.name }), h('td', { text: r.via }), h('td', { class: 'n', text: (+r.man).toFixed(1) })))),
    h('tfoot', {}, h('tr', {}, h('td', { text: '합계' }), h('td'), h('td', { class: 'n', text: fsum.toFixed(1) }))));
  const mg = S.data.ref.mortgage; const mort = $('mort'); mort.replaceChildren();
  if (mg && mg.balance) {
    const pay = (+mg.autoPayment || 0) + (+mg.extraPayment || 0) + (+mg.wifePayment || 0); let b = +mg.balance, n = 0; const r = (+mg.rate || 0) / 1200;
    while (b > 0 && n < 600) { b = b * (1 + r) - pay; n++; }
    const done = addMonths(todayStr(), n).slice(0, 7);
    [['잔액', won(mg.balance) + '원'], ['금리', (+mg.rate).toFixed(2) + '%'], ['월 원리금', won(mg.autoPayment) + '원'], ['추가 납입 (본인+배우자)', won((+mg.extraPayment || 0) + (+mg.wifePayment || 0)) + '원'], ['이대로 상환 시', n >= 600 ? '50년 이상' : done + ' (' + n + '개월)']]
      .forEach(([k, v]) => mort.append(h('div', {}, h('span', { class: 'sub', text: k }), h('b', { text: v }))));
    $('mortNote').textContent = (mg.source || '') + ' 기준이며 은행 잔액과 다를 수 있습니다. 잔액이 바뀌면 Claude에게 갱신을 요청하세요.';
  } else { mort.append(h('p', { class: 'empty', text: '주담대 기록이 없습니다.' })); $('mortNote').textContent = ''; }
}

/* ================= reference defaults ================= */
function ensureRef() {
  if (S.ensured || !S.ready || !window.GF_SEED) return; S.ensured = true;
  Object.entries(window.GF_SEED.ref).forEach(([k, v]) => { if (S.data.ref[k] == null) store.setRef(k, JSON.parse(JSON.stringify(v))); });
  // rev 3: 카드 정식 명칭·주요 혜택 반영. 사용자가 고친 결제일·계좌·메모·연회비는 그대로 둡니다.
  if ((+S.data.ref.rev || 0) < 3) {
    const want = window.GF_SEED.ref.cards || []; const order = want.map((c) => c.id); const rank = (id) => { const i = order.indexOf(id); return i < 0 ? 99 : i; };
    const cur = refList('cards').map((c) => Object.assign({}, c));
    want.forEach((w) => {
      const c = cur.find((x) => x.id === w.id);
      if (!c) { cur.push(JSON.parse(JSON.stringify(w))); return; }
      Object.assign(c, { name: w.name, product: w.product, perks: (w.perks || []).slice(), perksNote: w.perksNote || '' });
      if (w.short) c.short = w.short;
      if (!c.benefit && w.benefit) c.benefit = w.benefit;
    });
    cur.sort((a, b) => rank(a.id) - rank(b.id));
    const lim = refList('limits').map((l) => Object.assign({}, l)); const sl = (window.GF_SEED.ref.limits || []);
    lim.forEach((l) => { const s = sl.find((x) => x.id === l.id); if (s) l.name = s.name; if (l.id === 'lotte') l.ids = ['lotte']; });
    store.setRef('cards', cur); store.setRef('limits', lim); store.setRef('rev', 3);
  }
}

/* ================= shared helpers ================= */
const ds = (dt) => dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
const ymShift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const salaryDay = (y, m) => { const d = new Date(y, m - 1, 25).getDay(); return d === 0 ? 23 : d === 6 ? 24 : 25; };
function bizDay(y, m, day) { const dim = new Date(y, m, 0).getDate(); const dt = new Date(y, m - 1, Math.min(day, dim)); while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1); return dt; }
const CARD_COLOR = { '농협': '#1a6b45', '롯데': '#a33b2b', '신한': '#1d4e89', '삼성': '#3a4150', '현대': '#5c6570', '국민': '#8a5a12', '기타': '#6e655b' };
function cardUse(cd, ym) {
  return cardTxs().filter((t) => t.card === cd.card && ymOf(t.date) === ym && cardIdOf(t) === cd.id).reduce((a, t) => a + (+t.amount || 0), 0);
}
const apCardId = (a) => (a.cardId && cardsOf(a.card).some((c) => c.id === a.cardId) ? a.cardId : defaultCardId(a.card, ''));

/* ================= calendar ================= */
function calEvents(ym) {
  const [y, m] = ym.split('-').map(Number); const c = cfg(); const ev = []; const dim = new Date(y, m, 0).getDate();
  const add = (date, o) => ev.push(Object.assign({ date }, o));
  add(ym + '-' + pad(salaryDay(y, m)), { kind: 'in', label: '급여 입금', sub: '우리 통장 · 주말이면 직전 금요일', amount: c.salary_man * 1e4 });
  refList('plan').forEach((p) => { if (!p.day || p.optional || /카드대금/.test(p.item)) return; add(ds(bizDay(y, m, p.day)), { kind: 'plan', label: p.item, sub: '제2계좌 이체 계획', amount: -p.man * 1e4 }); });
  const prev = ymShift(ym, -1);
  refList('cards').forEach((cd) => {
    if (!cd.payDay) return; const used = cardUse(cd, prev);
    add(ds(bizDay(y, m, cd.payDay)), { kind: 'card', label: cd.name + ' 결제', sub: (cd.product ? cd.product + ' · ' : '') + (used ? Number(prev.slice(5)) + '월 기록된 사용 기준 추정' : '기록된 사용 없음 · 금액 미정') + (cd.account ? ' · ' + cd.account : ''), amount: used ? -used : null });
  });
  refList('autopays').forEach((a) => { if (!a.day) return; add(ym + '-' + pad(Math.min(a.day, dim)), { kind: 'auto', label: a.name, sub: cardLabel(a.card, apCardId(a)) + ' 자동결제', amount: -(+a.amount || 0) }); });
  const tax = S.data.ref.tax || {};
  (tax.schedule || []).forEach((t) => { if (ymOf(t.date) === ym) add(t.date, { kind: 'tax', label: t.name, sub: '세금 (예정)', amount: -t.man * 1e4 }); });
  (tax.paid || []).forEach((t) => { if (ymOf(t.date) === ym) add(t.date, { kind: 'tax', label: t.name, sub: '세금 (납부)', amount: -t.man * 1e4 }); });
  return ev;
}
const KIND_CLASS = { in: 'ev-in', card: 'ev-card', auto: 'ev-auto', plan: 'ev-plan', tax: 'ev-tax', tx: 'ev-tx' };
function renderCal() {
  if (!S.calYm) S.calYm = monthsBack(1)[0]; if (!S.calDay) S.calDay = todayStr();
  const ym = S.calYm; const [y, m] = ym.split('-').map(Number);
  $('calTitle').textContent = y + '년 ' + m + '월';
  const ev = calEvents(ym); const byDay = d3.group(ev, (e) => e.date);
  const tx = txs().filter((t) => ymOf(t.date) === ym); const txByDay = d3.group(tx, (t) => t.date);
  const g = $('calGrid'); g.replaceChildren();
  ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) => g.append(h('div', { class: 'dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: d })));
  const first = new Date(y, m - 1, 1).getDay(); const dim = new Date(y, m, 0).getDate();
  for (let i = 0; i < first; i++) g.append(h('div'));
  for (let d = 1; d <= dim; d++) {
    const date = ym + '-' + pad(d); const es = byDay.get(date) || []; const ts = txByDay.get(date) || []; const dow = new Date(y, m - 1, d).getDay();
    const kinds = [...new Set(es.map((e) => e.kind))]; if (ts.length) kinds.push('tx');
    const out = d3.sum(es.filter((e) => e.amount < 0), (e) => e.amount);
    const btn = h('button', { type: 'button', class: 'day-c' + (date === todayStr() ? ' today' : '') + (date === S.calDay ? ' sel' : ''), 'aria-label': m + '월 ' + d + '일, 일정 ' + es.length + '건, 거래 ' + ts.length + '건', onclick: () => { S.calDay = date; renderCal(); } },
      h('span', { class: 'dnum' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''), text: d }),
      h('span', { class: 'dots' }, kinds.map((k) => h('i', { class: KIND_CLASS[k] }))),
      out ? h('span', { class: 'damt', text: man(out) }) : null);
    g.append(btn);
  }
  const sel = S.calDay; const [sy, sm, sd] = sel.split('-').map(Number);
  $('dayTitle').textContent = (ymOf(sel) === ym ? sm + '월 ' + sd + '일' : sel) + ' 일정과 거래';
  const list = $('dayList'); list.replaceChildren();
  const selEv = ymOf(sel) === ym ? (byDay.get(sel) || []) : calEvents(ymOf(sel)).filter((e) => e.date === sel);
  const selTx = txs().filter((t) => t.date === sel).sort(txSort);
  if (!selEv.length && !selTx.length) list.append(h('p', { class: 'empty', text: '이 날은 일정이나 기록된 거래가 없습니다.' }));
  selEv.forEach((e) => list.append(h('div', { class: 'ev' }, h('i', { class: KIND_CLASS[e.kind] }), h('span', { class: 't' }, e.label, h('small', { text: e.sub })), h('span', { class: 'a', text: e.amount == null ? '미정' : (e.amount > 0 ? '+' : '') + won(e.amount) + '원' }))));
  selTx.forEach((t) => list.append(h('div', { class: 'ev' }, h('i', { class: 'ev-tx' }), h('span', { class: 't' }, t.desc || '(내용 없음)', h('small', { text: [t.time, t.type === 'card' ? cardLabel(t.card, cardIdOf(t)) : acctLabel(t.account), '기록된 거래'].filter(Boolean).join(' · ') }), t.memo ? h('small', { class: 'memo-line', text: '메모 · ' + t.memo }) : null), h('span', { class: 'a', text: (t.type === 'bank' && t.amount > 0 ? '+' : '') + won(t.amount) + '원' }))));
  $('calSumTitle').textContent = m + '월 예정 합계';
  const sumK = (k) => d3.sum(ev.filter((e) => e.kind === k && e.amount != null), (e) => e.amount);
  $('calSum').replaceChildren(...[['급여', sumK('in')], ['이체·고정', sumK('plan')], ['카드 결제 (추정)', sumK('card')], ['자동결제', sumK('auto')], ['세금', sumK('tax')]]
    .map(([k, v]) => h('div', {}, h('span', { class: 'sub', text: k }), h('b', { text: (v > 0 ? '+' : '') + man(v) + '만' }))));
}
$('calPrev').addEventListener('click', () => { S.calYm = ymShift(S.calYm, -1); S.calDay = S.calYm + '-01'; renderCal(); });
$('calNext').addEventListener('click', () => { S.calYm = ymShift(S.calYm, 1); S.calDay = S.calYm + '-01'; renderCal(); });

/* ================= cards ================= */
function renderCards() {
  const g = $('cardGrid'); g.replaceChildren(); const ym = monthsBack(1)[0]; const prev = ymShift(ym, -1);
  const cards = refList('cards');
  if (!cards.length) { g.append(h('p', { class: 'empty', text: '카드 정보가 없습니다.' })); }
  cards.forEach((cd, idx) => {
    const used = cardUse(cd, ym) / 1e4, usedPrev = cardUse(cd, prev) / 1e4;
    const sibs = cardsOf(cd.card).filter((x) => !/세금/.test(x.product || '')); const lim = /세금/.test(cd.product || '') ? null : refList('limits').find((l) => (l.members || []).includes(cd.card) && (l.ids ? l.ids.includes(cd.id) : sibs.length <= 1));
    const aps = refList('autopays').filter((a) => a.card === cd.card && apCardId(a) === cd.id); const apSum = d3.sum(aps, (a) => +a.amount) / 1e4;
    const box = h('div', { class: 'cc' }); box.style.setProperty('--cc', CARD_COLOR[cd.card] || 'var(--accent)');
    box.append(h('div', { class: 'cc-top' }, h('div', {}, h('b', { text: cd.name }), h('small', { text: cd.product && cd.product !== cd.name ? cd.product : cardShortIssuer(cd) })),
      h('button', { class: 'btn small ghost', type: 'button', text: S.cardEdit === cd.id ? '닫기' : '편집', onclick: () => { S.cardEdit = S.cardEdit === cd.id ? null : cd.id; renderCards(); } })));
    box.append(h('div', { class: 'cc-grid' },
      h('div', {}, h('span', { text: '결제일' }), h('b', { text: cd.payDay ? '매월 ' + cd.payDay + '일' : '—' })),
      h('div', {}, h('span', { text: '결제계좌' }), h('b', { text: cd.account || '—' })),
      h('div', {}, h('span', { text: Number(ym.slice(5)) + '월 사용 (기록)' }), h('b', { text: used.toFixed(1) + '만' + (lim ? ' / ' + lim.cap_man + '만' : '') })),
      h('div', {}, h('span', { text: Number(prev.slice(5)) + '월 사용 (기록)' }), h('b', { text: usedPrev.toFixed(1) + '만' })),
      h('div', {}, h('span', { text: '자동결제' }), h('b', { text: aps.length ? aps.length + '건 · ' + apSum.toFixed(1) + '만' : '없음' })),
      h('div', {}, h('span', { text: '연회비' }), h('b', { text: cd.annualFee ? won(cd.annualFee) + '원' : '—' }))));
    if (lim && lim.target_man > 0) {
      const p = used / lim.target_man * 100; const bi = h('i', { class: p >= 100 ? '' : 'warn' }); bi.style.width = Math.min(100, p) + '%';
      box.append(h('div', {}, h('span', { class: 'sub', text: '실적 목표 ' + lim.target_man + '만 대비 ' + Math.round(p) + '%' }), h('div', { class: 'bar' }, bi)));
    }
    if (cd.perks && cd.perks.length) box.append(h('div', { class: 'perks' }, h('b', { text: '주요 혜택' }), h('ul', {}, cd.perks.map((p) => h('li', { text: p }))), cd.perksNote ? h('small', { class: 'sub', text: cd.perksNote }) : null));
    if (cd.benefit) box.append(h('p', {}, h('b', { text: '실적 · 조건 ' }), cd.benefit));
    if (cd.memo) box.append(h('p', { class: 'sub', text: cd.memo }));
    if (S.cardEdit === cd.id) {
      const f = (label, key, type) => h('label', { class: 'fld' }, label, h('input', { type: type || 'text', value: cd[key] == null ? '' : cd[key], 'data-k': key }));
      const form = h('form', { class: 'edit', onsubmit: async (e) => {
        e.preventDefault(); const next = Object.assign({}, cd);
        form.querySelectorAll('[data-k]').forEach((inp) => { const k = inp.dataset.k; next[k] = k === 'payDay' || k === 'annualFee' ? (Number(toNum(inp.value)) || 0) : inp.value.trim(); });
        const list = refList('cards').slice(); list[idx] = next; S.cardEdit = null; await store.setRef('cards', list); toast('카드 정보를 저장했습니다.');
      } }, f('이름', 'name'), f('상품명', 'product'), f('짧은 이름', 'short'), f('결제일 (일)', 'payDay', 'number'), f('결제계좌', 'account'), f('혜택 · 실적 조건', 'benefit'), f('연회비 (원)', 'annualFee'), f('메모', 'memo'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit', text: '저장' }),
          h('button', { class: 'btn ghost danger', type: 'button', text: S.armed === 'cd' + cd.id ? '삭제 확인' : '카드 삭제', onclick: async () => { if (S.armed !== 'cd' + cd.id) { S.armed = 'cd' + cd.id; renderCards(); return; } S.armed = null; S.cardEdit = null; await store.setRef('cards', refList('cards').filter((x) => x.id !== cd.id)); } })));
      box.append(form);
    }
    g.append(box);
  });
  g.append(h('button', { class: 'btn', type: 'button', text: '+ 카드 추가', onclick: async () => { const id = 'c' + uid(); await store.setRef('cards', refList('cards').concat([{ id, card: '기타', name: '새 카드', product: '', payDay: 14, account: '', benefit: '', annualFee: 0, memo: '' }])); S.cardEdit = id; renderCards(); } }));
  // auto-pays
  const all = refList('autopays'); const order = all.map((a, i) => ({ a, i })).sort((x, y) => (x.a.card === y.a.card ? (x.a.day || 0) - (y.a.day || 0) : CARDS.indexOf(x.a.card) - CARDS.indexOf(y.a.card)));
  const groups = d3.rollups(all, (v) => d3.sum(v, (x) => +x.amount), (x) => x.card);
  $('autoPays').replaceChildren(h('thead', {}, h('tr', {}, h('th', { text: '카드' }), h('th', { text: '항목' }), h('th', { class: 'n', text: '결제일' }), h('th', { class: 'n', text: '월(원)' }), h('th'))),
    h('tbody', {}, order.map(({ a, i }) => h('tr', {}, h('td', { text: cardLabel(a.card, apCardId(a)) }), h('td', { text: a.name }), h('td', { class: 'n', text: a.day ? a.day + '일' : '' }), h('td', { class: 'n', text: won(+a.amount) }),
      h('td', { class: 'n' }, h('button', { class: 'btn small ghost danger', type: 'button', text: S.armed === 'ap' + i ? '확인' : '삭제', onclick: async () => { if (S.armed !== 'ap' + i) { S.armed = 'ap' + i; renderCards(); return; } S.armed = null; await store.setRef('autopays', all.filter((_, j) => j !== i)); } }))))),
    h('tfoot', {}, h('tr', {}, h('td', { text: '합계' }), h('td', { text: groups.map(([k, v]) => k + ' ' + (v / 1e4).toFixed(1) + '만').join(' · ') }), h('td'), h('td', { class: 'n', text: won(d3.sum(all, (x) => +x.amount)) }), h('td'))));
  const sel = $('apCard'); const cur = sel.value; sel.replaceChildren(...cardOptions(cur));
}
$('apForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const amt = toNum($('apAmt').value); const day = Number($('apDay').value);
  if (!Number.isFinite(amt) || amt <= 0 || !(day >= 1 && day <= 31) || !$('apName').value.trim()) { toast('항목, 결제일, 금액을 확인하세요.'); return; }
  const ac = splitCardVal($('apCard').value); await store.setRef('autopays', refList('autopays').concat([{ card: ac.card || '기타', cardId: ac.id, name: $('apName').value.trim(), amount: Math.round(amt), day }]));
  $('apName').value = ''; $('apAmt').value = ''; $('apDay').value = ''; toast('자동결제를 추가했습니다.');
});

/* ================= tax ================= */
function depositsBetween(from, to) {
  // 매달 10일 적립 기준: from(제외)~to(포함) 사이 10일의 개수
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00'); let n = 0;
  const d = new Date(a.getFullYear(), a.getMonth(), 10); if (d <= a) d.setMonth(d.getMonth() + 1);
  while (d <= b && n < 240) { n++; d.setMonth(d.getMonth() + 1); }
  return n;
}
function renderTax() {
  const tax = S.data.ref.tax || {}; const today = todayStr(); const year = today.slice(0, 4);
  const paid = (tax.paid || []).map((p) => Object.assign({}, p));
  const lastPaid = paid.reduce((a, p) => (p.date > a ? p.date : a), '0000');
  txs().filter((t) => t.category === '세금' && t.date > lastPaid).forEach((t) => paid.push({ date: t.date, name: (t.desc || '세금') + ' (기록)', man: Math.abs(+t.amount) / 1e4 }));
  paid.sort((a, b) => (a.date < b.date ? 1 : -1));
  const sched = (tax.schedule || []).map((s, i) => Object.assign({ i }, s)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const future = sched.filter((s) => s.date >= today);
  const yearEnd = ds(new Date(+today.slice(0, 4) + 1, +today.slice(5, 7) - 1, +today.slice(8)));
  const next12 = future.filter((s) => s.date <= yearEnd); const monthly = +tax.monthly_man || 0;
  const reserve = tax.reserve_man == null || tax.reserve_man === '' ? null : +tax.reserve_man; const base = tax.reserveAt || today;
  let cum = 0; let shortAt = null;
  const proj = sched.map((s) => {
    if (s.date < today || reserve == null) return Object.assign({ left: null }, s);
    cum += +s.man; const left = reserve + monthly * depositsBetween(base, s.date) - cum; if (left < 0 && !shortAt) shortAt = s.date; return Object.assign({ left }, s);
  });
  const k = $('taxKpis'); k.replaceChildren();
  const kpi = (l, v, unit, s, cls) => k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: l }), h('span', { class: 'v' }, v, unit ? h('small', { text: unit }) : null), h('span', { class: 's' + (cls ? ' ' + cls : ''), text: s })));
  kpi(year + '년 납부', d3.sum(paid.filter((p) => p.date.startsWith(year)), (p) => +p.man).toFixed(1), '만 원', paid.filter((p) => p.date.startsWith(year)).length + '건');
  const nx = future[0]; kpi('다음 납부', nx ? (+nx.man).toFixed(1) : '—', nx ? '만 원' : '', nx ? nx.date + ' · ' + nx.name : '예정 없음');
  kpi('12개월 예정', d3.sum(next12, (s) => +s.man).toFixed(1), '만 원', '적립 ' + (monthly * 12) + '만 원 대비 ' + (monthly * 12 - d3.sum(next12, (s) => +s.man) >= 0 ? '여유 ' : '부족 ') + Math.abs(monthly * 12 - d3.sum(next12, (s) => +s.man)).toFixed(1) + '만', monthly * 12 >= d3.sum(next12, (s) => +s.man) ? 'ok' : 'bad');
  kpi('세금적립 잔액', reserve == null ? '—' : reserve.toFixed(0), reserve == null ? '' : '만 원', reserve == null ? '잔액을 입력하세요' : shortAt ? shortAt + ' 납부 때 부족' : '예정 세금 모두 충당 가능', reserve == null ? '' : shortAt ? 'bad' : 'ok');
  if (document.activeElement !== $('taxRes')) $('taxRes').value = reserve == null ? '' : reserve;
  if (document.activeElement !== $('taxMon')) $('taxMon').value = monthly || '';
  $('taxResNote').textContent = reserve == null ? '기업·하나 세금적립 통장의 현재 잔액을 넣으면 앞으로 세금을 낼 수 있는지 계산합니다.' : (tax.reserveAt || '') + ' 입력 기준 잔액 ' + reserve + '만 원, 매달 10일 ' + monthly + '만 원 적립으로 계산합니다.';
  $('taxSched').replaceChildren(h('thead', {}, h('tr', {}, h('th', { text: '납부일' }), h('th', { text: '항목' }), h('th', { class: 'n', text: '금액(만 원)' }), h('th', { class: 'n', text: '납부 후 적립 잔액' }), h('th'))),
    h('tbody', {}, proj.map((s) => h('tr', { class: s.left != null && s.left < 0 ? 'short' : s.date < today ? 'opt' : '' }, h('td', { text: s.date }), h('td', { text: s.name }),
      h('td', { class: 'n' }, h('input', { class: 'inl', value: s.man, inputMode: 'decimal', 'aria-label': s.name + ' 금액', onchange: async (e) => { const v = toNum(e.target.value); if (!Number.isFinite(v)) return; const list = (tax.schedule || []).slice(); list[s.i] = Object.assign({}, list[s.i], { man: v }); await store.setRef('tax', Object.assign({}, tax, { schedule: list })); toast('저장했습니다.'); } })),
      h('td', { class: 'n', text: s.left == null ? '—' : s.left.toFixed(1) + '만' }),
      h('td', { class: 'n' }, h('button', { class: 'btn small ghost danger', type: 'button', text: S.armed === 'tx' + s.i ? '확인' : '삭제', onclick: async () => { if (S.armed !== 'tx' + s.i) { S.armed = 'tx' + s.i; renderTax(); return; } S.armed = null; await store.setRef('tax', Object.assign({}, tax, { schedule: (tax.schedule || []).filter((_, j) => j !== s.i) })); } }))))));
  $('taxPaid').replaceChildren(h('thead', {}, h('tr', {}, h('th', { text: '납부일' }), h('th', { text: '항목' }), h('th', { class: 'n', text: '금액(만 원)' }))),
    h('tbody', {}, paid.map((p) => h('tr', {}, h('td', { text: p.date }), h('td', { text: p.name }), h('td', { class: 'n', text: (+p.man).toFixed(1) })))));
}
$('taxResForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const r = toNum($('taxRes').value); const mo = toNum($('taxMon').value); const tax = S.data.ref.tax || {};
  await store.setRef('tax', Object.assign({}, tax, { reserve_man: Number.isFinite(r) ? r : null, reserveAt: Number.isFinite(r) ? todayStr() : null, monthly_man: Number.isFinite(mo) ? mo : (tax.monthly_man || 0) }));
  toast('저장했습니다.');
});
$('taxAddForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const v = toNum($('taxAmt').value); if (!Number.isFinite(v) || !$('taxDate').value || !$('taxName').value.trim()) { toast('납부일, 항목, 금액을 확인하세요.'); return; }
  const tax = S.data.ref.tax || {}; await store.setRef('tax', Object.assign({}, tax, { schedule: (tax.schedule || []).concat([{ date: $('taxDate').value, name: $('taxName').value.trim(), man: v }]) }));
  $('taxName').value = ''; $('taxAmt').value = ''; toast('추가했습니다.');
});

/* ================= render all ================= */
let rT = 0;
function fillChoosers() {
  const ch = cardChoices(); const sig = ch.map((o) => o.v + o.label).join(',');
  const cc = $('capCard'); if (cc && cc.dataset.sig !== sig) { const cur = cc.value; cc.dataset.sig = sig; cc.replaceChildren(h('option', { value: '', text: '자동 인식' }), ...ch.map((o) => h('option', { value: o.v, text: o.label }))); cc.value = cur; }
  const mt = $('mType'); if (mt && mt.dataset.sig !== sig) { const cur = mt.value; mt.dataset.sig = sig;
    mt.replaceChildren(...['우리', '농협', '신한'].map((k) => h('option', { value: k, text: acctLabel(k) })), ...ch.map((o) => h('option', { value: 'card:' + o.v, text: '카드 · ' + o.label }))); if (cur) mt.value = cur; }
}
function render() {
  cancelAnimationFrame(rT);
  rT = requestAnimationFrame(() => {
    const ser = series(); const cur = ser[ser.length - 1];
    fillChoosers(); renderTop(cur); renderKpis(ser); renderChart(ser); renderLimits(); renderFlow(); renderQueue(false); renderTx(); renderCapLog(); renderPlan(ser); renderCal(); renderCards(); renderTax();
  });
}
function setTab(t) {
  S.tab = t; document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll('section[data-view]').forEach((s) => { s.hidden = s.id !== t; });
  if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
  render();
}

/* ================= events ================= */
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== S.tab) setTab(t); });
$('txSearch').addEventListener('input', (e) => { S.txq = e.target.value.trim().toLowerCase(); renderTx(true); });
document.querySelectorAll('#txFilter .chip').forEach((b) => b.addEventListener('click', () => { S.txf = b.dataset.f; document.querySelectorAll('#txFilter .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); S.editId = null; S.memoId = null; renderTx(true); }));
$('surplusSel').addEventListener('change', (e) => { S.surplus = Number(e.target.value); render(); });
['pickFile', 'pickCam'].forEach((id) => $(id).addEventListener('change', (e) => { if (e.target.files.length) addImages(e.target.files); e.target.value = ''; }));
$('autoSave').checked = lsGet(LS.auto, '1') === '1';
$('autoSave').addEventListener('change', (e) => lsSet(LS.auto, e.target.checked ? '1' : '0'));
const pz = $('pasteZone');
function filesFrom(dt) { const out = []; if (!dt) return out; if (dt.files && dt.files.length) out.push(...dt.files); else if (dt.items) for (const it of dt.items) if (it.kind === 'file') { const f = it.getAsFile(); if (f) out.push(f); } return out.filter((f) => /^image\//.test(f.type)); }
async function harvestImgs() {
  const imgs = [...pz.querySelectorAll('img')]; if (!imgs.length) { pz.textContent = ''; return; }
  const files = [];
  for (const im of imgs) { try { const i = await loadImg(im.src); const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight; cv.getContext('2d').drawImage(i, 0, 0); const b = await new Promise((r) => cv.toBlob(r, 'image/png')); if (b) files.push(new File([b], 'paste.png', { type: 'image/png' })); } catch (e) { } }
  pz.textContent = ''; if (files.length) addImages(files); else toast('붙여넣은 내용에서 이미지를 찾지 못했습니다. 사진 선택을 이용하세요.');
}
document.addEventListener('paste', (e) => {
  const f = filesFrom(e.clipboardData);
  if (f.length) { e.preventDefault(); pz.textContent = ''; addImages(f); return; }
  if (e.target === pz || pz.contains(e.target)) setTimeout(harvestImgs, 50);
});
pz.addEventListener('beforeinput', (e) => {
  if (['insertFromPaste', 'insertReplacementText', 'insertFromDrop'].includes(e.inputType)) { const f = filesFrom(e.dataTransfer); if (f.length) { e.preventDefault(); addImages(f); } else setTimeout(harvestImgs, 60); }
  else if (e.inputType && e.inputType.startsWith('insert') && !e.dataTransfer) e.preventDefault();
});
pz.addEventListener('input', () => { if (pz.querySelector('img')) harvestImgs(); else if (pz.textContent.trim()) { pz.textContent = ''; toast('이미지를 붙여넣어 주세요.'); } });
['dragenter', 'dragover'].forEach((t) => pz.addEventListener(t, (e) => { e.preventDefault(); pz.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => pz.addEventListener(t, (e) => { e.preventDefault(); pz.classList.remove('over'); }));
pz.addEventListener('drop', (e) => { const f = filesFrom(e.dataTransfer); if (f.length) addImages(f); });
$('mDate').value = todayStr();
$('manForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tv = $('mType').value; const isCard = tv.startsWith('card:'); const mcv = isCard ? splitCardVal(tv.slice(5)) : { card: '', id: '' }; const amt = toNum($('mAmt').value); const bal = toNum($('mBal').value);
  if (!Number.isFinite(amt) || amt === 0 || !$('mDate').value || !$('mDesc').value.trim()) { toast('날짜, 내용, 금액을 확인하세요.'); return; }
  const t = { type: isCard ? 'card' : 'bank', account: isCard ? null : tv, card: isCard ? (mcv.card || '기타') : null, cardId: isCard ? (mcv.id || defaultCardId(mcv.card || '기타', '') || null) : null, memo: $('mMemo').value.trim(), date: $('mDate').value, time: $('mTime').value || '', desc: $('mDesc').value.trim(),
    amount: Math.round(amt), balance: !isCard && Number.isFinite(bal) ? Math.round(bal) : null, category: '기타', seq: 0, source: 'manual', savedAt: new Date().toISOString() };
  const probe = [{ date: t.date, time: t.time, desc: t.desc, amount: t.amount, balance: t.balance, card: t.card }];
  matchRows(probe, { screen: t.type, account: t.account, check: {} });
  if (probe[0].m.st === 'same') { toast('이미 같은 거래가 있습니다. 거래 목록에서 확인하세요.'); return; }
  await store.setTx(uniqueKey(t, (k) => !!S.data.tx[k]), t); $('mAmt').value = ''; $('mBal').value = ''; $('mDesc').value = ''; $('mMemo').value = ''; toast('추가했습니다.');
});
$('openSettings').addEventListener('click', () => { $('sCode').value = S.code; $('sPass').value = lsGet(LS.pass, ''); $('sKey').value = lsGet(LS.key, ''); $('settings').showModal(); });
$('sPush').addEventListener('click', async () => {
  const n = Object.keys(S.data.tx || {}).length;
  if (!S.docRef) { toast('동기화에 연결되지 않았습니다.'); return; }
  let ok = false; try { ok = window.confirm('이 기기에 보이는 데이터(거래 ' + n + '건)로 클라우드의 현재 코드 데이터를 덮어씁니다.\n다른 기기에서 입력한 최신 내용이 있다면 사라집니다. 계속할까요?'); } catch (e) { }
  if (ok) { $('sPush').disabled = true; await pushToCloud(S.code); $('sPush').disabled = false; }
});
$('setForm').addEventListener('submit', (e) => {
  if (e.submitter && e.submitter.value !== 'save') return;
  lsSet(LS.pass, $('sPass').value.trim()); lsSet(LS.key, $('sKey').value.trim());
  const code = $('sCode').value.trim();
  if (code && code !== S.code) {
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(code)) { toast('동기화 코드는 영문·숫자 4~40자입니다.'); return; }
    const n = Object.keys(S.data.tx || {}).length; let copy = false;
    try { copy = n > 0 && window.confirm('이 기기의 데이터(거래 ' + n + '건)를 새 코드로 옮길까요?\n\n[확인] 이 기기 데이터를 새 코드로 복사 (새 코드에 이미 있는 데이터는 덮어씀)\n[취소] 새 코드에 이미 있는 데이터를 그대로 사용'); } catch (e) { }
    lsSet(LS.push, copy ? S.code : ''); lsSet(LS.code, code); location.reload(); return;
  }
  toast('설정을 저장했습니다.');
});
// 창 크기뿐 아니라 PC 배치가 바뀌어 차트 칸 폭이 달라질 때도 다시 그림
let rzT = 0, rzW = 0;
const rzRun = () => { clearTimeout(rzT); rzT = setTimeout(() => { const w = $('chart').clientWidth; if (S.tab === 'home' && w && w !== rzW) { rzW = w; renderChart(series()); } }, 150); };
window.addEventListener('resize', rzRun);
if (window.ResizeObserver) new ResizeObserver(rzRun).observe($('chart'));
// PC 키보드: 달력 탭에서 ← → 로 달 이동
document.addEventListener('keydown', (e) => {
  if (S.tab !== 'cal' || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target; if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); $('calPrev').click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); $('calNext').click(); }
});

/* ================= start ================= */
(function start() {
  const t0 = location.hash.slice(1); setTab(TABS.includes(t0) ? t0 : 'home');
  connect();
})();
