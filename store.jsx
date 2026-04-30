// Global reactive store with localStorage + Firebase sync
const STORE_KEY = 'gravo-finance-state-v2';
const FB_SYNC_KEY_LS = 'gf_fb_apikey';
const FB_PROJ_LS     = 'gf_fb_projid';
const FB_CODE_LS     = 'gf_fb_synccode';

const SEED = {
  month: { y: new Date().getFullYear(), m: new Date().getMonth()+1 },
  income: 4200000,
  accounts: [
    { id: 'woori',    name: '우리은행',  sub: '마이너스통장', balance: -49200000, limit: 150000000, kind: 'credit-line', flowIn: 4200000, flowOut: 2800000 },
    { id: 'shinhan',  name: '신한 FNA',  sub: '주거래',       balance: 12400000,  kind: 'checking',     flowIn: 2100000, flowOut: 1600000 },
    { id: 'nonghyup', name: '농협은행',  sub: '주담대 결제',   balance: 1850000,   kind: 'checking',     flowIn: 1300000, flowOut: 1300000 },
    { id: 'kbank',    name: '케이뱅크',  sub: '비상금',       balance: 5600000,   kind: 'savings',      flowIn: 0, flowOut: 0 },
    { id: 'ibk',      name: '기업은행',  sub: 'ISA',          balance: 23800000,  kind: 'investment',   flowIn: 1500000, flowOut: 0 },
  ],
  cards: [
    { id: 'lotte',     co: '롯데카드', name: '드림클럽 플래티넘', last4: '1234', limit: 3000000, used: 380000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#374151 60%,#C96442 200%)' },
    { id: 'nh',        co: '농협카드', name: 'NH 올원 하나로',    last4: '5678', limit: 2000000, used: 180000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#3F3530 60%,#5C8A5A 200%)' },
    { id: 'shinhan-c', co: '신한카드', name: 'Deep Dream',        last4: '9012', limit: 1000000, used: 60000,  paymentDay: 14, gradient: 'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#5B6CB5 200%)' },
  ],
  fixed: [
    { id: 'f1', group: '주거비',    day: 30, name: '주담대 원리금',              meta: '농협은행 자동이체', amount: 1300000 },
    { id: 'f2', group: '주거비',    day: 25, name: '관리비',                    meta: '아파트 관리비',     amount: 630000  },
    { id: 'f3', group: '통신·구독', day:  5, name: 'SKT 통신비',                meta: '휴대폰',            amount: 89000   },
    { id: 'f4', group: '통신·구독', day: 10, name: 'Netflix · YouTube Premium', meta: '구독',              amount: 28000   },
    { id: 'f5', group: '통신·구독', day: 15, name: 'Notion · Claude Pro',       meta: '생산성',            amount: 67000   },
    { id: 'f6', group: '보험·기타', day: 20, name: '실손보험',                  meta: '메리츠화재',        amount: 142000  },
    { id: 'f7', group: '보험·기타', day: 22, name: '연금저축',                  meta: '한화생명',          amount: 178000  },
  ],
  expenses: [
    { id: 'e1', date: '2026-04-26', cat: '식사', tone: 'indigo', mark: '식', title: '점심 식사 — 평양면옥', card: '롯데카드', amount: 12000 },
    { id: 'e2', date: '2026-04-26', cat: '카페', tone: 'warm',   mark: '커', title: 'Anthracite Coffee',    card: '신한카드', amount: 5500  },
    { id: 'e3', date: '2026-04-26', cat: '생활', tone: 'pos',    mark: '생', title: 'SSG 마트 장보기',      card: '농협카드', amount: 54500 },
  ],
  // 월별 급여 입력: {YYYY-MM: amount}
  monthlySalaries: {},
  // 월별 카드 청구액: {YYYY-MM: {total, breakdown:{cardId:amount}}}
  monthlyCardBills: {},
  // 고정비 월별 토글: {YYYY-MM: {fixedId: false}} — false면 그 달 제외
  fixedOverrides: {},
  // 카드 소비 예산
  cardBudget: 1500000,
  salaryDay: 25,          // 매달 급여 입금 일자
  // 주담대 정보
  mortgage: {
    bank: '농협은행',
    original: 300000000,    // 총 대출액 3억
    balance: 182480000,     // 현재 잔액
    rate: 4.66,             // 금리 %
    autoPayment: 1272220,   // 매달 고정 원리금
    extraPayment: 500000,   // 매달 추가 원금 (본인)
    wifePayment: 500000,    // 매달 추가 원금 (와이프)
    startDate: '2020-01',   // 대출 시작월
  },
  // 자동결제 월별 금액 오버라이드: {YYYY-MM: {apId: amount}}
  monthlyAutoPayAmounts: {},
  // 월별 고정비 금액 오버라이드: {YYYY-MM: {fixedId: customAmount}}
  monthlyFixedAmounts: {},
  // 월별 독립 자동결제 목록: {YYYY-MM: [...items]} — 없으면 auto_pays를 초기 복사본으로 사용
  monthlyAutoPays: {},
  // 자동결제 (카드별 자동이체 항목) — 신규 월의 초기 템플릿
  auto_pays: [
    {id:'ap1', cardId:'c1', cardCo:'롯데카드', service:'암보험2',         amount:116500, day:25},
    {id:'ap2', cardId:'c1', cardCo:'롯데카드', service:'하나치매보험',     amount:55000,  day:15},
    {id:'ap3', cardId:'c1', cardCo:'롯데카드', service:'KT핸드폰결제',     amount:74500,  day:11},
    {id:'ap4', cardId:'c7', cardCo:'농협카드', service:'KT인터넷',         amount:40700,  day:11},
    {id:'ap5', cardId:'c3', cardCo:'신한카드', service:'네이버멤버십/넷플', amount:11500,  day:4},
    {id:'ap6', cardId:'c3', cardCo:'신한카드', service:'애플클라우드',      amount:3300,   day:15},
    {id:'ap7', cardId:'c3', cardCo:'신한카드', service:'구글Gemini',        amount:29000,  day:6},
    {id:'ap8', cardId:'c3', cardCo:'신한카드', service:'네이버플러스',      amount:4900,   day:4},
    {id:'ap9', cardId:'c3', cardCo:'신한카드', service:'Grok AI',           amount:48000,  day:10},
    {id:'ap10',cardId:'c3', cardCo:'신한카드', service:'유튜브프리미엄',    amount:14900,  day:6},
    {id:'ap11',cardId:'c3', cardCo:'신한카드', service:'클로드AI',          amount:30000,  day:14},
    {id:'ap12',cardId:'c3', cardCo:'신한카드', service:'멘토즈스터디카페',  amount:65000,  day:25},
  ],
  // 카드별 월 소비 예산 {cardId: amount}
  cardMonthlyBudgets: {},
  // 통장별 자금흐름 (per-bank flows)
  bankFlows: {
    woori:    [
      {id:'wf1',  day:10, kind:'out', desc:'하나은행',               meta:'이벤트자금',        amount:500000},
      {id:'wf2',  day:10, kind:'out', desc:'기업은행',               meta:'세금대비',          amount:500000},
      {id:'wf3',  day:14, kind:'out', desc:'카드 결제',              meta:'롯데·농협·신한',    amount:620000},
      {id:'wf4',  day:25, kind:'out', desc:'신한FNA',                meta:'주거래',            amount:500000},
      {id:'wf5',  day:25, kind:'out', desc:'신한(저축)',             meta:'저축',              amount:200000},
      {id:'wf6',  day:27, kind:'out', desc:'농협은행',               meta:'주담대 재원',       amount:2500000},
      {id:'wf7',  day:30, kind:'out', desc:'케이뱅크',               meta:'이체',              amount:200000},
      {id:'wf8',  day:30, kind:'out', desc:'신한금융투자(ISA)',       meta:'ISA 납입',          amount:200000},
      {id:'wf9',  day:30, kind:'out', desc:'신한금융투자(연금저축1)', meta:'연금저축',          amount:300000},
      {id:'wf10', day:30, kind:'out', desc:'미래에셋증권(연금저축2)', meta:'연금저축',          amount:300000},
      {id:'wf11', day:30, kind:'out', desc:'미래에셋증권(금현물)',    meta:'금현물',            amount:100000},
      {id:'wf12', day:30, kind:'out', desc:'미래에셋증권(IRP)',       meta:'IRP 납입',          amount:300000},
      {id:'wf13', day:30, kind:'out', desc:'키움증권(위탁종합)',      meta:'투자',              amount:200000},
      {id:'wf14', day:30, kind:'out', desc:'토스증권(위탁종합)',      meta:'투자',              amount:100000},
      {id:'wf15', day:30, kind:'out', desc:'메리츠증권(위탁종합)',    meta:'투자',              amount:100000},
      {id:'wf16', day:30, kind:'out', desc:'신한금융투자(위탁종합)',  meta:'투자',              amount:100000},
    ],
    shinhan:  [
      {id:'sf1', day:10, kind:'out', desc:'케이뱅크 이체',    meta:'적금',         amount:500000},
      {id:'sf2', day:16, kind:'in',  desc:'(주)연형 급여',    meta:'정기 급여',    amount:2300000},
      {id:'sf3', day:20, kind:'out', desc:'어머니 계좌 이체', meta:'매달 자동이체',amount:500000},
      {id:'sf4', day:30, kind:'out', desc:'노란우산공제회',   meta:'매달 30일',    amount:420000},
    ],
    nonghyup: [
      {id:'nf1', day:13, kind:'out', desc:'삼성화재 실비보험',meta:'자동출금',     amount:220000},
      {id:'nf2', day:14, kind:'out', desc:'농협카드 결제',    meta:'약 30~40만',   amount:350000},
      {id:'nf3', day:25, kind:'out', desc:'암보험1',          meta:'매달 25일',    amount:37900},
      {id:'nf4', day:25, kind:'out', desc:'한화 뇌심혈관보험',meta:'매달 25일',    amount:47000},
      {id:'nf5', day:26, kind:'out', desc:'농협적금',         meta:'매달 26일',    amount:300000},
      {id:'nf6', day:27, kind:'in',  desc:'우리은행 입금',    meta:'주담대 재원',  amount:2500000},
      {id:'nf7', day:30, kind:'out', desc:'주담대 원리금',    meta:'정기 상환',    amount:1300000},
    ],
    kbank:    [
      {id:'kf1', day:7,  kind:'in',  desc:'신한은행2 입금',   meta:'적금 자동이체',amount:500000},
      {id:'kf2', day:10, kind:'out', desc:'케이뱅크 적금',    meta:'이체',         amount:500000},
    ],
    ibk:      [
      {id:'if1', day:10, kind:'in',  desc:'우리은행 입금',    meta:'세금대비',     amount:500000},
    ],
    hana:     [
      {id:'hf1', day:10, kind:'in',  desc:'우리은행 입금',    meta:'이벤트자금',   amount:500000},
    ],
  },
};

// ── localStorage helpers ──────────────────────────
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const now = new Date();
      // month는 항상 오늘 기준으로 초기화 (저장된 과거 값 무시)
      return { ...SEED, ...saved, month: { y: now.getFullYear(), m: now.getMonth()+1 } };
    }
  } catch(e) {}
  return SEED;
}
function saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e) {}
}

// ── Firebase sync ─────────────────────────────────
let _fbDb       = null;
let _fbCode     = null;
let _fbUnsub    = null;
let _fbTimer    = null;
let _fbApplying = false;
let _fbSyncStatus = { status: 'off', listeners: [] };

function fbNotify(status) {
  _fbSyncStatus.status = status;
  _fbSyncStatus.listeners.forEach(fn => fn(status));
}
function fbOnStatus(fn) {
  _fbSyncStatus.listeners.push(fn);
  fn(_fbSyncStatus.status);
  return () => { _fbSyncStatus.listeners = _fbSyncStatus.listeners.filter(f => f !== fn); };
}

async function fbConnect(apiKey, projectId, syncCode) {
  fbNotify('connecting');
  try {
    let app;
    try { app = firebase.app('gravo'); }
    catch(e) { app = firebase.initializeApp({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` }, 'gravo'); }
    _fbDb   = firebase.firestore(app);
    _fbCode = syncCode;
    localStorage.setItem(FB_SYNC_KEY_LS, apiKey);
    localStorage.setItem(FB_PROJ_LS,     projectId);
    localStorage.setItem(FB_CODE_LS,     syncCode);

    // First push current local data
    const cur = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (cur) {
      await _fbDb.doc(`gravo_finance_v2/${syncCode}`).set({ _data: JSON.stringify(cur), _ts: Date.now() });
    }

    fbStartListener();
    fbNotify('ok');
    return true;
  } catch(e) {
    fbNotify('error');
    throw e;
  }
}

function fbStartListener() {
  if (_fbUnsub) _fbUnsub();
  _fbUnsub = _fbDb.doc(`gravo_finance_v2/${_fbCode}`).onSnapshot(snap => {
    if (!snap.exists || _fbApplying) return;
    const remote = snap.data();
    const localTs = +(localStorage.getItem('_gf_ts') || 0);
    if (remote._ts <= localTs) return;
    _fbApplying = true;
    const parsed = JSON.parse(remote._data || '{}');
    saveStore(parsed);
    localStorage.setItem('_gf_ts', String(remote._ts));
    window._gfForceReload && window._gfForceReload(parsed);
    _fbApplying = false;
    fbNotify('ok');
  }, () => fbNotify('error'));
}

function fbPush(state) {
  if (!_fbDb || !_fbCode || _fbApplying) return;
  clearTimeout(_fbTimer);
  _fbTimer = setTimeout(async () => {
    const ts = Date.now();
    await _fbDb.doc(`gravo_finance_v2/${_fbCode}`).set({ _data: JSON.stringify(state), _ts: ts });
    localStorage.setItem('_gf_ts', String(ts));
    fbNotify('ok');
  }, 1200);
}

function fbDisconnect() {
  if (_fbUnsub) { _fbUnsub(); _fbUnsub = null; }
  _fbDb = null; _fbCode = null;
  [FB_SYNC_KEY_LS, FB_PROJ_LS, FB_CODE_LS].forEach(k => localStorage.removeItem(k));
  fbNotify('off');
}

async function fbAutoConnect(onReload) {
  const apiKey    = localStorage.getItem(FB_SYNC_KEY_LS);
  const projectId = localStorage.getItem(FB_PROJ_LS);
  const syncCode  = localStorage.getItem(FB_CODE_LS);
  if (!apiKey || !projectId || !syncCode) return;
  window._gfForceReload = onReload;
  fbNotify('connecting');
  try {
    let app;
    try { app = firebase.app('gravo'); }
    catch(e) { app = firebase.initializeApp({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` }, 'gravo'); }
    _fbDb = firebase.firestore(app);
    _fbCode = syncCode;

    // Pull latest from cloud first
    const snap = await _fbDb.doc(`gravo_finance_v2/${syncCode}`).get();
    if (snap.exists) {
      const remote = snap.data();
      const localTs = +(localStorage.getItem('_gf_ts') || 0);
      if (remote._ts > localTs) {
        const parsed = JSON.parse(remote._data || '{}');
        saveStore(parsed);
        localStorage.setItem('_gf_ts', String(remote._ts));
        if (!sessionStorage.getItem('_gf_loaded')) {
          sessionStorage.setItem('_gf_loaded', '1');
          location.reload();
          return;
        }
      }
    }
    fbStartListener();
    fbNotify('ok');
  } catch(e) {
    fbNotify('error');
  }
}

// ── React Store ───────────────────────────────────
const StoreCtx = React.createContext(null);

function StoreProvider({ children }) {
  const [state, setStateRaw] = React.useState(loadStore());

  const setState = React.useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveStore(next);
      fbPush(next);
      return next;
    });
  }, []);

  // Allow Firebase listener to force-reload UI
  React.useEffect(() => {
    window._gfForceReload = (parsed) => setStateRaw({ ...SEED, ...parsed });
    fbAutoConnect(parsed => setStateRaw({ ...SEED, ...parsed }));
  }, []);

  const api = React.useMemo(() => ({
    state,
    fbConnect,
    fbDisconnect,
    fbOnStatus,
    setMonth:      (y, m) => setState(s => ({ ...s, month: { y, m }})),
    addExpense:    (e)  => setState(s => ({ ...s, expenses: [{ ...e, id: 'e' + Date.now() }, ...s.expenses] })),
    deleteExpense: (id) => setState(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) })),
    addFixed:      (f)  => setState(s => ({ ...s, fixed: [...s.fixed, { ...f, id: 'f' + Date.now() }] })),
    deleteFixed:   (id) => setState(s => ({ ...s, fixed: s.fixed.filter(f => f.id !== id) })),
    updateAccount: (id, patch) => setState(s => ({ ...s, accounts: s.accounts.map(a => a.id===id?{...a,...patch}:a) })),
    updateFixed:   (id, patch) => setState(s => ({ ...s, fixed:    s.fixed.map(f =>    f.id===id?{...f,...patch}:f) })),
    updateExpense: (id, patch) => setState(s => ({ ...s, expenses: s.expenses.map(e => e.id===id?{...e,...patch}:e) })),
    updateCard:    (id, patch) => setState(s => ({ ...s, cards:    s.cards.map(c =>    c.id===id?{...c,...patch}:c) })),
    addCard:       (c)  => setState(s => ({ ...s, cards: [...s.cards, { ...c, id: 'c' + Date.now() }] })),
    deleteCard:    (id) => setState(s => ({ ...s, cards: s.cards.filter(c => c.id !== id) })),
    addAccount:    (a)  => setState(s => ({ ...s, accounts: [...s.accounts, { ...a, id: 'a' + Date.now() }] })),
    deleteAccount: (id) => setState(s => ({ ...s, accounts: s.accounts.filter(a => a.id !== id) })),
    setIncome:     (n)  => setState(s => ({ ...s, income: n })),
    setSalaryForMonth: (ym, amount) => setState(s => ({ ...s, monthlySalaries: {...(s.monthlySalaries||{}), [ym]: amount} })),
    setCardBillForMonth: (ym, data) => setState(s => ({ ...s, monthlyCardBills: {...(s.monthlyCardBills||{}), [ym]: data} })),
    setFixedOverride: (ym, id, enabled) => setState(s => {
      const fo = {...(s.fixedOverrides||{})};
      if (!fo[ym]) fo[ym] = {};
      if (enabled) delete fo[ym][id]; else fo[ym][id] = false;
      return { ...s, fixedOverrides: fo };
    }),
    setCardBudget: (n) => setState(s => ({ ...s, cardBudget: n })),
    setBankFlow: (bankId, flows) => setState(s => ({ ...s, bankFlows: {...(s.bankFlows||{}), [bankId]: flows} })),
    updateBankFlow: (bankId, id, patch) => setState(s => {
      const flows = (s.bankFlows||{})[bankId] || [];
      return { ...s, bankFlows: { ...(s.bankFlows||{}), [bankId]: flows.map(f => f.id===id ? {...f,...patch} : f) } };
    }),
    deleteBankFlow: (bankId, id) => setState(s => {
      const flows = (s.bankFlows||{})[bankId] || [];
      return { ...s, bankFlows: { ...(s.bankFlows||{}), [bankId]: flows.filter(f => f.id!==id) } };
    }),
    addBankFlow: (bankId, flow) => setState(s => {
      const flows = (s.bankFlows||{})[bankId] || [];
      return { ...s, bankFlows: { ...(s.bankFlows||{}), [bankId]: [...flows, {...flow, id:'bf'+Date.now()}] } };
    }),
    addAutoPay:    (ap)        => setState(s => ({ ...s, auto_pays: [...(s.auto_pays||[]), {...ap, id:'ap'+Date.now()}] })),
    deleteAutoPay: (id)        => setState(s => ({ ...s, auto_pays: (s.auto_pays||[]).filter(a=>a.id!==id) })),
    updateAutoPay: (id, patch) => setState(s => ({ ...s, auto_pays: (s.auto_pays||[]).map(a=>a.id===id?{...a,...patch}:a) })),
    // 월별 독립 자동결제
    initMonthAutoPays: (ym, template) => setState(s => {
      if ((s.monthlyAutoPays||{})[ym] !== undefined) return s;
      return { ...s, monthlyAutoPays: {...(s.monthlyAutoPays||{}), [ym]: template.map(ap=>({...ap, id:ap.id+'_m'+ym.replace('-','')}))} };
    }),
    addMonthAutoPay: (ym, ap) => setState(s => {
      const cur = (s.monthlyAutoPays||{})[ym] || [];
      return { ...s, monthlyAutoPays: {...(s.monthlyAutoPays||{}), [ym]: [...cur, {...ap, id:'ap'+Date.now()+'_'+ym}]} };
    }),
    deleteMonthAutoPay: (ym, id) => setState(s => {
      const cur = (s.monthlyAutoPays||{})[ym] || [];
      return { ...s, monthlyAutoPays: {...(s.monthlyAutoPays||{}), [ym]: cur.filter(a=>a.id!==id)} };
    }),
    updateMonthAutoPay: (ym, id, patch) => setState(s => {
      const cur = (s.monthlyAutoPays||{})[ym] || [];
      return { ...s, monthlyAutoPays: {...(s.monthlyAutoPays||{}), [ym]: cur.map(a=>a.id===id?{...a,...patch}:a)} };
    }),
    setCardMonthlyBudget: (cardId, amount) => setState(s => ({ ...s, cardMonthlyBudgets: {...(s.cardMonthlyBudgets||{}), [cardId]: amount} })),
    setSalaryDay: (d) => setState(s => ({ ...s, salaryDay: d })),
    updateMortgage: (patch) => setState(s => ({ ...s, mortgage: {...(s.mortgage||{}), ...patch} })),
    setMonthlyAutoPayAmount: (ym, apId, amount) => setState(s => {
      const mapa = {...(s.monthlyAutoPayAmounts||{})};
      if (!mapa[ym]) mapa[ym] = {};
      if (amount === null) delete mapa[ym][apId];
      else mapa[ym][apId] = amount;
      return { ...s, monthlyAutoPayAmounts: mapa };
    }),
    resetMonthlyAutoPayAmount: (ym, apId) => setState(s => {
      const mapa = {...(s.monthlyAutoPayAmounts||{})};
      if (mapa[ym]) { delete mapa[ym][apId]; }
      return { ...s, monthlyAutoPayAmounts: mapa };
    }),
    setMonthlyFixedAmount: (ym, id, amount) => setState(s => {
      const mfa = {...(s.monthlyFixedAmounts||{})};
      if (!mfa[ym]) mfa[ym] = {};
      if (amount === null) delete mfa[ym][id]; else mfa[ym][id] = amount;
      return { ...s, monthlyFixedAmounts: mfa };
    }),
    exportData: () => state,
    importData: (data) => {
      if (!data || typeof data !== 'object') throw new Error('Invalid data');
      const keys = ['accounts','cards','fixed','expenses'];
      for (const k of keys) {
        if (!Array.isArray(data[k])) throw new Error(`Missing or invalid: ${k}`);
      }
      setState(s => ({ ...SEED, ...data }));
    },
  }), [state, setState]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

const useStore = () => React.useContext(StoreCtx);

// ── Modal system ──────────────────────────────────
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(26,23,20,0.4)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20,
      animation: 'fadeUp .2s ease'
    }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{
        background:'var(--paper)', borderRadius:'var(--r-lg)', border:'1px solid var(--line)',
        width:'100%', maxWidth:480, maxHeight:'90vh', overflow:'auto',
        boxShadow:'var(--shadow-lg)'
      }}>
        <div style={{padding:'22px 26px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div className="serif" style={{fontSize:20, fontWeight:500, letterSpacing:'-0.015em'}}>{title}</div>
          <button className="icon-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{padding:'18px 26px'}}>{children}</div>
        {footer && <div style={{padding:'14px 26px 22px', borderTop:'1px solid var(--line)', display:'flex', gap:8, justifyContent:'flex-end'}}>{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11.5, fontWeight:600, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>{label}</div>
      {children}
      {hint && <div style={{fontSize:11, color:'var(--ink-4)', marginTop:4}}>{hint}</div>}
    </div>
  );
}
const inputStyle = {
  width:'100%', padding:'10px 12px', border:'1px solid var(--line)',
  borderRadius:'var(--r-sm)', background:'var(--bg)', fontSize:13.5,
  color:'var(--ink)', fontFamily:'var(--sans)'
};
function TextInput(props) { return <input {...props} style={{...inputStyle, ...(props.style||{})}} />; }
function NumberInput({ value, onChange, ...rest }) {
  return <input {...rest} value={value} onChange={e => onChange(parseKRW(e.target.value))}
    style={{...inputStyle, fontFamily:'var(--mono)'}} />;
}
function parseKRW(str) {
  if (!str) return '';
  if (typeof str === 'number') return str;
  const s = String(str).replace(/[₩,\s]/g, '');
  if (s === '' || s === '-') return s;
  let m;
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)억$/))) return Math.round(parseFloat(m[1]) * 100000000);
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)만$/))) return Math.round(parseFloat(m[1]) * 10000);
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{...inputStyle, cursor:'pointer'}}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Toast
const ToastCtx = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const show = (msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2400);
  };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:300, display:'flex', flexDirection:'column', gap:8}}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:'var(--ink)', color:'var(--bg)', padding:'10px 18px',
            borderRadius:'var(--r-pill)', fontSize:13, fontWeight:500,
            boxShadow:'var(--shadow-lg)', animation:'fadeUp .2s ease'
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => React.useContext(ToastCtx);

Object.assign(window, { StoreProvider, useStore, Modal, Field, TextInput, NumberInput, Select, parseKRW, ToastProvider, useToast });
