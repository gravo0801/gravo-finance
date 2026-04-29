// Global reactive store with localStorage persistence
const STORE_KEY = 'gravo-finance-state-v2';

const SEED = {
  month: { y: 2026, m: 4 },
  income: 4200000,
  accounts: [
    { id: 'woori', name: '우리은행', sub: '마이너스통장', balance: -49200000, limit: 150000000, kind: 'credit-line', flowIn: 4200000, flowOut: 2800000 },
    { id: 'shinhan', name: '신한 FNA', sub: '주거래', balance: 12400000, kind: 'checking', flowIn: 2100000, flowOut: 1600000 },
    { id: 'nonghyup', name: '농협은행', sub: '주담대 결제', balance: 1850000, kind: 'checking', flowIn: 1300000, flowOut: 1300000 },
    { id: 'kbank', name: '케이뱅크', sub: '비상금', balance: 5600000, kind: 'savings', flowIn: 0, flowOut: 0 },
    { id: 'ibk', name: '기업은행', sub: 'ISA', balance: 23800000, kind: 'investment', flowIn: 1500000, flowOut: 0 },
  ],
  cards: [
    { id: 'lotte', co: '롯데카드', name: '드림클럽 플래티넘', last4: '1234', limit: 3000000, used: 380000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#374151 60%,#C96442 200%)' },
    { id: 'nh', co: '농협카드', name: 'NH 올원 하나로', last4: '5678', limit: 2000000, used: 180000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#3F3530 60%,#5C8A5A 200%)' },
    { id: 'shinhan-c', co: '신한카드', name: 'Deep Dream', last4: '9012', limit: 1000000, used: 60000, paymentDay: 14, gradient: 'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#5B6CB5 200%)' },
  ],
  fixed: [
    { id: 'f1', group: '주거비', day: 30, name: '주담대 원리금', meta: '농협은행 자동이체', amount: 1300000 },
    { id: 'f2', group: '주거비', day: 25, name: '관리비', meta: '아파트 관리비', amount: 630000 },
    { id: 'f3', group: '통신·구독', day: 5, name: 'SKT 통신비', meta: '휴대폰', amount: 89000 },
    { id: 'f4', group: '통신·구독', day: 10, name: 'Netflix · YouTube Premium', meta: '구독', amount: 28000 },
    { id: 'f5', group: '통신·구독', day: 15, name: 'Notion · Claude Pro', meta: '생산성', amount: 67000 },
    { id: 'f6', group: '보험·기타', day: 20, name: '실손보험', meta: '메리츠화재', amount: 142000 },
    { id: 'f7', group: '보험·기타', day: 22, name: '연금저축', meta: '한화생명', amount: 178000 },
  ],
  expenses: [
    { id: 'e1', date: '2026-04-26', cat: '식비', tone: 'indigo', mark: '식', title: '점심 식사 — 평양면옥', card: '롯데카드', amount: 12000 },
    { id: 'e2', date: '2026-04-26', cat: '카페', tone: 'warm', mark: '커', title: 'Anthracite Coffee', card: '신한카드', amount: 5500 },
    { id: 'e3', date: '2026-04-26', cat: '생활', tone: 'pos', mark: '생', title: 'SSG 마트 장보기', card: '농협카드', amount: 54500 },
    { id: 'e4', date: '2026-04-25', cat: '문화', tone: 'accent', mark: '문', title: '서점 — 알라딘', card: '신한카드', amount: 38000 },
    { id: 'e5', date: '2026-04-25', cat: '식비', tone: 'indigo', mark: '식', title: '저녁 — 광장시장', card: '롯데카드', amount: 62000 },
    { id: 'e6', date: '2026-04-25', cat: '교통', tone: 'neg', mark: '교', title: '카카오T 택시', card: '롯데카드', amount: 38000 },
    { id: 'e7', date: '2026-04-24', cat: '식비', tone: 'indigo', mark: '식', title: '점심 — 김밥천국', card: '롯데카드', amount: 9000 },
    { id: 'e8', date: '2026-04-24', cat: '카페', tone: 'warm', mark: '커', title: '블루보틀', card: '신한카드', amount: 6500 },
    { id: 'e9', date: '2026-04-24', cat: '생활', tone: 'pos', mark: '생', title: 'CU 편의점', card: '농협카드', amount: 9000 },
  ],
};

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...SEED, ...JSON.parse(raw) };
  } catch(e) {}
  return SEED;
}
function saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e) {}
}

const StoreCtx = React.createContext(null);

function StoreProvider({ children }) {
  const [state, setState] = React.useState(loadStore());
  React.useEffect(() => { saveStore(state); }, [state]);

  const api = React.useMemo(() => ({
    state,
    setMonth: (y, m) => setState(s => ({ ...s, month: { y, m }})),
    addExpense: (e) => setState(s => ({ ...s, expenses: [{ ...e, id: 'e' + Date.now() }, ...s.expenses] })),
    deleteExpense: (id) => setState(s => ({ ...s, expenses: s.expenses.filter(e => e.id !== id) })),
    addFixed: (f) => setState(s => ({ ...s, fixed: [...s.fixed, { ...f, id: 'f' + Date.now() }] })),
    deleteFixed: (id) => setState(s => ({ ...s, fixed: s.fixed.filter(f => f.id !== id) })),
    updateAccount: (id, patch) => setState(s => ({ ...s, accounts: s.accounts.map(a => a.id===id?{...a,...patch}:a) })),
    addCard: (c) => setState(s => ({ ...s, cards: [...s.cards, { ...c, id: 'c' + Date.now() }] })),
    deleteCard: (id) => setState(s => ({ ...s, cards: s.cards.filter(c => c.id !== id) })),
    addAccount: (a) => setState(s => ({ ...s, accounts: [...s.accounts, { ...a, id: 'a' + Date.now() }] })),
    deleteAccount: (id) => setState(s => ({ ...s, accounts: s.accounts.filter(a => a.id !== id) })),
    setIncome: (n) => setState(s => ({ ...s, income: n })),
    reset: () => { localStorage.removeItem(STORE_KEY); setState(SEED); },
    exportData: () => state,
    importData: (data) => {
      if (!data || typeof data !== 'object') throw new Error('Invalid data');
      // Validate minimal shape
      const keys = ['accounts','cards','fixed','expenses'];
      for (const k of keys) {
        if (!Array.isArray(data[k])) throw new Error(`Missing or invalid: ${k}`);
      }
      setState(s => ({ ...SEED, ...data }));
    },
  }), [state]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

const useStore = () => React.useContext(StoreCtx);

// Modal system
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

// Field components
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
  // Parse "150만" "1.5억" "1,200,000"
  return <input
    {...rest}
    value={value}
    onChange={e => onChange(parseKRW(e.target.value))}
    style={{...inputStyle, fontFamily:'var(--mono)'}}
  />;
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
