// All page components — Gravo Finance
const { useState: uS, useEffect: uM, useMemo: uSe } = React;

// ── helpers ──────────────────────────────────────────────
function useMonthExpenses() {
  const store = useStore();
  const { y, m } = store.state.month;
  const ym = `${y}-${String(m).padStart(2,'0')}`;
  return uSe(() => store.state.expenses.filter(e => e.date.startsWith(ym)), [store.state.expenses, ym]);
}

function MonthSwitchLive() {
  const store = useStore();
  const { y, m } = store.state.month;
  const now = new Date();
  const isCurrent = y === now.getFullYear() && m === now.getMonth()+1;
  const prev = () => { const d = new Date(y,m-2,1); store.setMonth(d.getFullYear(),d.getMonth()+1); };
  const next = () => { const d = new Date(y,m,1); store.setMonth(d.getFullYear(),d.getMonth()+1); };
  return (
    <div className="month-switch">
      <button onClick={prev}>‹</button>
      <span className="label">{y}년 {m}월</span>
      <button onClick={next} disabled={isCurrent} style={{opacity:isCurrent?.4:1}}>›</button>
    </div>
  );
}

const CAT_DEFS = [
  {cat:'식사',  mark:'식', tone:'indigo', label:'🍽️ 식사'},
  {cat:'카페',  mark:'카', tone:'warm',   label:'☕ 카페'},
  {cat:'배달',  mark:'배', tone:'warm',   label:'📦 배달음식'},
  {cat:'주류',  mark:'술', tone:'neg',    label:'🍺 주류·술'},
  {cat:'쇼핑',  mark:'쇼', tone:'accent', label:'🛍️ 쇼핑'},
  {cat:'마트',  mark:'마', tone:'pos',    label:'🛒 마트·식료품'},
  {cat:'교통',  mark:'교', tone:'neg',    label:'🚕 교통·택시'},
  {cat:'의료',  mark:'의', tone:'pos',    label:'🏥 의료·약국'},
  {cat:'건강',  mark:'건', tone:'pos',    label:'💪 운동·건강'},
  {cat:'미용',  mark:'미', tone:'warm',   label:'💇 미용·뷰티'},
  {cat:'여행',  mark:'여', tone:'accent', label:'✈️ 여행'},
  {cat:'문화',  mark:'문', tone:'accent', label:'🎭 문화·엔터'},
  {cat:'교육',  mark:'공', tone:'indigo', label:'📚 교육·학원'},
  {cat:'육아',  mark:'육', tone:'pos',    label:'👶 육아·아이'},
  {cat:'반려',  mark:'펫', tone:'warm',   label:'🐾 반려동물'},
  {cat:'구독',  mark:'구', tone:'indigo', label:'📱 구독·앱'},
  {cat:'통신',  mark:'통', tone:'indigo', label:'📡 통신비'},
  {cat:'공과금',mark:'공', tone:'neg',    label:'⚡ 공과금'},
  {cat:'보험',  mark:'보', tone:'neg',    label:'🛡️ 보험'},
  {cat:'경조사',mark:'경', tone:'accent', label:'🎁 경조사·선물'},
  {cat:'기타',  mark:'기', tone:'warm',   label:'📦 기타'},
];
function getCatDef(cat){ return CAT_DEFS.find(c=>c.cat===cat)||CAT_DEFS[CAT_DEFS.length-1]; }

// ─────────────────────────────────────────────────────────
// DASHBOARD — 4-box Woori-centric
// ─────────────────────────────────────────────────────────
function DashboardPage({ openExpense, openCard }) {
  const store = useStore();
  const toast = useToast();
  const { y, m } = store.state.month;
  const ym = `${y}-${String(m).padStart(2,'0')}`;
  const monthExp = useMonthExpenses();
  const woori    = store.state.accounts.find(a=>a.id==='woori')||store.state.accounts[0];
  const curMinus = woori?.balance||0;
  const overrides = (store.state.fixedOverrides||{})[ym]||{};
  const mfaDash   = (store.state.monthlyFixedAmounts||{})[ym]||{};
  const getFixedAmt = (f) => mfaDash[f.id]!==undefined ? mfaDash[f.id] : f.amount;

  // ── 고정비: 고정비 탭과 완전히 동일한 로직 ──
  // 1) 농협은행·자동결제 그룹 제외
  // 2) meta에 '농협' 포함된 항목도 제외 (주담대가 '주거비' 그룹으로 저장된 경우 대비)
  // 3) 이달 오버라이드(토글 OFF) 제외
  const NONWOORI_GROUPS = ['농협은행','자동결제'];
  const isNonWoori = (f) =>
    NONWOORI_GROUPS.includes(f.group) ||
    (f.meta||'').includes('농협은행') ||
    (f.name||'').includes('주담대');

  const now2 = new Date();
  const todayDay2 = now2.getDate();
  const isCurMonth = y===now2.getFullYear() && m===now2.getMonth()+1;
  // 우리은행 관련 + 이달 토글 ON 항목만
  const activeFixed = store.state.fixed.filter(f=>
    overrides[f.id]!==false &&
    !isNonWoori(f)
  );
  const pendingFixed = isCurMonth
    ? activeFixed.filter(f => f.day >= todayDay2)
    : activeFixed;
  const completedFixed = isCurMonth
    ? activeFixed.filter(f => f.day < todayDay2)
    : [];
  const fixedTotal   = activeFixed.reduce((s,f)=>s+getFixedAmt(f),0);
  const pendingFixedTotal = pendingFixed.reduce((s,f)=>s+getFixedAmt(f),0);
  const completedFixedTotal = completedFixed.reduce((s,f)=>s+getFixedAmt(f),0);
  const cardBill    = ((store.state.monthlyCardBills||{})[ym])||{};
  const cardBillTotal = cardBill.total||0;
  const salary    = ((store.state.monthlySalaries||{})[ym])||store.state.income;
  const salaryDay = store.state.salaryDay || 25;

  // 30일 예상: 현재 잔액은 이미 받은 급여·완료된 고정비 반영됨
  // → 아직 안 받은 급여 + 앞으로 나갈 고정비만 계산
  const remainingSalary  = (isCurMonth && salaryDay > todayDay2) ? salary : 0;
  const cardPayMaxDay    = store.state.cards.reduce((m,c)=>Math.max(m,c.paymentDay||14),14);
  const remainingCardBill= (isCurMonth && cardPayMaxDay > todayDay2) ? cardBillTotal : 0;
  const projected = curMinus + remainingSalary - pendingFixedTotal - remainingCardBill;
  const expTotal  = monthExp.reduce((s,e)=>s+e.amount,0);
  const cardBudget= store.state.cardBudget||1500000;
  const budgetPct = Math.min((expTotal/cardBudget)*100,100);
  // 카드 매칭 헬퍼: "KT DC PLUS 롯데카드" ↔ "롯데카드" 처리
  const matchCard = (expCard, cardCo) => {
    if (!expCard || !cardCo) return false;
    return expCard === cardCo || expCard.includes(cardCo) || cardCo.includes(expCard.replace('카드','').trim());
  };
  const byCard = {};
  monthExp.forEach(e=>{
    const c = store.state.cards.find(c => matchCard(e.card, c.co));
    const key = c ? c.co : e.card;
    byCard[key]=(byCard[key]||0)+e.amount;
  });

  const [editMinus,  setEditMinus]  = uS(false);
  const [editFixed,  setEditFixed]  = uS(false);
  const [editCard,   setEditCard]   = uS(false);
  const [editBudget, setEditBudget] = uS(false);
  const [minusVal,   setMinusVal]   = uS('');
  const [budgetVal,  setBudgetVal]  = uS('');
  const [cardExpanded, setCardExpanded] = uS(false); // 카드소비 기본 접힘

  const box = (color) => ({
    background:'var(--paper)', border:'1px solid var(--line)', borderRadius:'var(--r-lg)',
    padding:'20px 22px', position:'relative', overflow:'visible', borderTop:`3px solid ${color}`
  });
  const lbl = {fontSize:11,fontWeight:700,color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:8};
  // serif 스타일 숫자 — AccountsPage와 동일
  const num = {fontFamily:'var(--serif)',fontSize:28,fontWeight:400,letterSpacing:'-0.03em',lineHeight:1.1};
  const editBtnEl = (fn) => (
    <button onClick={fn} style={{position:'absolute',top:12,right:12,background:'transparent',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',padding:'3px 9px',fontSize:11,cursor:'pointer',color:'var(--ink-3)'}}>수정</button>
  );

  return (
    <div className="tab-content">
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:8}}>
        <div style={{fontFamily:'var(--serif)',fontSize:34,fontWeight:500,letterSpacing:'-0.02em',lineHeight:1.1}}>
          {y}년 <span style={{color:'var(--accent)'}}>{m}월</span>
          <span style={{fontSize:16,color:'var(--ink-3)',fontFamily:'var(--sans)',fontWeight:400,marginLeft:10}}>재정 현황</span>
        </div>
        <MonthSwitchLive />
      </div>

      {/* 주담대 현황 */}
      <MortgageBox store={store} toast={toast} />

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>

        {/* 1. 마이너스 잔액 */}
        <div style={box('var(--negative)')}>
          {editBtnEl(()=>{setMinusVal(String(curMinus));setEditMinus(true);})}
          <div style={lbl}>우리은행 마이너스</div>
          {editMinus ? (
            <div style={{display:'flex',gap:6,flexDirection:'column'}}>
              <input type="number" value={minusVal} onChange={e=>setMinusVal(e.target.value)} style={{padding:'8px 10px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:15,fontFamily:'var(--mono)',background:'var(--bg)'}} />
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>{ const v=parseInt(minusVal); if(!isNaN(v)){store.updateAccount('woori',{balance:v});toast('저장됨');} setEditMinus(false); }}>저장</button>
                <button className="btn btn-sm" style={{flex:1}} onClick={()=>setEditMinus(false)}>취소</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{...num,color:'var(--negative)'}}>{fmtKRW(curMinus)}</div>
              <div style={{fontSize:12,color:'var(--ink-4)',marginTop:6}}>한도 {fmtKRW(woori?.limit||150000000,{compact:true})} · {woori?.limit?(Math.abs(curMinus)/woori.limit*100).toFixed(1)+'%':'--'} 사용</div>
              <div style={{marginTop:10,height:4,background:'var(--paper-2)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',background:'var(--negative)',borderRadius:2,width:woori?.limit?Math.min(Math.abs(curMinus)/woori.limit*100,100)+'%':'0%',transition:'width .5s'}}></div></div>
            </>
          )}
        </div>

        {/* 2. 고정비 */}
        <div style={box('var(--warm)')}>
          <div style={lbl}>이번달 고정비</div>
          <div style={{...num,color:'var(--warm)'}}>{fmtKRW(fixedTotal)}</div>
          <div style={{fontSize:11.5,color:'var(--ink-4)',marginTop:6,lineHeight:1.7}}>
            {isCurMonth ? (
              <>완료 {fmtKRW(completedFixedTotal,{compact:true})} · 예정 {fmtKRW(pendingFixedTotal,{compact:true})}</>
            ) : `${activeFixed.length}개 항목`}
          </div>
          <div style={{fontSize:10.5,color:'var(--ink-4)',marginTop:4}}>고정비 관리 탭에서 수정</div>
        </div>

        {/* 3. 카드 청구액 */}
        <div style={box('#5B6CB5')}>
          {editBtnEl(()=>setEditCard(true))}
          <div style={lbl}>카드 청구액 ({m}월)</div>
          <div style={{...num,color:'#5B6CB5'}}>{cardBillTotal ? fmtKRW(cardBillTotal) : '미입력'}</div>
          <div style={{fontSize:12,color:'var(--ink-4)',marginTop:6}}>매달 1일 입력 · 12~15일 결제</div>
          {editCard && <CardBillModal ym={ym} current={cardBill} cards={store.state.cards} onSave={(data)=>{store.setCardBillForMonth(ym,data);setEditCard(false);toast('저장됨');}} onClose={()=>setEditCard(false)} />}
        </div>

        {/* 4. 30일 예상 */}
        <div style={box(projected>=curMinus?'var(--positive)':'var(--negative)')}>
          <div style={lbl}>30일 예상 마이너스</div>
          <div style={{...num,color:projected>=curMinus?'var(--positive)':'var(--negative)'}}>{fmtKRW(projected)}</div>
          <div style={{fontSize:11,color:'var(--ink-4)',marginTop:6,lineHeight:1.7}}>
            현재{fmtKRW(curMinus,{compact:true})}
            {remainingSalary>0 ? ` + 급여${fmtKRW(remainingSalary,{compact:true})}` : ' (급여수령완료)'}
            {pendingFixedTotal>0 ? ` − 예정고정${fmtKRW(pendingFixedTotal,{compact:true})}` : ''}
            {remainingCardBill>0 ? ` − 카드${fmtKRW(remainingCardBill,{compact:true})}` : ' (카드결제완료)'}
          </div>
        </div>
      </div>

      {/* 카드 소비 현황 — 접기/펼치기 */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-head" style={{cursor:'pointer'}} onClick={()=>setCardExpanded(v=>!v)}>
          <div>
            <div className="card-title">이달 <em>카드 소비</em></div>
            <div className="card-sub">{monthExp.length}건 · {fmtKRW(expTotal)} · {budgetPct.toFixed(0)}% 사용</div>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {!cardExpanded && (
              <div style={{display:'flex', gap:6}}>
                {store.state.cards.slice(0,3).map(c => {
                  const matchCard2 = (ec,co) => !ec||!co?false:ec===co||ec.includes(co)||co.includes(ec.replace('카드','').trim());
                  const sp = monthExp.filter(e=>matchCard2(e.card,c.co)).reduce((s,e)=>s+e.amount,0);
                  return sp>0 ? <span key={c.id} style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--negative)',background:'var(--paper-2)',padding:'2px 7px',borderRadius:4}}>{c.co.replace('카드','')} {fmtKRW(sp,{compact:true})}</span> : null;
                })}
              </div>
            )}
            <span style={{fontSize:18,color:'var(--ink-3)',lineHeight:1,transform:cardExpanded?'rotate(180deg)':'rotate(0)',transition:'transform .2s'}}>⌄</span>
          </div>
        </div>

        {/* 전체 예산 바 — 항상 표시 */}
        <div style={{marginBottom: cardExpanded ? 14 : 0}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:11,color:'var(--ink-4)'}}>예산 대비</span>
              {editBudget ? (
                <div style={{display:'flex',gap:5}}>
                  <input type="number" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)} style={{width:90,padding:'3px 7px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12,fontFamily:'var(--mono)',background:'var(--bg)'}} />
                  <button className="btn btn-primary btn-sm" onClick={()=>{const v=parseInt(budgetVal);if(!isNaN(v)){store.setCardBudget(v);toast('예산 설정됨');}setEditBudget(false);}}>저장</button>
                  <button className="btn btn-sm" onClick={()=>setEditBudget(false)}>✕</button>
                </div>
              ) : (
                <button className="btn btn-sm" style={{fontSize:10,padding:'2px 7px'}} onClick={e=>{e.stopPropagation();setBudgetVal(String(cardBudget));setEditBudget(true);}}>예산 {fmtKRW(cardBudget,{compact:true})}</button>
              )}
            </div>
            <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:600,color:budgetPct>80?'var(--negative)':'var(--ink-2)'}}>{fmtKRW(expTotal)} / {fmtKRW(cardBudget)}</span>
          </div>
          <div style={{height:6,background:'var(--paper-2)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',background:budgetPct>80?'var(--negative)':budgetPct>60?'var(--warm)':'var(--accent)',width:budgetPct+'%',borderRadius:3,transition:'width .5s'}}></div>
          </div>
        </div>

        {/* 카드별 상세 — 펼쳐야 보임 */}
        {cardExpanded && (
          <div style={{marginTop:14, borderTop:'1px solid var(--line)', paddingTop:14}}>
            {store.state.cards.map(c => (
              <CardSpendingRow key={c.id} c={c} monthExp={monthExp} store={store} toast={toast} />
            ))}
          </div>
        )}
      </div>

      {/* 카드 한도 — 컴팩트 인라인 */}
      <div className="card" style={{padding:'14px 18px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div className="card-title" style={{fontSize:13.5}}>신용카드 <em>한도</em></div>
          <button className="btn btn-sm" onClick={openCard}>+ 카드</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {store.state.cards.map(c=>{
            const pct=c.limit?(c.used/c.limit)*100:0;
            const isHigh=pct>70;
            return (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:80,fontSize:12,color:'var(--ink-2)',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.co}</div>
                <div style={{flex:1,height:5,background:'var(--paper-2)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',background:isHigh?'var(--negative)':'var(--accent)',borderRadius:3,width:pct+'%',transition:'width .5s'}}></div>
                </div>
                <div style={{fontSize:12,fontFamily:'var(--mono)',color:isHigh?'var(--negative)':'var(--ink-3)',flexShrink:0,width:90,textAlign:'right'}}>
                  {fmtKRW(c.used,{compact:true})} / {fmtKRW(c.limit,{compact:true})}
                </div>
                <div style={{fontSize:11,fontFamily:'var(--mono)',color:isHigh?'var(--negative)':'var(--ink-4)',flexShrink:0,width:38,textAlign:'right'}}>
                  {pct.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardBillModal({ym,current,onSave,onClose,cards}){
  const [vals,setVals]=uS(()=>{ const i={}; cards.forEach(c=>{i[c.id]=current.breakdown?.[c.id]||'';}); return i; });
  const total=Object.values(vals).reduce((s,v)=>s+(parseInt(v)||0),0);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,23,20,0.55)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--paper)',borderRadius:'var(--r-lg)',padding:24,width:'100%',maxWidth:380,maxHeight:'85vh',overflow:'auto',boxShadow:'var(--shadow-lg)'}}>
        <div className="serif" style={{fontSize:18,marginBottom:6}}>{ym.split('-')[1]}월 카드 청구액</div>
        <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:16}}>매달 1일 결정되는 카드사별 청구금액</div>
        {cards.map(c=>(
          <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{flex:1,fontSize:13,fontWeight:500}}>{c.co} <span style={{fontSize:11,color:'var(--ink-4)'}}>{c.name}</span></div>
            <input type="number" value={vals[c.id]} onChange={e=>setVals(v=>({...v,[c.id]:e.target.value}))} placeholder="0"
              style={{width:100,padding:'7px 10px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,fontFamily:'var(--mono)',background:'var(--bg)',textAlign:'right'}} />
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:'1px solid var(--line)',marginBottom:14}}>
          <span style={{fontWeight:600}}>합계</span>
          <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--negative)'}}>{fmtKRW(total)}</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={()=>onSave({total,breakdown:Object.fromEntries(Object.entries(vals).map(([k,v])=>[k,parseInt(v)||0]))})}>저장</button>
          <button className="btn" style={{flex:1,justifyContent:'center'}} onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

function CardUsageEditRow({c,pct,isHigh,store,toast}){
  const [editing,setEditing]=uS(false);
  return (
    <div>
      <div className="row">
        <div className="cat-mark" style={{background:'var(--paper-2)',color:'var(--ink)',fontFamily:'var(--mono)',fontSize:11}}>{c.co.slice(0,2)}</div>
        <div className="row-body" style={{maxWidth:200}}><div className="row-title">{c.co}</div><div className="row-meta">{c.name} · {c.paymentDay}일</div></div>
        <div style={{flex:1}}><div className="bar"><div className="bar-fill" style={{width:pct+'%',background:isHigh?'var(--negative)':'var(--accent)'}}></div></div></div>
        <div className="mono text-sm" style={{textAlign:'right',minWidth:120}}><span className={'fw6 '+(isHigh?'neg':'')}>{fmtKRW(c.used)}</span><span className="faint"> / {fmtKRW(c.limit,{compact:true})}</span></div>
        <button className="icon-btn" style={{width:28,height:28}} onClick={()=>setEditing(!editing)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      </div>
      {editing && <InlineCardEdit c={c} onSave={(p)=>{store.updateCard(c.id,p);toast('수정됨');setEditing(false);}} onCancel={()=>setEditing(false)} />}
    </div>
  );
}

function InlineCardEdit({c,onSave,onCancel}){
  const [used,setUsed]=uS(c.used); const [limit,setLimit]=uS(c.limit);
  const st={padding:'7px 10px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,fontFamily:'var(--mono)',background:'var(--bg)',width:'100%'};
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto',gap:8,padding:'10px 14px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0',alignItems:'end'}}>
      <div><div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:3}}>이달 사용액</div><input type="number" value={used} onChange={e=>setUsed(+e.target.value)} style={st} /></div>
      <div><div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:3}}>한도</div><input type="number" value={limit} onChange={e=>setLimit(+e.target.value)} style={st} /></div>
      <button className="btn btn-primary btn-sm" onClick={()=>onSave({used,limit})}>저장</button>
      <button className="btn btn-sm" onClick={onCancel}>취소</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ACCOUNTS — per-bank flows
// ─────────────────────────────────────────────────────────
function AccountsPage({ openAccount, openIncome }) {
  const store = useStore();
  const toast = useToast();
  const [bank, setBank] = uS(store.state.accounts[0]?.id);
  const [editBal, setEditBal] = uS(false);
  const [addingFlow, setAddingFlow] = uS(false);
  const [editFlowId, setEditFlowId] = uS(null);

  uM(()=>{ if(!store.state.accounts.find(a=>a.id===bank)&&store.state.accounts[0]) setBank(store.state.accounts[0].id); },[store.state.accounts,bank]);

  const a = store.state.accounts.find(x=>x.id===bank)||store.state.accounts[0];
  if(!a) return (
    <div className="tab-content">
      <PageHeader eyebrow="Accounts" title="No accounts " titleEm="yet." right={<button className="btn btn-primary" onClick={openAccount}>+ 통장 추가</button>} />
    </div>
  );

  const isDebt = a.balance<0;
  const pct = isDebt?(Math.abs(a.balance)/(a.limit||1))*100:0;
  const bankFlows = ((store.state.bankFlows||{})[bank])||[];
  const inTotal  = bankFlows.filter(f=>f.kind==='in').reduce((s,f)=>s+f.amount,0);
  const outTotal = bankFlows.filter(f=>f.kind==='out'||f.kind==='var').reduce((s,f)=>s+f.amount,0);
  const kindColor = {in:'var(--positive)',out:'var(--negative)',var:'var(--warm)'};

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Accounts" title="Money in motion, " titleEm="by account."
        right={<div className="gap-sm"><button className="btn" onClick={openIncome}>월 수입</button><button className="btn btn-primary" onClick={openAccount}>+ 통장</button></div>} />

      <div style={{marginBottom:16,display:'flex',gap:6,flexWrap:'wrap'}}>
        {store.state.accounts.map(x=>(
          <button key={x.id} className={'btn '+(x.id===bank?'btn-primary':'')} style={{padding:'6px 14px'}} onClick={()=>setBank(x.id)}>{x.name}</button>
        ))}
      </div>

      <div className="card" style={{padding:28,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{a.name} · {a.sub}</div>
            {editBal ? (
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <input type="number" id="bal-edit-inp" defaultValue={a.balance} style={{padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:18,fontFamily:'var(--mono)',background:'var(--bg)',width:180}} />
                <button className="btn btn-primary btn-sm" onClick={()=>{ const v=parseInt(document.getElementById('bal-edit-inp').value); if(!isNaN(v)){store.updateAccount(a.id,{balance:v});toast('잔액 수정됨');} setEditBal(false); }}>저장</button>
                <button className="btn btn-sm" onClick={()=>setEditBal(false)}>취소</button>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'baseline',gap:12}}>
                <div className="serif" style={{fontSize:40,fontWeight:400,letterSpacing:'-0.04em',color:isDebt?'var(--negative)':'var(--ink)'}}>{fmtKRW(a.balance)}</div>
                <button className="btn btn-sm" onClick={()=>setEditBal(true)}>잔액 수정</button>
              </div>
            )}
            <div style={{marginTop:8,fontSize:12.5,color:'var(--ink-3)'}}>{isDebt?`한도 ${fmtKRW(a.limit,{compact:true})} · ${pct.toFixed(1)}% 사용`:'입출금 가능'}</div>
          </div>
          {store.state.accounts.length>1&&<button className="icon-btn" onClick={()=>{if(confirm(`"${a.name}"을 삭제?`)){store.deleteAccount(a.id);toast('삭제됨');}}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>}
        </div>
        {isDebt&&<div style={{marginTop:14}}><div className="bar" style={{height:6}}><div className="bar-fill" style={{width:pct+'%',background:'var(--negative)'}}></div></div></div>}
      </div>

      <div className="grid-3" style={{marginBottom:14}}>
        <Tile label="이달 유입" num={'+'+fmtKRW(inTotal,{compact:true})} accent="var(--positive)" />
        <Tile label="이달 지출" num={'−'+fmtKRW(outTotal,{compact:true})} accent="var(--negative)" />
        <Tile label="순 변동" num={(inTotal-outTotal>=0?'+':'−')+fmtKRW(Math.abs(inTotal-outTotal),{compact:true})} accent="var(--accent)" />
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="card-title">{a.name} <em>자금 흐름</em></div><div className="card-sub">{bankFlows.length}건</div></div>
          <button className="btn btn-primary btn-sm" onClick={()=>setAddingFlow(true)}>+ 항목</button>
        </div>
        {bankFlows.length===0&&!addingFlow&&(
          <div style={{padding:'28px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>
            자금 흐름 항목이 없습니다<br/>
            <button className="btn btn-sm" style={{marginTop:10}} onClick={()=>setAddingFlow(true)}>+ 추가</button>
          </div>
        )}
        {[...bankFlows].sort((a,b)=>(a.day||0)-(b.day||0)).map(f=>(
          <div key={f.id}>
            <div className="row">
              <div className={'day-chip '+(f.kind||'out')}>{f.day||'-'}</div>
              <div className="row-body"><div className="row-title">{f.desc}</div><div className="row-meta">{f.meta}</div></div>
              <div className={'row-amt mono fw6'} style={{color:kindColor[f.kind||'out']}}>{f.kind==='in'?'+':'−'}{fmtKRW(f.amount)}</div>
              <button className="icon-btn" style={{width:28,height:28}} onClick={()=>setEditFlowId(editFlowId===f.id?null:f.id)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button className="icon-btn" style={{width:28,height:28}} onClick={()=>{store.deleteBankFlow(bank,f.id);toast('삭제됨');}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
            {editFlowId===f.id&&<BankFlowEditRow initial={f} onSave={(p)=>{store.updateBankFlow(bank,f.id,p);toast('수정됨');setEditFlowId(null);}} onCancel={()=>setEditFlowId(null)} />}
          </div>
        ))}
        {addingFlow&&<BankFlowEditRow initial={{day:'',kind:'out',desc:'',meta:'',amount:''}} isNew onSave={(d)=>{store.addBankFlow(bank,d);toast('추가됨');setAddingFlow(false);}} onCancel={()=>setAddingFlow(false)} />}
      </div>
    </div>
  );
}

function BankFlowEditRow({initial,onSave,onCancel,isNew}){
  const [day,setDay]=uS(initial.day||'');
  const [kind,setKind]=uS(initial.kind||'out');
  const [desc,setDesc]=uS(initial.desc||'');
  const [meta,setMeta]=uS(initial.meta||'');
  const [amt,setAmt]=uS(initial.amount||'');
  const st={padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',width:'100%'};
  return (
    <div style={{display:'grid',gridTemplateColumns:'50px 60px 1fr 1fr 100px auto auto',gap:6,padding:'10px 12px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0',alignItems:'end'}}>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>일</div><input type="number" min="1" max="31" value={day} onChange={e=>setDay(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>유형</div>
        <select value={kind} onChange={e=>setKind(e.target.value)} style={{...st,cursor:'pointer'}}>
          <option value="in">유입</option><option value="out">지출</option><option value="var">변동</option>
        </select>
      </div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>내용</div><input value={desc} onChange={e=>setDesc(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>메모</div><input value={meta} onChange={e=>setMeta(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} style={{...st,fontFamily:'var(--mono)'}}/></div>
      <button className="btn btn-primary btn-sm" onClick={()=>onSave({day:+day,kind,desc,meta,amount:+amt})}>{isNew?'추가':'저장'}</button>
      <button className="btn btn-sm" onClick={onCancel}>취소</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// FLOW MAP — dynamic real data
// ─────────────────────────────────────────────────────────
function FlowMapPage() {
  const store = useStore();
  const toast = useToast();
  const { y, m } = store.state.month;
  const ym = `${y}-${String(m).padStart(2,'0')}`;
  const [editSalary,setEditSalary]=uS(false);
  const [salaryVal,setSalaryVal]=uS('');

  const salary    = ((store.state.monthlySalaries||{})[ym])||store.state.income;
  const salaryDay = store.state.salaryDay || 25;
  const woori     = store.state.accounts.find(a=>a.id==='woori');
  const curMinus  = woori?.balance||0;
  const overrides = (store.state.fixedOverrides||{})[ym]||{};
  const activeFixed = store.state.fixed.filter(f=>overrides[f.id]!==false);
  const cardBill    = ((store.state.monthlyCardBills||{})[ym])||{};
  const cardBillTotal = cardBill.total||0;

  // ── 올바른 30일 예상 로직 ──
  // 현재 잔액은 오늘까지 일어난 모든 입출금이 반영된 실제값
  // 따라서 오늘 이후 남은 것만 계산하면 됨
  const now2 = new Date();
  const todayDay2 = now2.getDate();
  const isCurMonth = y===now2.getFullYear() && m===now2.getMonth()+1;
  // 오늘 이후 나가는 고정비 (day > today)
  const remainingFixed = isCurMonth
    ? activeFixed.filter(f => f.day > todayDay2).reduce((s,f)=>s+f.amount,0)
    : activeFixed.reduce((s,f)=>s+f.amount,0);
  // 오늘 이후 들어오는 급여 (아직 안 받은 경우)
  const remainingSalary = (isCurMonth && salaryDay > todayDay2) ? salary : 0;
  // 카드대금 (아직 안 나간 경우)
  const cardPayMaxDay = store.state.cards.reduce((m,c)=>Math.max(m,c.paymentDay||14),14);
  const remainingCardBill = (isCurMonth && cardPayMaxDay > todayDay2) ? cardBillTotal : 0;
  const predicted30 = curMinus + remainingSalary - remainingFixed - remainingCardBill;

  // 우리은행 자금흐름에서 출금 항목들
  const wooriFlows = ((store.state.bankFlows||{}).woori || []).filter(f=>f.kind==='out'||f.kind==='var');
  // 목적지별 그룹핑 (desc 기반)
  const flowDestinations = uSe(() => {
    // 은행/증권사 키워드로 그룹핑
    const destMap = {};
    wooriFlows.forEach(f => {
      const key = f.desc; // 각 항목을 목적지로
      if (!destMap[key]) destMap[key] = { desc: f.desc, meta: f.meta, amount: 0, day: f.day, kind: f.kind };
      destMap[key].amount += f.amount;
    });
    return Object.values(destMap).sort((a,b)=>a.day-b.day);
  }, [wooriFlows]);

  // 카테고리별 색상 (이체 목적에 따라)
  const getDestColor = (desc) => {
    const d = desc.toLowerCase();
    if (d.includes('농협')) return '#10B981';
    if (d.includes('신한')) return '#3B82F6';
    if (d.includes('케이') || d.includes('kbank')) return '#6366F1';
    if (d.includes('기업') || d.includes('ibk')) return '#8B5CF6';
    if (d.includes('하나')) return '#F59E0B';
    if (d.includes('카드')) return '#5B6CB5';
    if (d.includes('isa') || d.includes('연금') || d.includes('투자') || d.includes('증권')) return '#EC4899';
    if (d.includes('와이프') || d.includes('생활')) return '#F97316';
    if (d.includes('수협') || d.includes('적금')) return '#14B8A6';
    return 'var(--ink-3)';
  };
  const node = (bg, border, accent) => ({
    background: bg, border: `2px solid ${border}`, borderRadius: 14,
    padding: '14px 18px', position: 'relative', boxShadow: `0 2px 12px ${accent}22`
  });
  const arrow = { display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)', fontSize:20, margin:'4px 0', userSelect:'none' };
  const lbl = { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:4 };
  const bigNum = (color) => ({ fontFamily:'var(--serif)', fontSize:26, fontWeight:400, letterSpacing:'-0.03em', color, lineHeight:1.1 });
  const rowSt = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--line)', fontSize:12.5 };

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Flow" title="자금 흐름 " titleEm="모식도" sub="급여 → 우리은행 허브 → 각 고정비 출금 경로" />

      {/* 다이어그램 레이아웃 */}
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:0, maxWidth:680, margin:'0 auto'}}>

        {/* 소득 노드 */}
        <div style={{...node('color-mix(in oklab,var(--positive) 8%,var(--paper))','var(--positive)','#10B981'), width:'100%', maxWidth:420}}>
          <div style={{...lbl, color:'var(--positive)'}}>📥 급여 수입 · {salaryDay}일 입금</div>
          <div style={{display:'flex', alignItems:'baseline', gap:12, justifyContent:'space-between'}}>
            {editSalary ? (
              <div style={{display:'flex',gap:8,alignItems:'center',flex:1}}>
                <input type="number" value={salaryVal} onChange={e=>setSalaryVal(e.target.value)}
                  style={{flex:1,padding:'7px 10px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:14,fontFamily:'var(--mono)',background:'var(--bg)'}} />
                <button className="btn btn-primary btn-sm" onClick={()=>{const v=parseInt(salaryVal);if(!isNaN(v)){store.setSalaryForMonth(ym,v);toast('급여 저장됨');}setEditSalary(false);}}>저장</button>
                <button className="btn btn-sm" onClick={()=>setEditSalary(false)}>취소</button>
              </div>
            ) : (
              <>
                <div style={bigNum('var(--positive)')}>{fmtKRW(salary)}</div>
                <button className="btn btn-sm" onClick={()=>{setSalaryVal(String(salary));setEditSalary(true);}}>수정</button>
              </>
            )}
          </div>
          {isCurMonth && salaryDay <= todayDay2 && <div style={{fontSize:11,color:'var(--positive)',marginTop:4}}>✅ 이달 수령 완료</div>}
        </div>

        {/* 화살표 ↓ */}
        <div style={arrow}>↓</div>

        {/* 우리은행 허브 노드 */}
        <div style={{...node('color-mix(in oklab,var(--accent) 7%,var(--paper))','var(--accent)','var(--accent)'), width:'100%', maxWidth:420}}>
          <div style={{...lbl, color:'var(--accent)'}}>🏦 우리은행 마이너스통장 — 허브</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:4}}>
            <div>
              <div style={{fontSize:11,color:'var(--ink-4)',marginBottom:3}}>현재 잔액</div>
              <div style={bigNum('var(--negative)')}>{fmtKRW(curMinus)}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:'var(--ink-4)',marginBottom:3}}>
                {isCurMonth ? `${new Date().getDate()}일 기준 30일 예상` : '월말 예상'}
              </div>
              <div style={bigNum(predicted30>=curMinus?'var(--positive)':'var(--negative)')}>{fmtKRW(predicted30)}</div>
              <div style={{fontSize:10.5,color:'var(--ink-4)',marginTop:3,lineHeight:1.6}}>
                {isCurMonth ? (
                  <>
                    {remainingSalary>0 && `+급여 ${fmtKRW(remainingSalary,{compact:true})} `}
                    {remainingFixed>0 && `−고정비 ${fmtKRW(remainingFixed,{compact:true})} `}
                    {remainingCardBill>0 && `−카드 ${fmtKRW(remainingCardBill,{compact:true})}`}
                    {remainingSalary===0&&remainingFixed===0&&remainingCardBill===0 && '오늘 이후 추가 입출금 없음'}
                  </>
                ) : ''}
              </div>
            </div>
          </div>
          {woori?.limit && (
            <div style={{marginTop:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--ink-4)',marginBottom:3}}>
                <span>한도 사용률</span>
                <span>{(Math.abs(curMinus)/woori.limit*100).toFixed(1)}%</span>
              </div>
              <div style={{height:5,background:'var(--paper-2)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',background:'var(--negative)',borderRadius:3,width:Math.min(Math.abs(curMinus)/woori.limit*100,100)+'%'}}></div>
              </div>
            </div>
          )}
        </div>

        {/* 화살표 ↓ */}
        <div style={arrow}>↓</div>

        {/* 출금 목적지 노드들 */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:10, width:'100%'}}>
          {/* 카드 청구 */}
          {cardBillTotal > 0 && (
            <div style={node('var(--paper)','#5B6CB5','#5B6CB5')}>
              <div style={{...lbl,color:'#5B6CB5'}}>💳 카드 청구</div>
              <div style={bigNum('#5B6CB5')}>−{fmtKRW(cardBillTotal,{compact:true})}</div>
              <div style={{marginTop:6}}>
                {store.state.cards.map(c=>{ const amt=cardBill.breakdown?.[c.id]||0; return amt>0?(<div key={c.id} style={{fontSize:11,display:'flex',justifyContent:'space-between',padding:'2px 0',color:'var(--ink-3)'}}><span>{c.co}</span><span style={{fontFamily:'var(--mono)'}}>{fmtKRW(amt,{compact:true})}</span></div>):null; })}
              </div>
              {isCurMonth && cardPayMaxDay <= todayDay2 && <div style={{fontSize:10,color:'var(--ink-3)',marginTop:4}}>✅ 완료</div>}
            </div>
          )}

          {/* 우리은행 bankFlows 기반 출금 목적지 */}
          {flowDestinations.length > 0 ? flowDestinations.map((dest, i) => {
            const color = getDestColor(dest.desc);
            const isPast = isCurMonth && dest.day < todayDay2;
            return (
              <div key={i} style={node('var(--paper)', isPast?'var(--ink-3)':color, isPast?'#888':color)}>
                <div style={{...lbl, color: isPast?'var(--ink-3)':color}}>
                  {dest.day}일 이체
                </div>
                <div style={bigNum(isPast?'var(--ink-3)':'var(--negative)')}>
                  −{fmtKRW(dest.amount,{compact:true})}
                </div>
                <div style={{fontSize:12,color:'var(--ink-3)',marginTop:4,lineHeight:1.4}}>{dest.desc}</div>
                {dest.meta && <div style={{fontSize:10.5,color:'var(--ink-4)',marginTop:2}}>{dest.meta}</div>}
                {isPast && <div style={{fontSize:10,color:'var(--ink-3)',marginTop:4}}>✅ 완료</div>}
              </div>
            );
          }) : (
            /* 기본 고정비 그룹 fallback */
            Object.entries(groups).filter(([g])=>g!=='농협은행'&&g!=='자동결제').map(([grp,items])=>{
              const grpTotal = items.reduce((s,f)=>s+f.amount,0);
              const isPast = isCurMonth && items.every(f=>f.day < todayDay2);
              return (
                <div key={grp} style={node('var(--paper)',isPast?'var(--ink-3)':'var(--warm)',isPast?'#888':'var(--warm)')}>
                  <div style={{...lbl,color:isPast?'var(--ink-3)':'var(--warm)'}}>{grp}</div>
                  <div style={bigNum(isPast?'var(--ink-3)':'var(--negative)')}>−{fmtKRW(grpTotal,{compact:true})}</div>
                  {items.sort((a,b)=>a.day-b.day).map(f=>(<div key={f.id} style={{fontSize:11,display:'flex',justifyContent:'space-between',padding:'2px 0',color:'var(--ink-3)'}}><span>{f.day}일 {f.name}</span><span style={{fontFamily:'var(--mono)'}}>{fmtKRW(f.amount,{compact:true})}</span></div>))}
                  {isPast && <div style={{fontSize:10,color:'var(--ink-3)',marginTop:4}}>✅ 완료</div>}
                </div>
              );
            })
          )}

          {/* 합계 요약 */}
          <div style={{...node('color-mix(in oklab,var(--negative) 6%,var(--paper))','var(--negative)','var(--negative)'), display:'flex', flexDirection:'column', justifyContent:'center'}}>
            <div style={{...lbl,color:'var(--negative)'}}>📤 이달 총 출금</div>
            <div style={bigNum('var(--negative)')}>
              −{fmtKRW((flowDestinations.reduce((s,d)=>s+d.amount,0)||activeFixed.reduce((s,f)=>s+f.amount,0))+cardBillTotal,{compact:true})}
            </div>
            <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:8,lineHeight:1.8}}>
              {flowDestinations.length>0
                ? `통장이체 ${fmtKRW(flowDestinations.reduce((s,d)=>s+d.amount,0),{compact:true})} + 카드 ${fmtKRW(cardBillTotal,{compact:true})}`
                : `고정비 ${fmtKRW(activeFixed.reduce((s,f)=>s+f.amount,0),{compact:true})} + 카드 ${fmtKRW(cardBillTotal,{compact:true})}`
              }
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        {flowDestinations.length === 0 && (
          <div style={{marginTop:12,padding:'10px 14px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',fontSize:12,color:'var(--ink-2)'}}>
            💡 통장별 자금 흐름 탭 → 우리은행 → 항목 추가 시 이 모식도에 자동 반영됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// FIXED COSTS — Woori-only, per-month independent amounts
// ─────────────────────────────────────────────────────────
function FixedCostsPage({ openFixed }) {
  const store = useStore();
  const toast = useToast();
  const { y, m } = store.state.month;
  const ym = `${y}-${String(m).padStart(2,'0')}`;
  const [viewMode, setViewMode] = uS('this');
  const [editItem, setEditItem] = uS(null);

  const nextDate = new Date(y, m, 1);
  const nextYm   = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
  const targetYm = viewMode === 'this' ? ym : nextYm;
  const overrides = (store.state.fixedOverrides || {})[targetYm] || {};
  const mfa       = (store.state.monthlyFixedAmounts || {})[targetYm] || {}; // month-specific amounts

  // 우리은행 관련 고정비만 — 농협은행/자동결제 그룹 + 주담대 메타 포함 항목 제외
  const NONWOORI_GROUPS = ['농협은행','자동결제'];
  const isNonWoori = (f) =>
    NONWOORI_GROUPS.includes(f.group) ||
    (f.meta||'').includes('농협은행') ||
    (f.name||'').includes('주담대');

  const wooriFixed = uSe(() =>
    store.state.fixed.filter(f => !isNonWoori(f)),
    [store.state.fixed]
  );

  const now = new Date();
  const todayDay = now.getDate();
  const isCurrentMonth = viewMode === 'this' && y === now.getFullYear() && m === now.getMonth()+1;

  // 항목의 이달 실적용 금액 (월별 오버라이드 우선)
  const getAmount = (item) => mfa[item.id] !== undefined ? mfa[item.id] : item.amount;

  const getItemStatus = (item) => {
    if (overrides[item.id] === false) return 'excluded';
    if (!isCurrentMonth) return 'active';
    return item.day < todayDay ? 'completed' : 'pending';
  };

  const groups = uSe(() => {
    const g = {};
    wooriFixed.forEach(f => { if (!g[f.group]) g[f.group] = []; g[f.group].push(f); });
    return Object.entries(g).map(([group, items]) => ({ group, items: items.sort((a,b)=>a.day-b.day) }));
  }, [wooriFixed]);

  const completedItems = wooriFixed.filter(f => getItemStatus(f) === 'completed');
  const pendingItems   = wooriFixed.filter(f => getItemStatus(f) === 'pending');
  const completedTotal = completedItems.reduce((s,f) => s+getAmount(f), 0);
  const pendingTotal   = pendingItems.reduce((s,f) => s+getAmount(f), 0);
  const activeTotal    = completedTotal + pendingTotal;
  const total          = wooriFixed.reduce((s,f)=>s+getAmount(f), 0);

  const statusBadge = (status) => ({
    completed: <span style={{fontSize:10,background:'var(--ink-3)',color:'#fff',borderRadius:4,padding:'1px 6px',marginLeft:6,fontWeight:600}}>완료</span>,
    pending:   <span style={{fontSize:10,background:'var(--accent)',color:'#fff',borderRadius:4,padding:'1px 6px',marginLeft:6,fontWeight:600}}>예정</span>,
    excluded:  <span style={{fontSize:10,background:'var(--paper-2)',color:'var(--ink-3)',borderRadius:4,padding:'1px 6px',marginLeft:6,fontWeight:600}}>제외</span>,
    active:    null,
  }[status]);

  return (
    <div className="tab-content">
      <PageHeader eyebrow="우리은행 고정비" title="Fixed costs, " titleEm="Woori."
        right={<button className="btn btn-primary" onClick={openFixed}>+ 항목 추가</button>} />

      {/* 요약 타일 */}
      {isCurrentMonth ? (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
          {[
            {label:`✅ 완료 (${completedItems.length}건)`, val:completedTotal, sub:'이미 빠져나간 금액', color:'var(--ink-3)'},
            {label:`⏳ 예정 (${pendingItems.length}건)`,  val:pendingTotal,   sub:'앞으로 나갈 금액',  color:'var(--negative)'},
            {label:'📊 이달 합계',                         val:activeTotal,    sub:`소득의 ${Math.round(activeTotal/store.state.income*100)}%`, color:'var(--warm)'},
          ].map((t,i) => (
            <div key={i} style={{padding:'14px 16px',background:'var(--paper)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',borderTop:`3px solid ${t.color}`}}>
              <div style={{fontSize:10.5,fontWeight:700,color:t.color,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{t.label}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700,color:t.color}}>{fmtKRW(t.val)}</div>
              <div style={{fontSize:11,color:'var(--ink-4)',marginTop:4}}>{t.sub}</div>
            </div>
          ))}
          <div style={{padding:'14px 16px',background:'var(--paper)',border:'1px solid var(--line)',borderRadius:'var(--r-md)'}}>
            <div style={{fontSize:10.5,fontWeight:700,color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>진행률</div>
            <div style={{fontFamily:'var(--mono)',fontSize:20,fontWeight:700}}>{activeTotal?Math.round(completedTotal/activeTotal*100):0}%</div>
            <div style={{marginTop:8,height:5,background:'var(--paper-2)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',background:'var(--ink-3)',borderRadius:3,width:activeTotal?(completedTotal/activeTotal*100)+'%':'0%',transition:'width .5s'}}></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-3" style={{marginBottom:14}}>
          <Tile label="적용 합계" num={fmtKRW(total)} sub={`${wooriFixed.length}개`} accent="var(--negative)" />
          <Tile label="소득 대비" num={`${Math.round(total/store.state.income*100)}%`} accent="var(--warm)" />
          <Tile label="항목 수" num={`${wooriFixed.filter(f=>overrides[f.id]!==false).length}개 활성`} accent="var(--accent)" />
        </div>
      )}

      {/* 이달/다음달 탭 */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <button className={'btn '+(viewMode==='this'?'btn-primary':'')} onClick={()=>setViewMode('this')}>{m}월 이번달</button>
        <button className={'btn '+(viewMode==='next'?'btn-primary':'')} onClick={()=>setViewMode('next')}>{nextDate.getMonth()+1}월 다음달</button>
        {isCurrentMonth && <span style={{fontSize:11.5,color:'var(--ink-3)'}}>📅 {todayDay}일 기준 · 체크박스로 포함/제외 · 금액은 달마다 독립 설정 가능</span>}
      </div>
      {viewMode==='next'&&<div style={{background:'var(--accent-soft)',border:'1px solid var(--accent-line)',borderRadius:'var(--r-md)',padding:'10px 14px',marginBottom:12,fontSize:12.5,color:'var(--ink-2)'}}>💡 다음달 고정비를 미리 조정합니다. 금액 수정 시 다음달에만 적용됩니다.</div>}

      {groups.map(g => {
        const gActive = g.items.reduce((s,f)=>s+(overrides[f.id]!==false?getAmount(f):0), 0);
        return (
          <div key={g.group} className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
            <div className="between" style={{padding:'14px 20px',background:'var(--paper-2)',borderBottom:'1px solid var(--line)'}}>
              <div>
                <div className="card-title">🏦 {g.group}</div>
                {isCurrentMonth && <div style={{fontSize:11.5,color:'var(--ink-3)',marginTop:2}}>
                  완료 {fmtKRW(g.items.filter(f=>getItemStatus(f)==='completed').reduce((s,f)=>s+getAmount(f),0),{compact:true})} ·
                  예정 {fmtKRW(g.items.filter(f=>getItemStatus(f)==='pending').reduce((s,f)=>s+getAmount(f),0),{compact:true})}
                </div>}
              </div>
              <div className="serif" style={{fontSize:20,fontWeight:500}}>{fmtKRW(gActive)}</div>
            </div>
            <div style={{padding:'4px 20px'}}>
              {g.items.map(item => {
                const status = getItemStatus(item);
                const isDone = status === 'completed';
                const isExcl = status === 'excluded';
                const amt    = getAmount(item);
                const hasCustomAmt = mfa[item.id] !== undefined;
                return (
                  <div key={item.id} style={{opacity:isExcl?.35:isDone?.58:1, borderRadius:6, transition:'opacity .2s'}}>
                    <div className="row" style={{padding:'10px 0'}}>
                      <label style={{display:'flex',alignItems:'center',cursor:'pointer',flexShrink:0}}>
                        <input type="checkbox" checked={overrides[item.id]!==false}
                          onChange={e=>store.setFixedOverride(targetYm,item.id,e.target.checked)}
                          style={{width:14,height:14,accentColor:'var(--accent)',cursor:'pointer'}} />
                      </label>
                      <div className={'day-chip '+(isDone?'':'out')} style={{background:isDone?'var(--ink-3)':'',color:isDone?'#fff':'',marginLeft:8}}>{item.day}</div>
                      <div className="row-body" style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                          <span className="row-title" style={{textDecoration:isExcl?'line-through':'none'}}>{item.name}</span>
                          {statusBadge(status)}
                          {hasCustomAmt && <span style={{fontSize:10,background:'#5B6CB5',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:600}}>이달수정</span>}
                        </div>
                        <div className="row-meta">{item.meta}</div>
                      </div>
                      <div className="mono fw6" style={{color:isDone?'var(--ink-3)':isExcl?'var(--ink-4)':'var(--negative)',textDecoration:isExcl?'line-through':'none',fontSize:14}}>
                        {isExcl?fmtKRW(amt):'−'+fmtKRW(amt)}
                      </div>
                      <button className="icon-btn" style={{width:28,height:28}} onClick={()=>setEditItem(editItem?.id===item.id?null:item)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button className="icon-btn" style={{width:28,height:28}} onClick={()=>{store.deleteFixed(item.id);toast('삭제됨');}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                    {editItem?.id === item.id && (
                      <InlineEditFixedIndep item={item} ym={targetYm} mfa={mfa}
                        onSaveGlobal={(p)=>{store.updateFixed(item.id,p);toast('전체 수정됨');setEditItem(null);}}
                        onSaveMonth={(amt)=>{store.setMonthlyFixedAmount(targetYm,item.id,amt);toast(`${targetYm.split('-')[1]}월만 수정됨`);setEditItem(null);}}
                        onResetMonth={()=>{store.setMonthlyFixedAmount(targetYm,item.id,null);toast('이달 금액 초기화됨');setEditItem(null);}}
                        onCancel={()=>setEditItem(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────
// TIMELINE — hover tooltip + editable right panel
// ─────────────────────────────────────────────────────────
function TimelinePage() {
  const store = useStore();
  const toast = useToast();
  const { y, m } = store.state.month;
  const [hovered,setHovered]=uS(null);
  const [selected,setSelected]=uS(null);
  const [ttPos,setTtPos]=uS({x:0,y:0});
  const [editId,setEditId]=uS(null);
  const daysInMonth=new Date(y,m,0).getDate();
  const firstDow=new Date(y,m-1,1).getDay();
  const todayDay=new Date().getDate();
  const isCurMonth=y===new Date().getFullYear()&&m===new Date().getMonth()+1;
  const eventMap=uSe(()=>{
    const map={};
    store.state.fixed.forEach(f=>{if(!map[f.day])map[f.day]=[];map[f.day].push({kind:'out',label:f.name,amount:f.amount,id:f.id});});
    return map;
  },[store.state.fixed]);
  const dayNames=['일','월','화','수','목','금','토'];
  const selectedEvs=selected?(eventMap[selected]||[]):[];

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Calendar" title="Monthly " titleEm="schedule." right={<MonthSwitchLive />} />
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>자금 흐름 캘린더</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
            {dayNames.map(d=><div key={d} style={{textAlign:'center',fontSize:10.5,fontWeight:700,color:'var(--ink-4)',padding:'3px 0'}}>{d}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
            {Array(firstDow).fill(null).map((_,i)=><div key={'e'+i}></div>)}
            {Array(daysInMonth).fill(null).map((_,i)=>{
              const d=i+1; const evs=eventMap[d]||[];
              const isToday=isCurMonth&&d===todayDay; const isSel=d===selected; const hasEv=evs.length>0;
              return (
                <div key={d} style={{
                  aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  borderRadius:8,cursor:hasEv?'pointer':'default',gap:2,
                  background:isSel?'var(--accent)':isToday?'#FEF9C3':hasEv?'var(--paper-2)':'transparent',
                  border:isToday?'2px solid #EAB308':isSel?'none':hasEv?'1px solid var(--line)':'none',
                  transition:'all .12s'
                }}
                  onClick={()=>setSelected(d===selected?null:d)}
                  onMouseEnter={e=>{if(hasEv){const r=e.currentTarget.getBoundingClientRect();setTtPos({x:r.left+r.width/2,y:r.bottom+6});setHovered(d);}}}
                  onMouseLeave={()=>setHovered(null)}
                >
                  <span style={{fontSize:12,fontWeight:isToday||hasEv?700:400,color:isSel?'#fff':isToday?'#854D0E':hasEv?'var(--ink)':'var(--ink-3)'}}>{d}</span>
                  {hasEv&&<div style={{width:4,height:4,borderRadius:'50%',background:isSel?'rgba(255,255,255,0.8)':'var(--negative)'}}></div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{minHeight:200}}>
          {selected ? (
            <>
              <div className="card-head"><div className="card-title">{m}월 <em>{selected}일</em></div><button className="icon-btn" onClick={()=>setSelected(null)}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
              {selectedEvs.length===0 ? <div style={{padding:'20px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>예정 항목 없음</div>
              : selectedEvs.map(ev=>(
                <div key={ev.id}>
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
                    <div className="day-chip out" style={{width:30,height:30,fontSize:11}}>{selected}</div>
                    <div style={{flex:1,fontSize:13.5,fontWeight:500}}>{ev.label}</div>
                    <div className="mono fw6 neg text-sm">−{fmtKRW(ev.amount)}</div>
                    <button className="icon-btn" style={{width:26,height:26}} onClick={()=>setEditId(editId===ev.id?null:ev.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                  </div>
                  {editId===ev.id&&<InlineEditFixed item={store.state.fixed.find(f=>f.id===ev.id)||{id:ev.id,name:ev.label,day:selected,amount:ev.amount,meta:'',group:''}} onSave={(p)=>{store.updateFixed(ev.id,p);toast('수정됨');setEditId(null);}} onCancel={()=>setEditId(null)} />}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="card-title" style={{marginBottom:10}}>이달 <em>일정 목록</em></div>
              <div style={{fontSize:11.5,color:'var(--ink-4)',marginBottom:10}}>날짜를 클릭하면 상세 수정</div>
              {Object.entries(eventMap).sort((a,b)=>+a[0]-+b[0]).map(([day,evs])=>(
                <div key={day} onClick={()=>setSelected(+day)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--line)',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--paper-2)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div className="day-chip out" style={{width:28,height:28,fontSize:11}}>{day}</div>
                  <div style={{flex:1}}>{evs.map((e,i)=><div key={i} style={{fontSize:12.5,color:'var(--ink-2)'}}>{e.label}</div>)}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--negative)'}}>−{fmtKRW(evs.reduce((s,e)=>s+e.amount,0))}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {hovered&&eventMap[hovered]&&(
        <div style={{position:'fixed',left:ttPos.x,top:ttPos.y,transform:'translateX(-50%)',background:'var(--ink)',color:'var(--bg)',padding:'10px 14px',borderRadius:10,fontSize:12.5,zIndex:999,pointerEvents:'none',maxWidth:260,boxShadow:'0 4px 20px rgba(0,0,0,.2)',lineHeight:1.7}}>
          <div style={{fontWeight:700,marginBottom:4}}>{m}월 {hovered}일</div>
          {(eventMap[hovered]||[]).map((e,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',gap:14}}><span>{e.label}</span><span style={{fontFamily:'var(--mono)',fontWeight:600}}>−{fmtKRW(e.amount)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────
function ExpensesPage({ openExpense }) {
  const store = useStore();
  const toast = useToast();
  const monthExp = useMonthExpenses();
  const [filter,setFilter]=uS('all');
  const [search,setSearch]=uS('');
  const [sortBy,setSortBy]=uS('date');
  const [cardFilter,setCardFilter]=uS('all');
  const filtered=uSe(()=>{
    let l=[...monthExp];
    if(filter!=='all')l=l.filter(e=>e.cat===filter);
    if(cardFilter!=='all')l=l.filter(e=>e.card===cardFilter);
    if(search)l=l.filter(e=>(e.title+e.cat+e.card).toLowerCase().includes(search.toLowerCase()));
    if(sortBy==='amount')l.sort((a,b)=>b.amount-a.amount);
    else if(sortBy==='amount-asc')l.sort((a,b)=>a.amount-b.amount);
    return l;
  },[monthExp,filter,cardFilter,search,sortBy]);
  const total=filtered.reduce((s,e)=>s+e.amount,0);
  const hasFilters=filter!=='all'||cardFilter!=='all'||search||sortBy!=='date';
  const byDate=uSe(()=>{ const m={}; if(sortBy==='date')filtered.forEach(e=>{if(!m[e.date])m[e.date]=[];m[e.date].push(e);}); return m; },[filtered,sortBy]);
  const dates=Object.keys(byDate).sort().reverse();
  const toneMap={accent:'var(--accent)',indigo:'#5B6CB5',warm:'var(--warm)',pos:'var(--positive)',neg:'var(--negative)'};
  const cardOpts=[{value:'all',label:'모든 카드'},...store.state.cards.map(c=>({value:c.co,label:c.co}))];
  const dayNames=['일','월','화','수','목','금','토'];

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Spending" title="Day by " titleEm="day." sub={`이달 ${monthExp.length}건 · ${fmtKRW(monthExp.reduce((s,e)=>s+e.amount,0))}`}
        right={<button className="btn btn-primary" onClick={openExpense} style={{display:'flex',alignItems:'center',gap:6}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>소비 추가</button>} />
      <button onClick={openExpense} className="expense-fab" style={{position:'fixed',bottom:'calc(72px + env(safe-area-inset-bottom,0px))',right:20,width:52,height:52,borderRadius:'50%',background:'var(--accent)',color:'#fff',border:'none',boxShadow:'0 4px 20px rgba(0,0,0,.25)',cursor:'pointer',zIndex:80,alignItems:'center',justifyContent:'center'}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div className="grid-4" style={{marginBottom:14}}>
        <Tile label="이달 소비" num={fmtKRW(total)} sub={`${filtered.length}건`} accent="var(--negative)" />
        <Tile label="일 평균" num={fmtKRW(Math.round(total/Math.max(new Date().getDate(),1)))} />
        <Tile label="최다 카테고리" num={(()=>{ const t=filtered.reduce((a,e)=>{a[e.cat]=(a[e.cat]||0)+e.amount;return a;},{}); const top=Object.entries(t).sort((a,b)=>b[1]-a[1])[0]; return top?top[0]:'—'; })()} accent="var(--accent)" />
        <Tile label="필터 결과" num={`${filtered.length}건`} accent="var(--positive)" />
      </div>
      <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input placeholder="🔎 검색" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:'0 1 160px',padding:'7px 11px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,background:'var(--bg)'}} />
          <select value={cardFilter} onChange={e=>setCardFilter(e.target.value)} style={{padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',cursor:'pointer'}}>
            {cardOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',cursor:'pointer'}}>
            <option value="date">날짜순</option><option value="amount">큰 금액</option><option value="amount-asc">작은 금액</option>
          </select>
          {hasFilters&&<button className="btn btn-sm" onClick={()=>{setFilter('all');setSearch('');setCardFilter('all');setSortBy('date');}}>초기화</button>}
        </div>
        <div style={{marginTop:8,display:'flex',gap:4,flexWrap:'wrap'}}>
          <button onClick={()=>setFilter('all')} className={'chip '+(filter==='all'?'accent':'')} style={{cursor:'pointer',border:filter==='all'?'1px solid var(--accent-line)':'1px solid var(--line)'}}>전체</button>
          {CAT_DEFS.map(c=>(
            <button key={c.cat} onClick={()=>setFilter(c.cat)} className={'chip '+(filter===c.cat?'accent':'')} style={{cursor:'pointer',border:filter===c.cat?'1px solid var(--accent-line)':'1px solid var(--line)',fontSize:11.5}}>
              {c.label.split(' ')[0]} {c.cat}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">{sortBy==='date'?'최근 ':'금액 '}<em>{sortBy==='date'?'소비':'정렬'}</em></div><span className="text-sm muted">{filtered.length}건</span></div>
        {filtered.length===0 ? <div style={{padding:40,textAlign:'center',color:'var(--ink-4)'}}><div className="serif" style={{fontSize:18,fontStyle:'italic',marginBottom:6}}>결과가 없어요</div></div>
        : sortBy!=='date' ? <div>{filtered.map(e=><ExpenseRow key={e.id} e={e} toneMap={toneMap} onDelete={()=>{store.deleteExpense(e.id);toast('삭제됨');}} onUpdate={(p)=>{store.updateExpense(e.id,p);toast('수정됨');}} store={store} showDate />)}</div>
        : dates.map(date=>{
          const d=new Date(date+'T00:00:00'); const dayTotal=byDate[date].reduce((s,e)=>s+e.amount,0);
          return (
            <div key={date} style={{marginBottom:14}}>
              <div className="between" style={{padding:'9px 0',borderBottom:'1px solid var(--line)',marginBottom:3}}>
                <div style={{display:'flex',alignItems:'baseline',gap:7}}><span className="serif" style={{fontSize:15,fontWeight:500}}>{d.getMonth()+1}월 {d.getDate()}일</span><span className="text-xs faint">{dayNames[d.getDay()]}</span></div>
                <span className="mono fw6 neg text-sm">−{fmtKRW(dayTotal)}</span>
              </div>
              {byDate[date].map(e=><ExpenseRow key={e.id} e={e} toneMap={toneMap} onDelete={()=>{store.deleteExpense(e.id);toast('삭제됨');}} onUpdate={(p)=>{store.updateExpense(e.id,p);toast('수정됨');}} store={store} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CREDIT CARDS — with detail panel
// ─────────────────────────────────────────────────────────
function CreditCardsPage({ openCard }) {
  const store = useStore();
  const toast = useToast();
  const { y, m } = store.state.month;
  const ym = `${y}-${String(m).padStart(2,'0')}`;
  const [selectedCard,setSelectedCard]=uS(null);
  const [editCardId,setEditCardId]=uS(null);

  // Auto-apply scheduled payments
  uM(()=>{
    const today=new Date(); const todayDay=today.getDate();
    const todayYm=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const key=`gf_ap_${todayYm}`; const applied=JSON.parse(localStorage.getItem(key)||'[]');
    (store.state.cards||[]).forEach(c=>{
      if(c.paymentDay&&c.paymentDay<=todayDay&&c.used>0){
        const k=`${c.id}_${todayYm}`;
        if(!applied.includes(k)){
          const dateStr=`${todayYm}-${String(c.paymentDay).padStart(2,'0')}`;
          const exists=store.state.expenses.find(e=>e.date===dateStr&&e.title.includes(c.co)&&e.title.includes('카드결제'));
          if(!exists){
            store.addExpense({date:dateStr,cat:'보험',mark:'카',tone:'neg',title:`${c.co} 카드결제 (자동)`,card:c.co,amount:c.used});
            applied.push(k); localStorage.setItem(key,JSON.stringify(applied));
          }
        }
      }
    });
  },[]);

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Cards" title="Card " titleEm="portfolio." sub="카드 클릭 → 상세 정보 / 혜택 입력" right={<button className="btn btn-primary" onClick={openCard}>+ 카드 추가</button>} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:14,marginBottom:20}}>
        {store.state.cards.map(c=>(
          <div key={c.id} className="cc" style={{background:c.gradient,cursor:'pointer',transition:'transform .15s,box-shadow .15s'}}
            onClick={()=>setSelectedCard(selectedCard?.id===c.id?null:c)}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,.3)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
            <div style={{position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div><div className="cc-co">{c.co}</div><div className="cc-name">{c.name}</div></div>
              <div style={{display:'flex',gap:5}}>
                <span style={{background:'rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.8)',padding:'2px 7px',borderRadius:5,fontSize:11}}>상세</span>
                <button onClick={e=>{e.stopPropagation();if(confirm('삭제?')){store.deleteCard(c.id);toast('삭제됨');}}} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'rgba(255,255,255,0.7)',width:22,height:22,borderRadius:5,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="cc-foot"><span>•••• {c.last4}</span><span>결제일 {c.paymentDay}일</span></div>
          </div>
        ))}
      </div>
      {selectedCard&&<CardDetailPanel c={selectedCard} store={store} toast={toast} onClose={()=>setSelectedCard(null)} />}

      {/* 자동결제 관리 — 이달/다음달 탭 */}
      <AutoPaySection store={store} toast={toast} y={store.state.month.y} m={store.state.month.m} />
    </div>
  );
}

function CardDetailPanel({c,store,toast,onClose}){
  const [benefits,setBenefits]=uS(c.benefits||'');
  const [annualFee,setFee]=uS(c.annualFee||0);
  const [memo,setMemo]=uS(c.memo||'');
  return (
    <div className="card" style={{marginBottom:16,borderTop:'3px solid var(--accent)'}}>
      <div className="card-head">
        <div><div className="card-title">{c.co} <em>{c.name}</em></div><div className="card-sub">카드 상세 · 클릭으로 수정</div></div>
        <button className="icon-btn" onClick={onClose}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        <div style={{padding:'12px',background:'var(--paper-2)',borderRadius:'var(--r-md)'}}><div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:3}}>결제일</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700}}>{c.paymentDay}일</div></div>
        <div style={{padding:'12px',background:'var(--paper-2)',borderRadius:'var(--r-md)'}}><div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:3}}>이달 사용액</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--negative)'}}>{fmtKRW(c.used)}</div></div>
        <div style={{padding:'12px',background:'var(--paper-2)',borderRadius:'var(--r-md)'}}><div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:3}}>한도</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700}}>{fmtKRW(c.limit)}</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><div style={{fontSize:11,fontWeight:600,color:'var(--ink-3)',marginBottom:5}}>주요 혜택</div>
          <textarea value={benefits} onChange={e=>setBenefits(e.target.value)} rows={3} placeholder="예: 온라인 1.5% 적립, 주유 할인"
            style={{width:'100%',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,background:'var(--bg)',resize:'vertical',fontFamily:'var(--sans)'}} /></div>
        <div>
          <div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:600,color:'var(--ink-3)',marginBottom:5}}>연회비 (원)</div>
            <input type="number" value={annualFee} onChange={e=>setFee(e.target.value)} style={{width:'100%',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,fontFamily:'var(--mono)',background:'var(--bg)'}} /></div>
          <div><div style={{fontSize:11,fontWeight:600,color:'var(--ink-3)',marginBottom:5}}>메모</div>
            <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="기타 메모" style={{width:'100%',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:13,background:'var(--bg)'}} /></div>
        </div>
      </div>
      <button className="btn btn-primary" style={{justifyContent:'center'}} onClick={()=>{store.updateCard(c.id,{benefits,annualFee:+annualFee,memo});toast('저장됨');}}>저장</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ANALYTICS — 마이너스 청산 시뮬레이션 + AI 분석
// ─────────────────────────────────────────────────────────
function AnalyticsPage() {
  const store = useStore();
  const toast = useToast();
  const monthExp = useMonthExpenses();
  const [aiResult, setAiResult] = uS('');
  const [aiLoading, setAiLoading] = uS(false);

  const catTotals = uSe(()=>monthExp.reduce((a,e)=>{a[e.cat]=(a[e.cat]||0)+e.amount;return a;},{}), [monthExp]);
  const monthTotals = uSe(()=>{
    const m={};
    store.state.expenses.forEach(e=>{const ym=e.date.slice(0,7);m[ym]=(m[ym]||0)+e.amount;});
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  },[store.state.expenses]);
  const catColors={'식사':'var(--accent)','카페':'var(--warm)','마트':'var(--positive)','교통':'var(--negative)'};
  const catSegs = Object.entries(catTotals).map(([l,v])=>({label:l,value:v,color:catColors[l]||'var(--ink-3)'}));
  const maxMonth = Math.max(...monthTotals.map(([,v])=>v),1);

  // ── 마이너스 통장 청산 시뮬레이션 ── (이달 실제 적용 고정비 사용)
  const woori     = store.state.accounts.find(a=>a.id==='woori');
  const curMinus  = woori?.balance || 0;
  const salary    = store.state.income;
  const { y: cy, m: cm } = store.state.month;
  const cym = `${cy}-${String(cm).padStart(2,'0')}`;
  const curOverrides = (store.state.fixedOverrides||{})[cym]||{};
  const curMfa = (store.state.monthlyFixedAmounts||{})[cym]||{};
  // 이달 실제 적용되는 고정비 합계
  const fixedOut  = store.state.fixed
    .filter(f=>curOverrides[f.id]!==false)
    .reduce((s,f)=>s+(curMfa[f.id]!==undefined?curMfa[f.id]:f.amount),0);
  const autoPayOut= (store.state.auto_pays||[]).reduce((s,ap)=>s+ap.amount,0);
  const avgExp    = monthTotals.length ? monthTotals.reduce((s,[,v])=>s+v,0)/monthTotals.length : 500000;
  const monthlyNet = salary - fixedOut - autoPayOut - avgExp;

  // 시뮬레이션 데이터 (12개월 간격으로 표시)
  const simData = uSe(()=>{
    const pts = [];
    let bal = curMinus;
    for (let i = 0; i <= 120; i++) {
      pts.push({ month: i, balance: bal });
      if (bal >= 0) break;
      bal = Math.min(bal + monthlyNet, 0);
    }
    return pts;
  }, [curMinus, monthlyNet]);
  const clearMonth = simData.find(p=>p.balance>=0);
  const simMax = Math.abs(curMinus);
  // 표시할 포인트: 0, 6, 12, 18... 개월 + 청산 시점
  const simPts = simData.filter((_,i)=>i===0||i%6===0||i===simData.length-1);

  // ── AI 분석 ──
  const runAI = async () => {
    setAiLoading(true);
    setAiResult('');
    try {
      const summary = {
        minusBalance: curMinus,
        minusLimit: woori?.limit || 150000000,
        salary, fixedCosts: fixedOut,
        autoPayments: autoPayOut,
        avgMonthlyExpense: Math.round(avgExp),
        monthlyNet,
        estimatedClearMonths: clearMonth?.month || '60+',
        mortgage: store.state.mortgage,
        topCategories: Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${fmtKRW(v)}`).join(', '),
      };
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:1000,
          messages:[{role:'user', content:`당신은 재정 전문가입니다. 아래 재정 데이터를 분석하고 한국어로 간결하게 (3~4개 포인트) 조언해주세요.\n\n${JSON.stringify(summary, null, 2)}\n\n분석 내용:\n1. 마이너스통장 청산 전략\n2. 소비 패턴의 개선점\n3. 주담대 상환과 마이너스 관리 우선순위\n4. 이달 주의할 점\n\n마크다운 없이 평문으로 작성하세요.`}]
        })
      });
      const data = await res.json();
      setAiResult(data.content?.[0]?.text || '분석 결과를 가져올 수 없습니다.');
    } catch(e) {
      setAiResult('AI 분석 중 오류가 발생했습니다: ' + e.message);
    }
    setAiLoading(false);
  };

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Insights" title="Spending " titleEm="patterns." />

      {/* 마이너스 청산 시뮬레이션 */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-head">
          <div>
            <div className="card-title">📉 마이너스 통장 <em>청산 시뮬레이션</em></div>
            <div className="card-sub">
              현재 {fmtKRW(curMinus)} · 월 순감소 {fmtKRW(monthlyNet,{compact:true})} ·
              {clearMonth ? ` 약 ${clearMonth.month}개월 후 청산 예상` : ' 60개월 내 청산 어려움'}
            </div>
          </div>
        </div>

        {/* SVG 라인 차트 */}
        {(() => {
          const W=600, H=200, PL=64, PR=20, PT=16, PB=36;
          const chartW=W-PL-PR, chartH=H-PT-PB;
          const allVals = simData.map(p=>p.balance);
          const minV=Math.min(...allVals,0), maxV=0;
          const range=maxV-minV||1;
          const toX=(i)=>PL+(i/(simData.length-1||1))*chartW;
          const toY=(v)=>PT+((maxV-v)/range)*chartH;
          const pts=simData.map((p,i)=>`${toX(i)},${toY(p.balance)}`).join(' ');
          const area=`${PL},${PT+chartH} `+simData.map((p,i)=>`${toX(i)},${toY(p.balance)}`).join(' ')+` ${toX(simData.length-1)},${PT+chartH}`;
          // Y-axis labels (3 levels)
          const yTicks = [curMinus, curMinus/2, 0];
          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',marginTop:8}}>
              <defs>
                <linearGradient id="simGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {yTicks.map((v,i)=>(
                <g key={i}>
                  <line x1={PL} y1={toY(v)} x2={W-PR} y2={toY(v)} stroke="var(--line)" strokeWidth="1" strokeDasharray={i>0?"4,4":""}/>
                  <text x={PL-6} y={toY(v)+4} fontSize="11" fill="var(--ink-4)" textAnchor="end">{fmtKRW(v,{compact:true})}</text>
                </g>
              ))}
              {/* Area */}
              <polygon points={area} fill="url(#simGrad)"/>
              {/* Line */}
              <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Clear point marker */}
              {clearMonth && (()=>{
                const idx=simData.findIndex(p=>p.balance>=0);
                return idx>=0?<circle cx={toX(idx)} cy={toY(0)} r="5" fill="var(--positive)" stroke="var(--paper)" strokeWidth="2"/>:null;
              })()}
              {/* X-axis labels every 12 months */}
              {simData.filter((_,i)=>i===0||i%12===0).map((p,_,arr)=>{
                const idx=simData.indexOf(p);
                return <text key={idx} x={toX(idx)} y={H-4} fontSize="11" fill="var(--ink-4)" textAnchor="middle">{p.month}개월</text>;
              })}
            </svg>
          );
        })()}

        <div style={{marginTop:12,padding:'10px 14px',background:'var(--paper-2)',borderRadius:'var(--r-sm)',fontSize:12,color:'var(--ink-3)',lineHeight:1.8}}>
          💡 계산 기준: 급여 {fmtKRW(salary,{compact:true})} − 고정비 {fmtKRW(fixedOut,{compact:true})}(이달 실적용) − 자동결제 {fmtKRW(autoPayOut,{compact:true})} − 평균소비 {fmtKRW(Math.round(avgExp),{compact:true})} = 월 {fmtKRW(monthlyNet,{compact:true})} 감소
        </div>
      </div>

      <div className="grid-3-2" style={{marginBottom:16}}>
        {/* 카테고리 도넛 */}
        <div className="card">
          <div className="card-head"><div className="card-title">카테고리별 <em>분포</em></div></div>
          {catSegs.length===0 ? <div style={{padding:'30px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>이달 소비 없음</div> : (
            <div style={{display:'flex',alignItems:'center',gap:18,marginTop:6}}>
              <Donut segments={catSegs} center={<><div className="text-xs muted">합계</div><div className="serif" style={{fontSize:17,fontWeight:500,marginTop:2}}>{fmtKRW(monthExp.reduce((s,e)=>s+e.amount,0),{compact:true})}</div></>} />
              <div style={{flex:1,fontSize:12.5}}>
                {catSegs.sort((a,b)=>b.value-a.value).slice(0,6).map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:s.color,flexShrink:0}}></span>
                    <span style={{flex:1,fontSize:12}}>{s.label}</span>
                    <span className="mono fw6" style={{fontSize:12}}>{fmtKRW(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 월별 추이 */}
        <div className="card">
          <div className="card-head"><div className="card-title">월별 <em>소비 추이</em></div></div>
          {monthTotals.length<2 ? <div style={{padding:'30px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>데이터 부족</div> : (
            <div style={{marginTop:10}}>
              {monthTotals.map(([ym,total])=>(
                <div key={ym} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:44,fontSize:11.5,fontFamily:'var(--mono)',color:'var(--ink-3)'}}>{ym.slice(5)}월</div>
                  <div style={{flex:1,height:6,background:'var(--paper-2)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',background:'var(--accent)',borderRadius:3,width:(total/maxMonth*100)+'%',transition:'width .5s'}}></div></div>
                  <div style={{width:70,fontSize:12,fontFamily:'var(--mono)',fontWeight:600,textAlign:'right'}}>{fmtKRW(total,{compact:true})}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI 분석 */}
      <div className="card">
        <div className="card-head">
          <div><div className="card-title">🤖 AI <em>재정 분석</em></div><div className="card-sub">Claude가 이달 재정 상태를 분석합니다</div></div>
          <button className="btn btn-primary btn-sm" onClick={runAI} disabled={aiLoading}>
            {aiLoading ? '분석 중...' : '분석 실행'}
          </button>
        </div>
        {aiLoading && (
          <div style={{padding:'20px 0',textAlign:'center',color:'var(--ink-3)',fontSize:13}}>
            <div style={{marginBottom:8}}>🤔 재정 데이터를 분석하고 있습니다...</div>
            <div style={{width:'100%',height:3,background:'var(--paper-2)',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:'var(--accent)',borderRadius:2,width:'60%',animation:'none'}}></div>
            </div>
          </div>
        )}
        {aiResult && !aiLoading && (
          <div style={{padding:'16px 0',fontSize:13.5,color:'var(--ink)',lineHeight:1.9,whiteSpace:'pre-wrap'}}>{aiResult}</div>
        )}
        {!aiResult && !aiLoading && (
          <div style={{padding:'20px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>
            "분석 실행" 버튼을 누르면 현재 재정 상태에 대한 AI 조언을 받을 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────

// 주담대 현황 박스 — 깔끔한 serif 숫자 스타일
function MortgageBox({ store, toast }) {
  const [editing, setEditing] = uS(false);
  const mg = store.state.mortgage || {};
  const balance  = mg.balance  || 0;
  const original = mg.original || 300000000;
  const rate     = mg.rate     || 4.66;
  const autoAmt  = mg.autoPayment || 1272220;
  const extra    = (mg.extraPayment||500000) + (mg.wifePayment||500000);
  const totalMonthly = autoAmt + extra;
  const paidPct  = Math.min((original - balance) / original * 100, 100);
  const monthsLeft = balance > 0 ? Math.ceil(balance / totalMonthly) : 0;

  const [b, setB]   = uS(balance);
  const [r, setR]   = uS(rate);
  const [a, setA]   = uS(autoAmt);
  const [ex, setEx] = uS(mg.extraPayment||500000);
  const [wf, setWf] = uS(mg.wifePayment||500000);
  const inpSt = {padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, background:'var(--bg)', fontFamily:'var(--mono)', width:'100%'};

  if (editing) {
    return (
      <div style={{background:'var(--paper)', border:'1px solid var(--line)', borderRadius:'var(--r-lg)', padding:'18px 22px', marginBottom:14, borderTop:'3px solid #10B981'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#10B981',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:14}}>🏠 주담대 정보 수정</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:14}}>
          {[
            {label:'현재 잔액', val:b, set:setB},
            {label:'금리 (%)', val:r, set:setR, step:0.01},
            {label:'고정 원리금/월', val:a, set:setA},
            {label:'본인 추가상환/월', val:ex, set:setEx},
            {label:'와이프 추가상환/월', val:wf, set:setWf},
          ].map(({label,val,set,step},i) => (
            <div key={i}>
              <div style={{fontSize:10.5,color:'var(--ink-4)',marginBottom:4}}>{label}</div>
              <input type="number" value={val} step={step||1} onChange={e=>set(+e.target.value)} style={inpSt} />
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary btn-sm" onClick={()=>{store.updateMortgage({balance:b,rate:r,autoPayment:a,extraPayment:ex,wifePayment:wf});toast('저장됨');setEditing(false);}}>저장</button>
          <button className="btn btn-sm" onClick={()=>setEditing(false)}>취소</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{background:'var(--paper)', border:'1px solid var(--line)', borderRadius:'var(--r-lg)', padding:'18px 22px', marginBottom:14, borderTop:'3px solid #10B981'}}>
      {/* 헤더 */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div>
          <div style={{fontSize:10.5, fontWeight:700, color:'#10B981', textTransform:'uppercase', letterSpacing:'0.1em'}}>🏠 주담대</div>
          <div style={{fontSize:12, color:'var(--ink-3)', marginTop:2}}>{mg.bank||'농협은행'} · 금리 {rate}% · 원금 {fmtKRW(original,{compact:true})}</div>
        </div>
        <button className="btn btn-sm" onClick={()=>setEditing(true)}>수정</button>
      </div>

      {/* 핵심 숫자 3칸 */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:14}}>
        <div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginBottom:4}}>잔여 잔액</div>
          <div style={{fontFamily:'var(--serif)', fontSize:24, fontWeight:400, letterSpacing:'-0.03em', color:'var(--warm)', lineHeight:1}}>{fmtKRW(balance)}</div>
        </div>
        <div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginBottom:4}}>월 총상환액</div>
          <div style={{fontFamily:'var(--serif)', fontSize:24, fontWeight:400, letterSpacing:'-0.03em', color:'var(--ink)', lineHeight:1}}>{fmtKRW(totalMonthly)}</div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginTop:3}}>원리금 {fmtKRW(autoAmt,{compact:true})} + 추가 {fmtKRW(extra,{compact:true})}</div>
        </div>
        <div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginBottom:4}}>예상 완납</div>
          <div style={{fontFamily:'var(--serif)', fontSize:24, fontWeight:400, letterSpacing:'-0.03em', color:'var(--ink)', lineHeight:1}}>{monthsLeft}개월</div>
          <div style={{fontSize:10.5, color:'var(--ink-4)', marginTop:3}}>약 {Math.round(monthsLeft/12*10)/10}년 후</div>
        </div>
      </div>

      {/* 진행 바 */}
      <div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:11.5, color:'var(--ink-3)', marginBottom:5}}>
          <span style={{fontWeight:600, color:'#10B981'}}>상환 {paidPct.toFixed(1)}%</span>
          <span>{fmtKRW(original-balance,{compact:true})} 완료 / {fmtKRW(original,{compact:true})} 총액</span>
        </div>
        <div style={{height:6, background:'var(--paper-2)', borderRadius:3, overflow:'hidden'}}>
          <div style={{height:'100%', background:'#10B981', borderRadius:3, width:paidPct+'%', transition:'width .5s'}}></div>
        </div>
      </div>
    </div>
  );
}
function InlineEditFixedIndep({ item, ym, mfa, onSaveGlobal, onSaveMonth, onResetMonth, onCancel }) {
  const [name,    setName]    = uS(item.name);
  const [meta,    setMeta]    = uS(item.meta||'');
  const [day,     setDay]     = uS(item.day||'');
  const [amtGlobal, setAmtGlobal] = uS(item.amount||'');
  const [amtMonth,  setAmtMonth]  = uS(mfa[item.id]??item.amount);
  const [group,   setGroup]   = uS(item.group||'기타');
  const [mode,    setMode]    = uS('month'); // 'month' | 'global'
  const st = {padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',width:'100%'};
  const monthName = ym.split('-')[1];
  return (
    <div style={{padding:'12px 14px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0'}}>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        <button className={'btn btn-sm '+(mode==='month'?'btn-primary':'')} onClick={()=>setMode('month')}>{monthName}월만 수정</button>
        <button className={'btn btn-sm '+(mode==='global'?'btn-primary':'')} onClick={()=>setMode('global')}>항목 자체 수정 (전체)</button>
        {mfa[item.id]!==undefined && <button className="btn btn-sm" onClick={onResetMonth} style={{marginLeft:'auto'}}>이달 초기화</button>}
      </div>
      {mode === 'month' ? (
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'var(--ink-3)'}}>금액 ({monthName}월만)</span>
          <input type="number" value={amtMonth} onChange={e=>setAmtMonth(e.target.value)} style={{...st,width:130,fontFamily:'var(--mono)'}} />
          <button className="btn btn-primary btn-sm" onClick={()=>onSaveMonth(+amtMonth)}>저장</button>
          <button className="btn btn-sm" onClick={onCancel}>취소</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:6,alignItems:'end'}}>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>항목명</div><input value={name} onChange={e=>setName(e.target.value)} style={st}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>메모</div><input value={meta} onChange={e=>setMeta(e.target.value)} style={st}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>일</div><input type="number" min="1" max="31" value={day} onChange={e=>setDay(e.target.value)} style={st}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액 (기본)</div><input type="number" value={amtGlobal} onChange={e=>setAmtGlobal(e.target.value)} style={{...st,fontFamily:'var(--mono)'}}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>그룹</div><input value={group} onChange={e=>setGroup(e.target.value)} style={st}/></div>
          <div style={{display:'flex',gap:5,alignItems:'flex-end'}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>onSaveGlobal({name,meta,day:+day,amount:+amtGlobal,group})}>전체저장</button>
            <button className="btn btn-sm" style={{flex:1}} onClick={onCancel}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 신용카드 자동결제 관리 섹션 (월별 완전 독립)
function AutoPaySection({ store, toast, y, m }) {
  const now = new Date();
  const ym  = `${y}-${String(m).padStart(2,'0')}`;
  const nextDate = new Date(y, m, 1);
  const nextYm   = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
  const [viewMode, setViewMode] = uS('this');
  const [adding,   setAdding]   = uS(false);
  const [editApId, setEditApId] = uS(null);
  const [newAp,    setNewAp]    = uS({cardCo:'', service:'', amount:'', day:''});
  const targetYm = viewMode === 'this' ? ym : nextYm;
  const todayDay = now.getDate();
  const isCurMonth = viewMode === 'this' && y === now.getFullYear() && m === now.getMonth()+1;

  // 이 달의 독립적 자동결제 목록 가져오기
  // monthlyAutoPays[ym]가 없으면 auto_pays를 복사해서 초기화
  const monthlyAPs = store.state.monthlyAutoPays || {};
  const hasMonthData = monthlyAPs[targetYm] !== undefined;
  const allAPs = hasMonthData ? monthlyAPs[targetYm] : (store.state.auto_pays || []);

  // 처음 접근 시 자동 초기화 (auto_pays 복사)
  uM(() => {
    if (!hasMonthData && (store.state.auto_pays||[]).length > 0) {
      store.initMonthAutoPays(targetYm, store.state.auto_pays || []);
    }
  }, [targetYm]);

  const totalAP = allAPs.reduce((s,ap) => s+ap.amount, 0);
  const st = {padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)'};
  const byCard = {};
  allAPs.forEach(ap => { if(!byCard[ap.cardCo]) byCard[ap.cardCo]=[]; byCard[ap.cardCo].push(ap); });

  const handleAdd = () => {
    if(!newAp.cardCo||!newAp.service) return;
    const cardObj = store.state.cards.find(c=>c.co===newAp.cardCo);
    store.addMonthAutoPay(targetYm, {cardId:cardObj?.id||'', cardCo:newAp.cardCo, service:newAp.service, amount:+newAp.amount, day:+newAp.day});
    toast(`${targetYm.split('-')[1]}월 자동결제 추가됨`);
    setNewAp({cardCo:'',service:'',amount:'',day:''});
    setAdding(false);
  };

  const handleDelete = (apId) => {
    store.deleteMonthAutoPay(targetYm, apId);
    toast('삭제됨');
  };

  const handleUpdate = (apId, patch) => {
    store.updateMonthAutoPay(targetYm, apId, patch);
    toast('수정됨');
    setEditApId(null);
  };

  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div>
          <div className="card-title">자동결제 <em>관리</em></div>
          <div className="card-sub">{targetYm.split('-')[1]}월 독립 관리 · 합계 {fmtKRW(totalAP)}/월</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className={'btn btn-sm '+(viewMode==='this'?'btn-primary':'')} onClick={()=>setViewMode('this')}>{m}월</button>
          <button className={'btn btn-sm '+(viewMode==='next'?'btn-primary':'')} onClick={()=>setViewMode('next')}>{nextDate.getMonth()+1}월</button>
          <button className="btn btn-sm btn-primary" onClick={()=>setAdding(true)}>+ 추가</button>
        </div>
      </div>

      <div style={{background:'var(--accent-soft)',border:'1px solid var(--accent-line)',borderRadius:'var(--r-sm)',padding:'7px 11px',marginBottom:10,fontSize:11.5,color:'var(--ink-2)'}}>
        💡 각 월의 자동결제는 독립적으로 관리됩니다. {targetYm.split('-')[1]}월의 추가/삭제는 다른 달에 영향을 주지 않습니다.
      </div>

      {adding && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,padding:'12px 14px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',marginBottom:12}}>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>카드 선택</div>
            <select value={newAp.cardCo} onChange={e=>{
              const [co, name] = e.target.value.split('||');
              setNewAp(p=>({...p,cardCo:co,cardName:name||''}));
            }} style={{...st,width:'100%',cursor:'pointer'}}>
              <option value="">카드 선택</option>
              {store.state.cards.map(c=><option key={c.id} value={`${c.co}||${c.name}`}>{c.co} — {c.name}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>서비스명</div><input value={newAp.service} onChange={e=>setNewAp(p=>({...p,service:e.target.value}))} placeholder="넷플릭스" style={{...st,width:'100%'}}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div><input type="number" value={newAp.amount} onChange={e=>setNewAp(p=>({...p,amount:e.target.value}))} style={{...st,width:'100%',fontFamily:'var(--mono)'}}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>결제일</div><input type="number" min="1" max="31" value={newAp.day} onChange={e=>setNewAp(p=>({...p,day:e.target.value}))} style={{...st,width:'100%'}}/></div>
          <div style={{display:'flex',gap:5,alignItems:'flex-end'}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={handleAdd}>추가</button>
            <button className="btn btn-sm" style={{flex:1}} onClick={()=>setAdding(false)}>취소</button>
          </div>
        </div>
      )}

      {allAPs.length === 0 && !adding && (
        <div style={{padding:'24px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>
          등록된 자동결제 없음<br/>
          <button className="btn btn-sm" style={{marginTop:8}} onClick={()=>setAdding(true)}>+ 추가</button>
        </div>
      )}

      {Object.entries(byCard).map(([co, aps]) => {
        const coTotal = aps.reduce((s,ap)=>s+ap.amount,0);
        return (
          <div key={co} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--line)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:13.5,color:'#8B5CF6'}}>{co}</div>
              <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:700,color:'#8B5CF6'}}>−{fmtKRW(coTotal)}/월</div>
            </div>
            {aps.sort((a,b)=>a.day-b.day).map(ap => {
              const isDone = isCurMonth && ap.day < todayDay;
              return (
                <div key={ap.id}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',opacity:isDone?.6:1}}>
                    <div className={'day-chip '+(isDone?'':'out')} style={{background:isDone?'var(--ink-3)':'',color:isDone?'#fff':'',width:28,textAlign:'center',fontSize:11}}>{ap.day}</div>
                    <div style={{flex:1,fontSize:13}}>{ap.service}</div>
                    {isDone && <span style={{fontSize:10,background:'var(--ink-3)',color:'#fff',borderRadius:4,padding:'1px 5px',fontWeight:600}}>완료</span>}
                    <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:'#8B5CF6'}}>−{fmtKRW(ap.amount)}</div>
                    <button className="icon-btn" style={{width:26,height:26}} onClick={()=>setEditApId(editApId===ap.id?null:ap.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button className="icon-btn" style={{width:26,height:26}} onClick={()=>handleDelete(ap.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                  {editApId === ap.id && (
                    <AutoPayEditRow ap={ap} targetYm={targetYm} customAmt={undefined} store={store} toast={toast}
                      onClose={()=>setEditApId(null)}
                      onMonthSave={(amt)=>handleUpdate(ap.id,{amount:amt})}
                      onGlobalSave={(patch)=>handleUpdate(ap.id,patch)} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// 자동결제 수정 행 — 이달만 vs 전체 선택
function AutoPayEditRow({ ap, targetYm, customAmt, store, toast, onClose, onMonthSave, onGlobalSave }) {
  const [mode, setMode] = uS('month');
  const [svc,  setSvc]  = uS(ap.service);
  const [co,   setCo]   = uS(ap.cardCo);
  const [amt,  setAmt]  = uS(ap.amount);  // 이달 금액 (수정 가능)
  const [gAmt, setGAmt] = uS(ap.amount);  // 전체 금액
  const [day,  setDay]  = uS(ap.day);
  const st = {padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)'};
  const mn = targetYm.split('-')[1];

  const handleMonthSave = () => {
    if (onMonthSave) {
      onMonthSave(+amt);
    } else {
      store.updateMonthAutoPay(targetYm, ap.id, {amount:+amt});
      toast(`${mn}월 금액 저장됨`);
    }
    onClose();
  };

  const handleGlobalSave = () => {
    const cardObj = store.state.cards.find(c=>c.co===co);
    const patch = {service:svc, cardCo:co, cardId:cardObj?.id||ap.cardId, amount:+gAmt, day:+day};
    if (onGlobalSave) {
      onGlobalSave(patch);
    } else {
      store.updateMonthAutoPay(targetYm, ap.id, patch);
      toast('수정됨');
    }
    onClose();
  };

  return (
    <div style={{padding:'10px 12px',background:'rgba(139,92,246,0.07)',borderRadius:'var(--r-sm)',margin:'4px 0'}}>
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        <button className={'btn btn-sm '+(mode==='month'?'btn-primary':'')} onClick={()=>setMode('month')}>{mn}월 금액만 수정</button>
        <button className={'btn btn-sm '+(mode==='global'?'btn-primary':'')} onClick={()=>setMode('global')}>항목 전체 수정</button>
      </div>
      {mode==='month' ? (
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'var(--ink-3)'}}>{mn}월 금액 (원)</span>
          <input type="number" value={amt} onChange={e=>setAmt(e.target.value)}
            style={{...st,width:130,fontFamily:'var(--mono)'}} />
          <button className="btn btn-primary btn-sm" onClick={handleMonthSave}>저장</button>
          <button className="btn btn-sm" onClick={onClose}>취소</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'1fr 100px 1fr 90px auto auto',gap:6,alignItems:'end'}}>
          <div>
            <div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>서비스명</div>
            <input value={svc} onChange={e=>setSvc(e.target.value)} style={{...st,width:'100%'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>결제일</div>
            <input type="number" min="1" max="31" value={day} onChange={e=>setDay(+e.target.value)} style={{...st,width:'100%'}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>카드</div>
            <select value={co} onChange={e=>setCo(e.target.value)} style={{...st,width:'100%',cursor:'pointer'}}>
              {store.state.cards.map(c=><option key={c.id} value={c.co}>{c.co} {c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div>
            <input type="number" value={gAmt} onChange={e=>setGAmt(e.target.value)} style={{...st,width:'100%',fontFamily:'var(--mono)'}}/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleGlobalSave}>저장</button>
          <button className="btn btn-sm" onClick={onClose}>취소</button>
        </div>
      )}
    </div>
  );
}
function CardSpendingRow({ c, monthExp, store, toast }) {
  const [editBudgetCard, setEditBudgetCard] = uS(false);
  const [budgetCardVal,  setBudgetCardVal]  = uS('');

  const autoPays     = (store.state.auto_pays||[]).filter(ap => ap.cardCo===c.co || ap.cardId===c.id);
  const autoPayTotal = autoPays.reduce((s,ap) => s+ap.amount, 0);
  const cardBudgetAmt= (store.state.cardMonthlyBudgets||{})[c.id] || c.limit || 1000000;
  const matchCard = (expCard, cardCo) => {
    if (!expCard || !cardCo) return false;
    return expCard === cardCo || expCard.includes(cardCo) || cardCo.includes(expCard.replace('카드','').trim())
      || expCard === c.name; // 카드 풀 이름 매칭 추가
  };
  const spent = monthExp.filter(e => matchCard(e.card, c.co) || e.card===c.name).reduce((s,e) => s+e.amount, 0);
  const remaining    = cardBudgetAmt - autoPayTotal - spent;
  const autoPct      = Math.min(autoPayTotal / cardBudgetAmt * 100, 100);
  const spentPct     = Math.min(spent / cardBudgetAmt * 100, 100 - autoPct);
  const isOver       = remaining < 0;

  // 이달 사용 없고 자동결제도 없으면 숨김
  if (spent === 0 && autoPayTotal === 0) return null;

  return (
    <div style={{marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--line)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontWeight:600, fontSize:13.5}}>{c.co}</span>
          <span style={{fontSize:11.5, color:'var(--ink-3)'}}>{c.name}</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {editBudgetCard ? (
            <div style={{display:'flex', gap:5}}>
              <input type="number" value={budgetCardVal} onChange={e=>setBudgetCardVal(e.target.value)}
                placeholder="카드예산"
                style={{width:90, padding:'4px 8px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12, fontFamily:'var(--mono)', background:'var(--bg)'}} />
              <button className="btn btn-primary btn-sm" onClick={()=>{
                const v=parseInt(budgetCardVal);
                if(!isNaN(v)){store.setCardMonthlyBudget(c.id,v);toast('예산 설정됨');}
                setEditBudgetCard(false);
              }}>저장</button>
              <button className="btn btn-sm" onClick={()=>setEditBudgetCard(false)}>✕</button>
            </div>
          ) : (
            <button className="btn btn-sm" style={{fontSize:11}} onClick={()=>{setBudgetCardVal(String(cardBudgetAmt));setEditBudgetCard(true);}}>
              예산 {fmtKRW(cardBudgetAmt,{compact:true})}
            </button>
          )}
          <span style={{fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:isOver?'var(--negative)':'var(--positive)'}}>
            {isOver ? '초과 '+fmtKRW(Math.abs(remaining)) : '잔여 '+fmtKRW(remaining)}
          </span>
        </div>
      </div>

      {/* 3단 막대: 보라(자동결제) + 주황(실사용) + 남은 여유 */}
      <div style={{height:10, background:'var(--paper-2)', borderRadius:5, overflow:'hidden', display:'flex', marginBottom:6}}>
        {autoPayTotal>0 && <div style={{height:'100%', background:'#8B5CF6', width:autoPct+'%', flexShrink:0}}></div>}
        {spent>0 && <div style={{height:'100%', background:isOver?'var(--negative)':'var(--accent)', width:spentPct+'%', flexShrink:0}}></div>}
      </div>

      <div style={{display:'flex', gap:12, fontSize:11.5, color:'var(--ink-3)', flexWrap:'wrap'}}>
        {autoPayTotal>0 && (
          <span style={{display:'flex', alignItems:'center', gap:4}}>
            <span style={{width:8,height:8,borderRadius:2,background:'#8B5CF6',display:'inline-block'}}></span>
            자동결제 {fmtKRW(autoPayTotal)}
          </span>
        )}
        <span style={{display:'flex', alignItems:'center', gap:4}}>
          <span style={{width:8,height:8,borderRadius:2,background:'var(--accent)',display:'inline-block'}}></span>
          사용 {fmtKRW(spent)}
        </span>
        <span style={{marginLeft:'auto', fontWeight:600, color:isOver?'var(--negative)':'var(--positive)'}}>
          {isOver ? '⚠️ 예산 초과' : `잔여 ${fmtKRW(remaining)}`}
        </span>
      </div>

      {/* 자동결제 항목 */}
      {autoPays.length>0 && (
        <div style={{marginTop:6, padding:'8px 10px', background:'rgba(139,92,246,0.07)', borderRadius:'var(--r-sm)', border:'1px solid rgba(139,92,246,0.18)'}}>
          <div style={{fontSize:10.5, fontWeight:700, color:'#8B5CF6', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.07em'}}>자동결제 예약</div>
          {autoPays.map(ap=>(
            <div key={ap.id} style={{display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', color:'var(--ink-2)'}}>
              <span>{ap.day}일 {ap.service}</span>
              <span style={{fontFamily:'var(--mono)', fontWeight:600, color:'#8B5CF6'}}>−{fmtKRW(ap.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineEditFixed({item,onSave,onCancel}){
  const [name,setName]=uS(item.name); const [meta,setMeta]=uS(item.meta||'');
  const [day,setDay]=uS(item.day||''); const [amount,setAmt]=uS(item.amount||'');
  const [group,setGroup]=uS(item.group||'기타');
  const st={padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',width:'100%'};
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:6,padding:'10px 12px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0',alignItems:'end'}}>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>항목명</div><input value={name} onChange={e=>setName(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>메모</div><input value={meta} onChange={e=>setMeta(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>일</div><input type="number" min="1" max="31" value={day} onChange={e=>setDay(e.target.value)} style={st}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div><input type="number" value={amount} onChange={e=>setAmt(e.target.value)} style={{...st,fontFamily:'var(--mono)'}}/></div>
      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>그룹</div><input value={group} onChange={e=>setGroup(e.target.value)} style={st}/></div>
      <div style={{display:'flex',gap:5,alignItems:'flex-end'}}>
        <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>onSave({name,meta,day:+day,amount:+amount,group})}>저장</button>
        <button className="btn btn-sm" style={{flex:1}} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

function ExpenseRow({e,toneMap,onDelete,onUpdate,store,showDate}){
  const [editing,setEditing]=uS(false);
  const [title,setTitle]=uS(e.title); const [amount,setAmount]=uS(e.amount);
  const [cat,setCat]=uS(e.cat); const [card,setCard]=uS(e.card);
  const inpSt={padding:'6px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)',fontFamily:'var(--sans)'};
  const def=getCatDef(cat);
  const tone=toneMap[def.tone]||'var(--accent)';
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
        {/* 카테고리 마크 */}
        <div style={{width:34,height:34,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'color-mix(in oklab, '+tone+' 12%, transparent)',color:tone,fontWeight:700,fontSize:13,flexShrink:0}}>{def.mark}</div>
        {/* 내용 */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.title}</div>
          <div style={{display:'flex',gap:5,marginTop:3,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:11,background:'var(--paper-2)',padding:'1px 6px',borderRadius:4,color:'var(--ink-3)'}}>{e.cat}</span>
            <span style={{fontSize:11,color:'var(--ink-4)'}}>{e.card}</span>
            {showDate&&<span style={{fontSize:11,color:'var(--ink-4)'}}>{e.date.slice(5)}</span>}
          </div>
        </div>
        {/* 금액 — 크고 bold */}
        <div style={{fontFamily:'var(--mono)',fontSize:17,fontWeight:800,color:'var(--negative)',flexShrink:0}}>−{fmtKRW(e.amount)}</div>
        {/* 수정/삭제 */}
        <button className="icon-btn" style={{width:26,height:26,flexShrink:0}} onClick={()=>setEditing(!editing)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button className="icon-btn" style={{width:26,height:26,flexShrink:0}} onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      {editing&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,padding:'10px 12px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0'}}>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>내용</div><input value={title} onChange={e=>setTitle(e.target.value)} style={{...inpSt,width:'100%'}}/></div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>금액</div><input type="number" value={amount} onChange={e=>setAmount(+e.target.value)} style={{...inpSt,width:'100%',fontFamily:'var(--mono)'}}/></div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>카테고리</div>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{...inpSt,width:'100%',cursor:'pointer'}}>
              {CAT_DEFS.map(c=><option key={c.cat} value={c.cat}>{c.label}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>카드</div>
            <select value={card} onChange={e=>setCard(e.target.value)} style={{...inpSt,width:'100%',cursor:'pointer'}}>
              {(store.state.cards||[]).map(c=><option key={c.id} value={c.name}>{c.co} — {c.name}</option>)}
              <option value="현금">현금</option>
            </select>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>{const d=getCatDef(cat);onUpdate({title,amount,cat,tone:d.tone,mark:d.mark,card});setEditing(false);}}>저장</button>
            <button className="btn btn-sm" style={{flex:1}} onClick={()=>setEditing(false)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  DashboardPage, AccountsPage, FlowMapPage, FixedCostsPage,
  TimelinePage, ExpensesPage, CreditCardsPage, AnalyticsPage,
  CAT_DEFS, getCatDef, useMonthExpenses, MonthSwitchLive,
  InlineEditFixed, ExpenseRow, MortgageBox, AutoPayEditRow
});
