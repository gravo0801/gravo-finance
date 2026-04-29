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

  // 날짜 기반: 완료(지난 것) vs 예정(앞으로)
  const now2 = new Date();
  const todayDay2 = now2.getDate();
  const isCurMonth = y===now2.getFullYear() && m===now2.getMonth()+1;
  const activeFixed = store.state.fixed.filter(f=>overrides[f.id]!==false);
  const pendingFixed = isCurMonth
    ? activeFixed.filter(f => f.day >= todayDay2)
    : activeFixed;
  const completedFixed = isCurMonth
    ? activeFixed.filter(f => f.day < todayDay2)
    : [];
  const fixedTotal   = activeFixed.reduce((s,f)=>s+f.amount,0);
  const pendingFixedTotal = pendingFixed.reduce((s,f)=>s+f.amount,0);
  const completedFixedTotal = completedFixed.reduce((s,f)=>s+f.amount,0);
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
  const byCard = {};
  monthExp.forEach(e=>{ byCard[e.card]=(byCard[e.card]||0)+e.amount; });

  const [editMinus,  setEditMinus]  = uS(false);
  const [editFixed,  setEditFixed]  = uS(false);
  const [editCard,   setEditCard]   = uS(false);
  const [editBudget, setEditBudget] = uS(false);
  const [minusVal,   setMinusVal]   = uS('');
  const [budgetVal,  setBudgetVal]  = uS('');

  const box = (color) => ({
    background:'var(--paper)', border:'1px solid var(--line)', borderRadius:'var(--r-lg)',
    padding:'20px 22px', position:'relative', overflow:'visible', borderTop:`3px solid ${color}`
  });
  const lbl = {fontSize:11,fontWeight:700,color:'var(--ink-3)',textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:8};
  const num = {fontFamily:'var(--mono)',fontSize:26,fontWeight:700,letterSpacing:'-0.03em',lineHeight:1};
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

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:14,marginBottom:20}}>

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
          {editBtnEl(()=>setEditFixed(true))}
          <div style={lbl}>이번달 고정비</div>
          <div style={{...num,color:'var(--warm)'}}>{fmtKRW(fixedTotal)}</div>
          <div style={{fontSize:11.5,color:'var(--ink-4)',marginTop:6,lineHeight:1.7}}>
            {isCurMonth ? (
              <>완료 {fmtKRW(completedFixedTotal,{compact:true})} · 예정 {fmtKRW(pendingFixedTotal,{compact:true})}</>
            ) : `${activeFixed.length}개 항목`}
          </div>
          {editFixed && (
            <div style={{position:'fixed',inset:0,background:'rgba(26,23,20,0.55)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setEditFixed(false)}>
              <div onClick={e=>e.stopPropagation()} style={{background:'var(--paper)',borderRadius:'var(--r-lg)',padding:24,width:'100%',maxWidth:400,maxHeight:'80vh',overflow:'auto',boxShadow:'var(--shadow-lg)'}}>
                <div className="serif" style={{fontSize:18,marginBottom:12}}>이달 고정비 선택</div>
                {store.state.fixed.map(f=>(
                  <label key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--line)',cursor:'pointer'}}>
                    <input type="checkbox" checked={overrides[f.id]!==false} onChange={e=>store.setFixedOverride(ym,f.id,e.target.checked)} style={{width:15,height:15,accentColor:'var(--accent)'}} />
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{f.name}</div><div style={{fontSize:11,color:'var(--ink-4)'}}>{f.day}일 · {f.group}</div></div>
                    <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:600,color:overrides[f.id]===false?'var(--ink-4)':'var(--negative)'}}>{fmtKRW(f.amount)}</div>
                  </label>
                ))}
                <button className="btn btn-primary" style={{width:'100%',marginTop:16,justifyContent:'center'}} onClick={()=>setEditFixed(false)}>확인</button>
              </div>
            </div>
          )}
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

      {/* 카드 소비 현황 — 자동결제 선예약 + 잔여 소비가능액 */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-head">
          <div><div className="card-title">이달 <em>카드 소비</em></div><div className="card-sub">{monthExp.length}건</div></div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {editBudget ? (
              <div style={{display:'flex', gap:6}}>
                <input type="number" value={budgetVal} onChange={e=>setBudgetVal(e.target.value)} placeholder="전체예산"
                  style={{width:100, padding:'6px 9px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, fontFamily:'var(--mono)', background:'var(--bg)'}} />
                <button className="btn btn-primary btn-sm" onClick={()=>{const v=parseInt(budgetVal);if(!isNaN(v)){store.setCardBudget(v);toast('예산 설정됨');}setEditBudget(false);}}>저장</button>
                <button className="btn btn-sm" onClick={()=>setEditBudget(false)}>취소</button>
              </div>
            ) : (
              <button className="btn btn-sm" onClick={()=>{setBudgetVal(String(cardBudget));setEditBudget(true);}}>총예산 {fmtKRW(cardBudget,{compact:true})}</button>
            )}
          </div>
        </div>

        {/* 카드별 상세 — 자동결제 예약 + 실사용 + 잔여 */}
        {store.state.cards.map(c => (
          <CardSpendingRow key={c.id} c={c} monthExp={monthExp} store={store} toast={toast} />
        ))}
      </div>

      {/* 카드 한도 */}
      <div className="card">
        <div className="card-head"><div className="card-title">신용카드 <em>한도 사용률</em></div><button className="btn btn-sm btn-primary" onClick={openCard}>+ 카드</button></div>
        {store.state.cards.map(c=>{
          const pct=c.limit?(c.used/c.limit)*100:0; const isHigh=pct>70;
          return <CardUsageEditRow key={c.id} c={c} pct={pct} isHigh={isHigh} store={store} toast={toast} />;
        })}
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

  const salary   = ((store.state.monthlySalaries||{})[ym])||store.state.income;
  const woori    = store.state.accounts.find(a=>a.id==='woori');
  const curMinus = woori?.balance||0;
  const overrides= (store.state.fixedOverrides||{})[ym]||{};
  const activeFixed = store.state.fixed.filter(f=>overrides[f.id]!==false);
  const fixedTotal  = activeFixed.reduce((s,f)=>s+f.amount,0);
  const cardBill    = ((store.state.monthlyCardBills||{})[ym])||{};
  const cardBillTotal = cardBill.total||0;
  const groups = {};
  activeFixed.forEach(f=>{ if(!groups[f.group])groups[f.group]=[]; groups[f.group].push(f); });
  const boxSt = (bg,bdr)=>({padding:'14px 16px',background:bg,border:`1px solid ${bdr}`,borderRadius:'var(--r-md)',marginBottom:10});
  const rowSt = {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--line)',fontSize:13};

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Flow" title="How money " titleEm="travels." sub="실제 데이터 기반 자금 흐름" />

      <div style={boxSt('var(--paper)','var(--line)')}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--positive)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>📥 {m}월 급여 (매달 25일 입금)</div>
            {editSalary ? (
              <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                <input type="number" value={salaryVal} onChange={e=>setSalaryVal(e.target.value)} placeholder="급여 입력" style={{width:160,padding:'8px 10px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:14,fontFamily:'var(--mono)',background:'var(--bg)'}} />
                <button className="btn btn-primary btn-sm" onClick={()=>{const v=parseInt(salaryVal);if(!isNaN(v)){store.setSalaryForMonth(ym,v);toast('급여 저장됨');}setEditSalary(false);}}>저장</button>
                <button className="btn btn-sm" onClick={()=>setEditSalary(false)}>취소</button>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'baseline',gap:12,marginTop:4}}>
                <span className="serif" style={{fontSize:28,fontWeight:500,color:'var(--positive)'}}>{fmtKRW(salary)}</span>
                <button className="btn btn-sm" onClick={()=>{setSalaryVal(String(salary));setEditSalary(true);}}>이달 급여 입력</button>
              </div>
            )}
          </div>
          <div style={{textAlign:'right',fontSize:12,color:'var(--ink-3)',lineHeight:1.8}}>→ 우리은행 마이너스통장<br/><span style={{fontSize:11}}>가변 항목 · 매달 직접 입력</span></div>
        </div>
      </div>

      <div style={boxSt('color-mix(in oklab, var(--accent) 5%, var(--paper))','var(--accent-line)')}>
        <div style={{fontSize:11,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>🏦 우리은행 마이너스통장 (허브)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          <div><div style={{fontSize:11,color:'var(--ink-4)',marginBottom:3}}>현재 잔액</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--negative)'}}>{fmtKRW(curMinus)}</div></div>
          <div><div style={{fontSize:11,color:'var(--ink-4)',marginBottom:3}}>이달 유입 (급여)</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:'var(--positive)'}}>+{fmtKRW(salary)}</div></div>
          <div><div style={{fontSize:11,color:'var(--ink-4)',marginBottom:3}}>30일 예상</div><div style={{fontFamily:'var(--mono)',fontSize:18,fontWeight:700,color:(curMinus+salary-fixedTotal-cardBillTotal)>curMinus?'var(--positive)':'var(--negative)'}}>{fmtKRW(curMinus+salary-fixedTotal-cardBillTotal)}</div></div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
        <div style={boxSt('var(--paper)','var(--line)')}>
          <div style={{fontSize:11,fontWeight:700,color:'#5B6CB5',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>💳 카드 청구 ({m}월)</div>
          {store.state.cards.map(c=>{ const amt=cardBill.breakdown?.[c.id]||0; return amt>0?(<div key={c.id} style={rowSt}><span>{c.co}</span><span style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--negative)'}}>−{fmtKRW(amt)}</span></div>):null; })}
          <div style={{...rowSt,borderBottom:'none',fontWeight:700}}><span>합계</span><span style={{fontFamily:'var(--mono)',color:'var(--negative)'}}>−{fmtKRW(cardBillTotal)}</span></div>
        </div>
        {Object.entries(groups).map(([grp,items])=>(
          <div key={grp} style={boxSt('var(--paper)','var(--line)')}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--warm)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{grp}</div>
            {items.sort((a,b)=>a.day-b.day).map(f=>(<div key={f.id} style={rowSt}><span style={{fontSize:12.5}}>{f.day}일 {f.name}</span><span style={{fontFamily:'var(--mono)',fontWeight:600,color:'var(--negative)'}}>−{fmtKRW(f.amount)}</span></div>))}
            <div style={{...rowSt,borderBottom:'none',fontWeight:700}}><span>소계</span><span style={{fontFamily:'var(--mono)',color:'var(--negative)'}}>−{fmtKRW(items.reduce((s,f)=>s+f.amount,0))}</span></div>
          </div>
        ))}
        <div style={{...boxSt('color-mix(in oklab, var(--negative) 5%, var(--paper))','color-mix(in oklab, var(--negative) 30%, transparent)'),display:'flex',flexDirection:'column',justifyContent:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--negative)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>📤 이달 총 출금</div>
          <div style={{fontFamily:'var(--mono)',fontSize:24,fontWeight:700,color:'var(--negative)',marginBottom:8}}>−{fmtKRW(fixedTotal+cardBillTotal)}</div>
          <div style={{fontSize:12,color:'var(--ink-3)',lineHeight:1.8}}><div>고정비: {fmtKRW(fixedTotal)}</div><div>카드:   {fmtKRW(cardBillTotal)}</div></div>
        </div>
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

  // 우리은행 관련 고정비만 표시 (농협, 자동결제 제외)
  // group이 '농협은행' 이거나 '자동결제' 이면 제외
  const wooriFixed = uSe(() =>
    store.state.fixed.filter(f => f.group !== '농협은행' && f.group !== '자동결제'),
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
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:16}}>
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
// ANALYTICS
// ─────────────────────────────────────────────────────────
function AnalyticsPage() {
  const store = useStore();
  const monthExp = useMonthExpenses();
  const catTotals=uSe(()=>monthExp.reduce((a,e)=>{a[e.cat]=(a[e.cat]||0)+e.amount;return a;},{}), [monthExp]);
  const monthTotals=uSe(()=>{
    const m={}; store.state.expenses.forEach(e=>{const ym=e.date.slice(0,7);m[ym]=(m[ym]||0)+e.amount;});
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  },[store.state.expenses]);
  const catColors={'식사':'var(--accent)','카페':'var(--warm)','마트':'var(--positive)','교통':'var(--negative)'};
  const catSegs=Object.entries(catTotals).map(([l,v])=>({label:l,value:v,color:catColors[l]||'var(--ink-3)'}));
  const maxMonth=Math.max(...monthTotals.map(([,v])=>v),1);
  return (
    <div className="tab-content">
      <PageHeader eyebrow="Insights" title="Spending " titleEm="patterns." />
      <div className="grid-3-2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-head"><div className="card-title">카테고리별 <em>분포</em></div></div>
          {catSegs.length===0?<div style={{padding:'30px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>이달 소비 없음</div>:(
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
        <div className="card">
          <div className="card-head"><div className="card-title">월별 <em>소비 추이</em></div></div>
          {monthTotals.length<2?<div style={{padding:'30px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>데이터 부족</div>:(
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────

// 고정비 월별 독립 수정 (전체수정 vs 이달만수정 선택 가능)
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

// 신용카드 자동결제 관리 섹션 (이달/다음달 탭)
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

  const allAPs = store.state.auto_pays || [];
  const totalAP = allAPs.reduce((s,ap)=>s+ap.amount,0);
  const st = {padding:'7px 9px',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:12.5,background:'var(--bg)'};

  // 카드사별 그룹
  const byCard = {};
  allAPs.forEach(ap => { if(!byCard[ap.cardCo]) byCard[ap.cardCo]=[]; byCard[ap.cardCo].push(ap); });

  return (
    <div className="card" style={{marginTop:16}}>
      <div className="card-head">
        <div>
          <div className="card-title">자동결제 <em>관리</em></div>
          <div className="card-sub">카드 자동이체 항목 · 합계 {fmtKRW(totalAP)}/월</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className={'btn btn-sm '+(viewMode==='this'?'btn-primary':'')} onClick={()=>setViewMode('this')}>{m}월</button>
          <button className={'btn btn-sm '+(viewMode==='next'?'btn-primary':'')} onClick={()=>setViewMode('next')}>{nextDate.getMonth()+1}월</button>
          <button className="btn btn-sm btn-primary" onClick={()=>setAdding(true)}>+ 추가</button>
        </div>
      </div>

      {adding && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,padding:'12px 14px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',marginBottom:12}}>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>카드사</div>
            <select value={newAp.cardCo} onChange={e=>setNewAp(p=>({...p,cardCo:e.target.value}))} style={{...st,width:'100%',cursor:'pointer'}}>
              <option value="">선택</option>
              {store.state.cards.map(c=><option key={c.id} value={c.co}>{c.co}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>서비스명</div><input value={newAp.service} onChange={e=>setNewAp(p=>({...p,service:e.target.value}))} placeholder="넷플릭스" style={{...st,width:'100%'}}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div><input type="number" value={newAp.amount} onChange={e=>setNewAp(p=>({...p,amount:e.target.value}))} style={{...st,width:'100%',fontFamily:'var(--mono)'}}/></div>
          <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>결제일</div><input type="number" min="1" max="31" value={newAp.day} onChange={e=>setNewAp(p=>({...p,day:e.target.value}))} style={{...st,width:'100%'}}/></div>
          <div style={{display:'flex',gap:5,alignItems:'flex-end'}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>{
              if(!newAp.cardCo||!newAp.service) return;
              const cardObj = store.state.cards.find(c=>c.co===newAp.cardCo);
              store.addAutoPay({cardId:cardObj?.id||'',cardCo:newAp.cardCo,service:newAp.service,amount:+newAp.amount,day:+newAp.day});
              toast('자동결제 추가됨');
              setNewAp({cardCo:'',service:'',amount:'',day:''});
              setAdding(false);
            }}>추가</button>
            <button className="btn btn-sm" style={{flex:1}} onClick={()=>setAdding(false)}>취소</button>
          </div>
        </div>
      )}

      {Object.entries(byCard).length === 0 && !adding && (
        <div style={{padding:'24px 0',textAlign:'center',color:'var(--ink-4)',fontSize:13}}>등록된 자동결제 없음</div>
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
                    <button className="icon-btn" style={{width:26,height:26}} onClick={()=>{store.deleteAutoPay(ap.id);toast('삭제됨');}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </div>
                  {editApId === ap.id && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 80px 70px auto auto',gap:6,padding:'8px 12px',background:'var(--accent-soft)',borderRadius:'var(--r-sm)',margin:'4px 0',alignItems:'end'}}>
                      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>서비스</div><input defaultValue={ap.service} id={`ap-svc-${ap.id}`} style={{...st,width:'100%'}}/></div>
                      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>카드사</div>
                        <select defaultValue={ap.cardCo} id={`ap-co-${ap.id}`} style={{...st,width:'100%',cursor:'pointer'}}>
                          {store.state.cards.map(c=><option key={c.id} value={c.co}>{c.co}</option>)}
                        </select>
                      </div>
                      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>금액</div><input type="number" defaultValue={ap.amount} id={`ap-amt-${ap.id}`} style={{...st,width:'100%',fontFamily:'var(--mono)'}}/></div>
                      <div><div style={{fontSize:10,color:'var(--ink-4)',marginBottom:2}}>결제일</div><input type="number" min="1" max="31" defaultValue={ap.day} id={`ap-day-${ap.id}`} style={{...st,width:'100%'}}/></div>
                      <button className="btn btn-primary btn-sm" onClick={()=>{
                        const co2 = document.getElementById(`ap-co-${ap.id}`)?.value||ap.cardCo;
                        const cardObj = store.state.cards.find(c=>c.co===co2);
                        store.updateAutoPay(ap.id,{
                          service: document.getElementById(`ap-svc-${ap.id}`)?.value||ap.service,
                          cardCo: co2, cardId: cardObj?.id||ap.cardId,
                          amount: +document.getElementById(`ap-amt-${ap.id}`)?.value||ap.amount,
                          day:    +document.getElementById(`ap-day-${ap.id}`)?.value||ap.day,
                        });
                        toast('수정됨'); setEditApId(null);
                      }}>저장</button>
                      <button className="btn btn-sm" onClick={()=>setEditApId(null)}>취소</button>
                    </div>
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
function CardSpendingRow({ c, monthExp, store, toast }) {
  const [editBudgetCard, setEditBudgetCard] = uS(false);
  const [budgetCardVal,  setBudgetCardVal]  = uS('');

  const autoPays     = (store.state.auto_pays||[]).filter(ap => ap.cardCo===c.co || ap.cardId===c.id);
  const autoPayTotal = autoPays.reduce((s,ap) => s+ap.amount, 0);
  const cardBudgetAmt= (store.state.cardMonthlyBudgets||{})[c.id] || c.limit || 1000000;
  const spent        = monthExp.filter(e => e.card===c.co).reduce((s,e) => s+e.amount, 0);
  const remaining    = cardBudgetAmt - autoPayTotal - spent;
  const autoPct      = Math.min(autoPayTotal / cardBudgetAmt * 100, 100);
  const spentPct     = Math.min(spent / cardBudgetAmt * 100, 100 - autoPct);
  const isOver       = remaining < 0;

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
              {(store.state.cards||[]).map(c=><option key={c.id} value={c.co}>{c.co}</option>)}
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
  InlineEditFixed, ExpenseRow
});
