"use strict";
/* Gravo Finance — 마통 관리
   저장: Firebase Firestore (동기화 코드별 문서 하나) + 이 기기 localStorage 사본
   인식: /api/recognize (Vercel 서버리스 → Anthropic API) */

const FB = { apiKey: 'AIzaSyAN7s01gb9AsmeMVdgWGY6pllX9cm1SLJ0', projectId: 'endoapp-cc066' };
const COLL = 'gravo_finance_v2';
const LS = { code: 'gf_mt_code', pass: 'gf_mt_pass', key: 'gf_mt_userkey', cache: 'gf_mt_cache', auto: 'gf_mt_autosave' };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } };

const S = {
  data: { ref: {}, tx: {}, captures: {} }, fb: null, docRef: null, code: lsGet(LS.code, 'gravo2026'), sync: 'off', ready: false,
  files: {}, edits: {}, ctl: {}, running: new Set(), thumbs: {}, tab: 'home', txf: 'all', armed: null, view: null, surplus: null, qsig: '',
};
const CARDS = ['농협', '롯데', '신한', '삼성', '현대', '국민', '기타'];
const CARD_CODE = { '농협': 'nh', '롯데': 'lotte', '신한': 'shinhan', '삼성': 'samsung', '현대': 'hyundai', '국민': 'kb', '기타': 'etc' };
const ACCT_CODE = { '우리': 'woori', '농협': 'nh', '신한': 'shinhan', '기타': 'etc' };
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
async function connect() {
  cacheLoad(); S.ready = Object.keys(S.data.ref || {}).length > 0; render();
  if (typeof firebase === 'undefined') { setSync('off', '동기화 서비스를 불러오지 못했습니다. 이 기기에만 저장 중입니다.'); if (!S.ready) { S.data = seedData(); cacheSave(); S.ready = true; render(); } return; }
  setSync('connecting');
  try {
    let app; try { app = firebase.app('gravo-mt'); } catch (e) { app = firebase.initializeApp({ apiKey: FB.apiKey, projectId: FB.projectId, authDomain: FB.projectId + '.firebaseapp.com' }, 'gravo-mt'); }
    S.fb = firebase.firestore(app);
    S.docRef = S.fb.collection(COLL).doc(S.code + '__mt');
    const snap = await S.docRef.get();
    if (!snap.exists) {
      const base = S.ready ? S.data : seedData();
      const mig = await migrateOld(S.fb); Object.assign(base.ref, mig);
      await S.docRef.set(Object.assign({}, base, { createdAt: Date.now() }));
      S.data = base; S.ready = true; cacheSave(); render();
    }
    S.docRef.onSnapshot((d) => {
      if (!d.exists) return; const v = d.data();
      S.data = { ref: v.ref || {}, tx: v.tx || {}, captures: v.captures || {} }; S.ready = true; cacheSave(); setSync('ok'); render();
    }, (err) => { console.warn(err); setSync('error'); });
  } catch (e) {
    console.warn(e); setSync('error', '동기화 연결 실패 (' + (e.code || e.message) + '). 이 기기에만 저장 중입니다.');
    if (!S.ready) { S.data = seedData(); cacheSave(); S.ready = true; render(); }
  }
}

/* ================= keys & reference ================= */
const hash = (s) => { let x = 5381; for (const c of String(s)) x = ((x * 33) ^ c.codePointAt(0)) >>> 0; return x.toString(36); };
function txKey(r) {
  const d = String(r.date).replace(/-/g, ''); const t = String(r.time || '').replace(':', '') || 'x';
  const a = (r.amount < 0 ? 'm' : 'p') + Math.abs(Math.round(r.amount));
  if (r.type === 'card') return ['c', CARD_CODE[r.card] || 'etc', d, t, a, hash(r.desc || '')].join('-');
  const b = r.balance == null ? 'x' : (r.balance < 0 ? 'm' : 'p') + Math.abs(Math.round(r.balance));
  return ['b', ACCT_CODE[r.account] || 'etc', d, t, a, b].join('-');
}
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
function cardUsed(members, months) { return txs().filter((t) => t.type === 'card' && members.includes(t.card) && months.includes(ymOf(t.date))).reduce((a, t) => a + (+t.amount || 0), 0); }

/* ================= render: top + KPIs ================= */
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
  k.append(h('div', { class: 'kpi' }, h('span', { class: 'l', text: '농협카드 3개월 실적' }), h('span', { class: 'v' }, nh.toFixed(1), h('small', { text: '/ ' + goal + '만' })), h('div', { class: 'bar' }, nb),
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
    const used = cardUsed(l.members || [], [ym]) / 1e4; const cap = +l.cap_man || 0; const tgt = +l.target_man || 0; const scale = Math.max(cap, used, 1);
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
function normCard(c) { const s = String(c || ''); if (!s || s === 'null') return null; if (/농협|NH|올바른/i.test(s)) return '농협'; if (/롯데|KT|SKYPASS/i.test(s)) return '롯데'; if (/신한|네이버/.test(s)) return '신한'; if (/삼성/.test(s)) return '삼성'; if (/현대|코스트코/.test(s)) return '현대'; if (/국민|KB/i.test(s)) return '국민'; return '기타'; }
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
  return { ok: best.ok, bad: best.bad };
}
function normalize(out, today) {
  const items = Array.isArray(out && out.items) ? out.items : [];
  const screen = ['bank', 'card'].includes(out && out.screen) ? out.screen : (items.some((i) => i && i.balance != null) ? 'bank' : 'card');
  const account = screen === 'bank' ? normAcct((out && (out.account || out.institution)) || '우리') : null;
  const seen = new Set(); const rows = [];
  items.forEach((it) => {
    if (!it) return; const amount = toNum(it.amount); const date = fixDate(it.date, today); if (!Number.isFinite(amount) || amount === 0 || !date) return;
    const bal = it.balance == null || it.balance === '' ? null : toNum(it.balance);
    const r = { include: true, date, time: fixTime(it.time), desc: String(it.desc || '').slice(0, 60), amount: Math.round(amount), balance: Number.isFinite(bal) ? Math.round(bal) : null,
      card: screen === 'card' ? (normCard(it.card) || '기타') : null, category: String(it.category || '기타').slice(0, 20) };
    const k = [r.date, r.time, r.amount, r.balance, r.desc].join('|'); if (seen.has(k)) return; seen.add(k); rows.push(r);
  });
  const sb = toNum(out && out.screen_balance);
  const res = { screen, account, rows, screenBalance: Number.isFinite(sb) ? sb : null, notes: String((out && out.notes) || '').slice(0, 300) };
  res.check = screen === 'bank' ? chainCheck(rows) : { ok: 0, bad: 0 };
  return res;
}
async function callApi(tiles) {
  const headers = { 'Content-Type': 'application/json' };
  const pass = lsGet(LS.pass, ''); if (pass) headers['x-app-passcode'] = pass;
  const key = lsGet(LS.key, ''); if (key) headers['x-user-api-key'] = key;
  const r = await fetch('/api/recognize', { method: 'POST', headers, body: JSON.stringify({ images: tiles, today: todayStr() }) });
  let data = {}; try { data = await r.json(); } catch (e) { }
  if (!r.ok) throw new Error(data.error || ('서버 오류 (' + r.status + ')'));
  return data.result;
}
async function recognize(id) {
  const src = S.files[id]; if (!src) { toast('원본 이미지가 이 기기에 없습니다. 캡처를 다시 올려주세요.'); return; }
  if (S.running.has(id)) return; S.running.add(id);
  try {
    await store.setCap(id, { status: 'recognizing', error: null });
    const img = await loadImg(src); const tiles = await makeTiles(img); const today = todayStr();
    const result = normalize(await callApi(tiles), today);
    delete S.edits[id];
    await store.setCap(id, { status: result.rows.length ? 'review' : 'failed', result, error: result.rows.length ? null : '거래를 찾지 못했습니다. 거래 목록이 보이게 캡처해 주세요.', recognizedAt: new Date().toISOString() });
    const auto = $('autoSave').checked;
    if (result.rows.length && auto && result.screen === 'bank' && result.check.ok > 0 && result.check.bad === 0 && result.rows.every((r) => r.balance != null)) {
      await saveRows(id, result, result.rows); toast(result.rows.length + '건 자동 반영 (잔액 검증 ' + result.check.ok + '곳 일치)');
    } else if (result.rows.length) toast('인식 완료. 확인 후 저장을 눌러주세요.');
  } catch (e) {
    await store.setCap(id, { status: 'failed', error: (e && e.message) || '인식하지 못했습니다.' });
  } finally { S.running.delete(id); renderQueue(true); }
}
async function addImages(files) {
  const list = [...files].filter((f) => f && /^image\//.test(f.type));
  if (!list.length) { toast('이미지만 올릴 수 있습니다.'); return; }
  for (const f of list) {
    const id = uid(); const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    S.files[id] = url;
    try { const img = await loadImg(url); const th = thumbOf(img); store.saveImg(id, th); } catch (e) { }
    await store.setCap(id, { status: 'recognizing', createdAt: new Date().toISOString(), name: f.name || '', device: navigator.userAgent.slice(0, 60) });
    recognize(id);
  }
}

/* ================= save ================= */
async function saveRows(capId, result, rows) {
  const keep = rows.filter((r) => r.include !== false && Number.isFinite(r.amount) && r.amount !== 0 && r.date);
  const now = new Date().toISOString(); const batch = {};
  keep.forEach((r, i) => {
    const bank = result.screen === 'bank';
    const t = { type: bank ? 'bank' : 'card', account: bank ? (result.account || '우리') : null, card: bank ? null : (r.card || '기타'), date: r.date, time: r.time || '', desc: r.desc || '',
      amount: r.amount, balance: bank && Number.isFinite(r.balance) ? r.balance : null, category: r.category || '기타', seq: keep.length - i, captureId: capId, source: 'capture', savedAt: now };
    batch[txKey(t)] = t;
  });
  Object.assign(S.data.tx, batch); cacheSave();
  await remote((d) => d.set({ tx: batch }, { merge: true }));
  const prev = S.data.captures[capId] || {};
  // 저장 후에는 인식 결과 상세를 지워 문서 크기를 작게 유지합니다 (거래는 tx에 남음)
  await store.replaceCap(capId, { status: 'saved', savedCount: keep.length, savedAt: now, createdAt: prev.createdAt || now, name: prev.name || '',
    result: { screen: result.screen, account: result.account || null, count: (result.rows || []).length } });
  delete S.edits[capId];
}

/* ================= render: queue ================= */
function editRows(c) { if (!S.edits[c.id]) S.edits[c.id] = JSON.parse(JSON.stringify((c.result && c.result.rows) || [])); return S.edits[c.id]; }
function statusPill(c) {
  const st = c.status;
  if (st === 'recognizing') return S.running.has(c.id) ? h('span', { class: 'pill run' }, h('span', { class: 'dot' }), '읽는 중…') : h('span', { class: 'pill', text: '다른 기기에서 인식 중이거나 중단됨' });
  if (st === 'review') return h('span', { class: 'pill warn', text: '확인 필요' });
  if (st === 'saved') return h('span', { class: 'pill ok', text: '반영 완료 ' + (c.savedCount || 0) + '건' });
  return h('span', { class: 'pill bad', text: '인식 실패' });
}
function imgEl(id, cls, alt, onclick) {
  const im = h('img', { class: cls, alt, onclick }); if (S.thumbs[id]) im.src = S.thumbs[id]; else store.getImg(id).then((u) => { if (u) im.src = u; });
  return im;
}
function renderQueue(force) {
  const active = caps().filter((c) => ['recognizing', 'review', 'failed'].includes(c.status)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const sig = active.map((c) => c.id + ':' + c.status + ':' + (c.recognizedAt || '')).join(',') + '|' + [...S.running].join(',');
  if (!force && sig === S.qsig) return; S.qsig = sig;
  const el = $('queue'); el.replaceChildren();
  active.forEach((c) => {
    const res = c.result || {};
    const kind = res.screen === 'bank' ? (res.account || '') + ' 통장' : res.screen === 'card' ? '카드 이용내역' : '캡처';
    const info = h('div', { class: 'q-info' }, h('span', { class: 'q-title', text: kind + (res.rows ? ' · ' + res.rows.length + '건' : '') }), statusPill(c));
    if (c.error) info.append(h('span', { class: 'sub', text: c.error }));
    if (c.status === 'review' && res.screen === 'bank') info.append(h('span', { class: 'sub', text: '잔액 검증: 일치 ' + ((res.check || {}).ok || 0) + '곳, 불일치 ' + ((res.check || {}).bad || 0) + '곳' }));
    if (res.notes) info.append(h('span', { class: 'sub', text: '메모: ' + res.notes }));
    const acts = h('div', { class: 'row' });
    if (!S.running.has(c.id) && S.files[c.id]) acts.append(h('button', { class: 'btn small', type: 'button', text: '다시 인식', onclick: () => recognize(c.id) }));
    acts.append(h('button', { class: 'btn small ghost', type: 'button', text: '버리기', onclick: () => discard(c) }));
    const box = h('div', { class: 'q' }, h('div', { class: 'q-head' }, imgEl(c.id, 'q-thumb', '캡처', () => openViewer(c.id)), info), acts);
    if (c.status === 'review') box.append(reviewTable(c), h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'button', text: '저장해서 반영', onclick: async (ev) => { ev.target.disabled = true; try { await saveRows(c.id, res, editRows(c)); toast('반영했습니다.'); } catch (e) { ev.target.disabled = false; toast('저장하지 못했습니다.'); } } })));
    el.append(box);
  });
}
function reviewTable(c) {
  const res = c.result; const rows = editRows(c); const bank = res.screen === 'bank'; const tb = h('tbody');
  const recheck = () => { if (!bank) return; chainCheck(rows); tb.querySelectorAll('[data-chk]').forEach((e, i) => { e.className = 'chk ' + (rows[i].chk || ''); e.textContent = rows[i].chk === 'ok' ? '일치' : rows[i].chk === 'bad' ? '불일치' : '—'; }); };
  rows.forEach((r) => {
    const num = (k) => k === 'amount' || k === 'balance';
    const inp = (key, type, cls) => h('input', { type: type || 'text', class: cls || '', value: num(key) ? (r[key] == null ? '' : won(r[key])) : (r[key] || ''), inputMode: num(key) ? 'numeric' : null,
      oninput: (e) => { const v = e.target.value; if (num(key)) { const n = toNum(v); r[key] = v.trim() === '' && key === 'balance' ? null : (Number.isFinite(n) ? Math.round(n) : r[key]); recheck(); } else r[key] = v; } });
    const cells = [h('td', { class: 'ck' }, h('input', { type: 'checkbox', checked: r.include !== false, 'aria-label': '저장에 포함', onchange: (e) => { r.include = e.target.checked; recheck(); } })),
      h('td', {}, inp('date', 'date')), h('td', { style: 'width:72px' }, inp('time')), h('td', {}, inp('desc')), h('td', { style: 'width:120px' }, inp('amount', 'text', 'num'))];
    if (bank) cells.push(h('td', { style: 'width:130px' }, inp('balance', 'text', 'num')), h('td', {}, h('span', { 'data-chk': '1', class: 'chk ' + (r.chk || ''), text: r.chk === 'ok' ? '일치' : r.chk === 'bad' ? '불일치' : '—' })));
    else cells.push(h('td', { style: 'width:88px' }, h('select', { onchange: (e) => { r.card = e.target.value; } }, CARDS.map((k) => h('option', { value: k, text: k, selected: r.card === k })))));
    cells.push(h('td', { style: 'width:104px' }, h('select', { onchange: (e) => { r.category = e.target.value; } }, (bank ? BANK_CATS : CARD_CATS).map((k) => h('option', { value: k, text: k, selected: r.category === k })))));
    tb.append(h('tr', {}, cells));
  });
  const head = ['', '날짜', '시각', '내용', bank ? '금액(입금+)' : '금액(결제+)'].concat(bank ? ['잔액', '검증'] : ['카드']).concat(['분류']);
  return h('div', { class: 'scroll-x' }, h('table', { class: 'rv' }, h('thead', {}, h('tr', {}, head.map((t) => h('th', { text: t })))), tb));
}
async function discard(c) {
  if (S.armed !== 'd' + c.id) { S.armed = 'd' + c.id; toast('한 번 더 누르면 지웁니다. 저장된 거래는 남습니다.'); setTimeout(() => { if (S.armed === 'd' + c.id) S.armed = null; }, 4000); return; }
  S.armed = null; delete S.edits[c.id]; delete S.files[c.id]; await store.delCap(c.id); toast('지웠습니다.');
}

/* ================= render: transactions / captures ================= */
function renderTx() {
  const el = $('txList'); el.replaceChildren(); const f = S.txf;
  const list = txs().filter((t) => f === 'all' || (f === 'woori' && t.type === 'bank' && t.account === '우리') || (f === 'nh' && t.type === 'bank' && t.account === '농협') || (f === 'card' && t.type === 'card')).sort(txSort).reverse().slice(0, 400);
  if (!list.length) { el.append(h('p', { class: 'empty', text: S.ready ? '거래가 없습니다. 홈에서 캡처를 붙여넣어 보세요.' : '불러오는 중…' })); return; }
  let day = '';
  list.forEach((t) => {
    if (t.date !== day) { day = t.date; el.append(h('div', { class: 'day', text: t.date })); }
    const who = t.type === 'card' ? (t.card || '기타') + '카드' : (t.account || '') + ' 통장';
    const del = h('button', { class: 'btn small ghost danger x', type: 'button', text: S.armed === t.id ? '삭제 확인' : '삭제', onclick: async () => { if (S.armed !== t.id) { S.armed = t.id; renderTx(); return; } S.armed = null; await store.delTx(t.id); } });
    const inflow = t.type === 'bank' && t.amount > 0;
    el.append(h('div', { class: 'li' }, h('span', { class: 'd', text: t.desc || '(내용 없음)' }), h('span', { class: 'a' + (inflow ? ' in' : ''), text: (inflow ? '+' : '') + won(t.amount) + '원' }),
      h('span', { class: 'm', text: [t.time, who, t.category, t.balance != null ? '잔액 ' + won(t.balance) : ''].filter(Boolean).join(' · ') }), del));
  });
}
function renderCapLog() {
  const el = $('capLog'); el.replaceChildren();
  const list = caps().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 60);
  if (!list.length) { el.append(h('p', { class: 'empty', text: '올린 캡처가 없습니다.' })); return; }
  list.forEach((c) => {
    el.append(h('div', { class: 'li' }, h('span', { class: 'd' }, h('button', { class: 'btn small ghost', type: 'button', text: '보기', onclick: () => openViewer(c.id) }), ' ', String(c.createdAt || '').slice(0, 16).replace('T', ' ')),
      statusPill(c), h('span', { class: 'm', text: c.result ? (c.result.screen === 'bank' ? (c.result.account || '') + ' 통장' : '카드') + ' · ' + (c.result.count != null ? c.result.count : (c.result.rows || []).length) + '건 인식' : (c.error || '') }),
      h('button', { class: 'btn small ghost danger', type: 'button', text: '삭제', onclick: () => discard(c) })));
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
  const ap = refList('autopays').slice().sort((a, b) => (a.card === b.card ? (a.day || 0) - (b.day || 0) : CARDS.indexOf(a.card) - CARDS.indexOf(b.card)));
  const groups = d3.rollups(ap, (v) => d3.sum(v, (x) => +x.amount), (x) => x.card);
  $('autoPays').replaceChildren(h('thead', {}, h('tr', {}, h('th', { text: '카드' }), h('th', { text: '항목' }), h('th', { class: 'n', text: '결제일' }), h('th', { class: 'n', text: '월(원)' }))),
    h('tbody', {}, ap.map((r) => h('tr', {}, h('td', { text: r.card }), h('td', { text: r.name }), h('td', { class: 'n', text: r.day ? r.day + '일' : '' }), h('td', { class: 'n', text: won(+r.amount) })))),
    h('tfoot', {}, h('tr', {}, h('td', { text: '합계' }), h('td', { text: groups.map(([k, v]) => k + ' ' + manv(v / 1e4, 1) + '만').join(' · ') }), h('td'), h('td', { class: 'n', text: won(d3.sum(ap, (x) => +x.amount)) }))));
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

/* ================= render all ================= */
let rT = 0;
function render() {
  cancelAnimationFrame(rT);
  rT = requestAnimationFrame(() => {
    const ser = series(); const cur = ser[ser.length - 1];
    renderTop(cur); renderKpis(ser); renderChart(ser); renderLimits(); renderFlow(); renderQueue(false); renderTx(); renderCapLog(); renderPlan(ser);
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
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (['home', 'tx', 'plan'].includes(t) && t !== S.tab) setTab(t); });
document.querySelectorAll('#txFilter .chip').forEach((b) => b.addEventListener('click', () => { S.txf = b.dataset.f; document.querySelectorAll('#txFilter .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderTx(); }));
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
  const tv = $('mType').value; const isCard = tv.startsWith('card:'); const amt = toNum($('mAmt').value); const bal = toNum($('mBal').value);
  if (!Number.isFinite(amt) || amt === 0 || !$('mDate').value || !$('mDesc').value.trim()) { toast('날짜, 내용, 금액을 확인하세요.'); return; }
  const t = { type: isCard ? 'card' : 'bank', account: isCard ? null : tv, card: isCard ? tv.slice(5) : null, date: $('mDate').value, time: $('mTime').value || '', desc: $('mDesc').value.trim(),
    amount: Math.round(amt), balance: !isCard && Number.isFinite(bal) ? Math.round(bal) : null, category: '기타', seq: 0, source: 'manual', savedAt: new Date().toISOString() };
  await store.setTx(txKey(t), t); $('mAmt').value = ''; $('mBal').value = ''; $('mDesc').value = ''; toast('추가했습니다.');
});
$('openSettings').addEventListener('click', () => { $('sCode').value = S.code; $('sPass').value = lsGet(LS.pass, ''); $('sKey').value = lsGet(LS.key, ''); $('settings').showModal(); });
$('setForm').addEventListener('submit', (e) => {
  if (e.submitter && e.submitter.value !== 'save') return;
  lsSet(LS.pass, $('sPass').value.trim()); lsSet(LS.key, $('sKey').value.trim());
  const code = $('sCode').value.trim();
  if (code && code !== S.code) { if (!/^[A-Za-z0-9_-]{4,40}$/.test(code)) { toast('동기화 코드는 영문·숫자 4~40자입니다.'); return; } lsSet(LS.code, code); location.reload(); return; }
  toast('설정을 저장했습니다.');
});
let rzT = 0; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (S.tab === 'home') renderChart(series()); }, 150); });

/* ================= start ================= */
(function start() {
  const t0 = location.hash.slice(1); setTab(['home', 'tx', 'plan'].includes(t0) ? t0 : 'home');
  connect();
})();
