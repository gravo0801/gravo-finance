// Mock data for Gravo Finance
const NAV = [
  { group: 'Overview', items: [
    { id: 'dashboard', label: '대시보드', en: 'Dashboard' },
  ]},
  { group: '자금 흐름', items: [
    { id: 'accounts', label: '통장별 자금 흐름', en: 'Accounts' },
    { id: 'flowmap', label: '자금 흐름 모식도', en: 'Flow Map' },
  ]},
  { group: '관리', items: [
    { id: 'fixedcosts', label: '고정비 관리', en: 'Fixed Costs' },
    { id: 'timeline', label: '월별 일정', en: 'Calendar' },
    { id: 'expenses', label: '소비내역', en: 'Expenses' },
    { id: 'creditcards', label: '신용카드 관리', en: 'Cards' },
    { id: 'analytics', label: '분석 & AI', en: 'Insights' },
  ]},
];

const ACCOUNTS = [
  { id: 'woori', name: '우리은행', sub: '마이너스통장', balance: -49200000, limit: 150000000, kind: 'credit-line', flowIn: 4200000, flowOut: 2800000 },
  { id: 'shinhan', name: '신한 FNA', sub: '주거래', balance: 12400000, kind: 'checking', flowIn: 2100000, flowOut: 1600000 },
  { id: 'nonghyup', name: '농협은행', sub: '주담대 결제', balance: 1850000, kind: 'checking', flowIn: 1300000, flowOut: 1300000 },
  { id: 'kbank', name: '케이뱅크', sub: '비상금', balance: 5600000, kind: 'savings', flowIn: 0, flowOut: 0 },
  { id: 'ibk', name: '기업은행', sub: 'ISA', balance: 23800000, kind: 'investment', flowIn: 1500000, flowOut: 0 },
];

const CARDS = [
  { id: 'lotte', co: '롯데카드', name: '드림클럽 플래티넘', last4: '1234', limit: 3000000, used: 380000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#374151 60%,#C96442 200%)', cohort: 'red' },
  { id: 'nh', co: '농협카드', name: 'NH 올원 하나로', last4: '5678', limit: 2000000, used: 180000, paymentDay: 14, gradient: 'linear-gradient(135deg,#1F2937 0%,#3F3530 60%,#5C8A5A 200%)', cohort: 'green' },
  { id: 'shinhan', co: '신한카드', name: 'Deep Dream', last4: '9012', limit: 1000000, used: 60000, paymentDay: 14, gradient: 'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#5B6CB5 200%)', cohort: 'blue' },
];

const FIXED_COSTS = [
  { group: '주거비', total: 1930000, items: [
    { day: 30, name: '주담대 원리금', meta: '농협은행 자동이체', amount: 1300000 },
    { day: 25, name: '관리비', meta: '아파트 관리비', amount: 630000 },
  ]},
  { group: '통신·구독', total: 184000, items: [
    { day: 5, name: 'SKT 통신비', meta: '휴대폰', amount: 89000 },
    { day: 10, name: 'Netflix · YouTube Premium', meta: '구독', amount: 28000 },
    { day: 15, name: 'Notion · Claude Pro', meta: '생산성', amount: 67000 },
  ]},
  { group: '보험·기타', total: 320000, items: [
    { day: 20, name: '실손보험', meta: '메리츠화재', amount: 142000 },
    { day: 22, name: '연금저축', meta: '한화생명', amount: 178000 },
  ]},
];

const EXPENSES_BY_DAY = [
  { date: '4월 26일', day: 'Sun', total: 72000, items: [
    { mark: '식', tone: 'indigo', title: '점심 식사 — 평양면옥', cat: '식비', card: '롯데카드', amount: 12000 },
    { mark: '커', tone: 'warm', title: 'Anthracite Coffee', cat: '카페', card: '신한카드', amount: 5500 },
    { mark: '생', tone: 'pos', title: 'SSG 마트 장보기', cat: '생활', card: '농협카드', amount: 54500 },
  ]},
  { date: '4월 25일', day: 'Sat', total: 138000, items: [
    { mark: '문', tone: 'accent', title: '서점 — 알라딘', cat: '문화', card: '신한카드', amount: 38000 },
    { mark: '식', tone: 'indigo', title: '저녁 — 광장시장', cat: '식비', card: '롯데카드', amount: 62000 },
    { mark: '교', tone: 'neg', title: '카카오T 택시', cat: '교통', card: '롯데카드', amount: 38000 },
  ]},
  { date: '4월 24일', day: 'Fri', total: 24500, items: [
    { mark: '식', tone: 'indigo', title: '점심 — 김밥천국', cat: '식비', card: '롯데카드', amount: 9000 },
    { mark: '커', tone: 'warm', title: '블루보틀', cat: '카페', card: '신한카드', amount: 6500 },
    { mark: '생', tone: 'pos', title: 'CU 편의점', cat: '생활', card: '농협카드', amount: 9000 },
  ]},
];

const CALENDAR_EVENTS = {
  5: [{ kind: 'out', label: '통신비' }],
  10: [{ kind: 'out', label: '구독' }],
  14: [{ kind: 'out', label: '카드결제' }, { kind: 'out', label: '카드결제' }, { kind: 'out', label: '카드결제' }],
  15: [{ kind: 'out', label: '구독' }],
  20: [{ kind: 'out', label: '보험' }],
  22: [{ kind: 'out', label: '연금' }],
  25: [{ kind: 'in', label: '급여' }, { kind: 'out', label: '관리비' }, { kind: 'var', label: 'ISA' }],
  26: [{ kind: 'today' }],
  30: [{ kind: 'out', label: '주담대' }],
};

const FLOW_LIST = [
  { day: 25, kind: 'in', desc: '급여 입금', meta: '우리은행 급여계좌', amount: 4200000 },
  { day: 14, kind: 'out', desc: '롯데카드 결제', meta: '신용카드 자동이체', amount: -380000 },
  { day: 25, kind: 'out', desc: 'ISA 이체', meta: '기업은행 ISA', amount: -1500000 },
  { day: 30, kind: 'var', desc: '주담대 원리금', meta: '농협은행 자동이체', amount: -1300000 },
  { day: 5, kind: 'out', desc: 'SKT 통신비', meta: '휴대폰 자동이체', amount: -89000 },
  { day: 22, kind: 'out', desc: '연금저축', meta: '한화생명', amount: -178000 },
];

const SPARK_DATA = [
  -52000000,-51800000,-51500000,-51200000,-50800000,-50400000,-50100000,-49800000,
  -49600000,-49400000,-49300000,-49200000,
];

// helpers
function fmtKRW(n, opts = {}) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : (opts.showPlus ? '+' : '');
  if (opts.compact) {
    if (abs >= 100000000) return sign + '₩' + (abs / 100000000).toFixed(abs >= 1000000000 ? 0 : 1) + '억';
    if (abs >= 10000) return sign + '₩' + Math.round(abs / 10000).toLocaleString() + '만';
    return sign + '₩' + abs.toLocaleString();
  }
  return sign + '₩' + abs.toLocaleString();
}

Object.assign(window, {
  NAV, ACCOUNTS, CARDS, FIXED_COSTS, EXPENSES_BY_DAY, CALENDAR_EVENTS, FLOW_LIST, SPARK_DATA, fmtKRW
});
