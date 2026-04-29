// Reactive pages — read from store, support adding/deleting
const { useState: uS, useMemo: uM } = React;

const MONTH_NAMES = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function useMonthExpenses() {
  const store = useStore();
  const { y, m } = store.state.month;
  const prefix = `${y}-${String(m).padStart(2,'0')}`;
  return store.state.expenses.filter(e => e.date.startsWith(prefix));
}

function MonthSwitchLive() {
  const store = useStore();
  const { y, m } = store.state.month;
  const prev = () => { let nm = m-1, ny = y; if (nm < 1) { nm = 12; ny--; } store.setMonth(ny, nm); };
  const next = () => { let nm = m+1, ny = y; if (nm > 12) { nm = 1; ny++; } store.setMonth(ny, nm); };
  return (
    <div className="month-switch">
      <button onClick={prev}>‹</button>
      <span className="label">{y}년 {MONTH_NAMES[m]}</span>
      <button onClick={next}>›</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
function DashboardPage({ openExpense, openCard }) {
  const store = useStore();
  const toast = useToast();
  const [editCardDash, setEditCardDash] = uS(null);
  const monthExp = useMonthExpenses();
  const totalAssets = store.state.accounts.reduce((s, a) => s + Math.max(a.balance, 0), 0);
  const totalDebt = -store.state.accounts.reduce((s, a) => s + Math.min(a.balance, 0), 0);
  const netWorth = totalAssets - totalDebt;
  const monthIn = store.state.income;
  const fixedTotal = store.state.fixed.reduce((s,f) => s + f.amount, 0);
  const expTotal = monthExp.reduce((s,e) => s + e.amount, 0);
  const monthOut = fixedTotal + expTotal;
  const monthNet = monthIn - monthOut;
  const cards = store.state.cards;

  // Build category breakdown
  const catTotals = monthExp.reduce((acc, e) => { acc[e.cat] = (acc[e.cat]||0) + e.amount; return acc; }, {});
  const catColors = {'식비':'var(--accent)','문화':'var(--indigo)','생활':'var(--positive)','카페':'var(--warm)','교통':'var(--negative)','기타':'var(--ink-4)'};
  const catSegs = Object.entries(catTotals).map(([l,v]) => ({label:l, value:v, color:catColors[l]||'var(--ink-4)'}));

  return (
    <div className="tab-content">
      <PageHeader
        eyebrow={`${store.state.month.y}년 ${store.state.month.m}월`}
        title="This month, "
        titleEm={monthNet >= 0 ? 'on track.' : 'needs attention.'}
        sub={`순자산 ${fmtKRW(netWorth, {compact:true})} · 30일 예상 ${monthNet >= 0 ? '흑자' : '적자'} ${fmtKRW(Math.abs(monthNet), {compact:true})}.`}
        right={<MonthSwitchLive />}
      />

      <div className="hero-balance">
        <div className="hero-cell">
          <div className="hero-label"><span className="hero-label-dot" style={{background:'var(--accent)'}}></span>순자산</div>
          <div className="hero-num">{fmtKRW(netWorth, {compact:true})}</div>
          <div className="hero-meta">
            <span className="delta up">↑ 1.7%</span>
            <span className="faint">자산 {fmtKRW(totalAssets,{compact:true})} − 부채 {fmtKRW(totalDebt,{compact:true})}</span>
          </div>
          <div style={{marginTop:18}}><Sparkline data={SPARK_DATA.map(v => v + 200000000)} /></div>
        </div>
        <div className="hero-cell">
          <div className="hero-label"><span className="hero-label-dot" style={{background:'var(--positive)'}}></span>이달 유입</div>
          <div className="hero-num pos">+{fmtKRW(monthIn,{compact:true})}</div>
          <div className="hero-meta"><span className="delta up">↑ 0%</span><span>급여</span></div>
        </div>
        <div className="hero-cell">
          <div className="hero-label"><span className="hero-label-dot" style={{background:'var(--negative)'}}></span>이달 지출</div>
          <div className="hero-num neg">−{fmtKRW(monthOut,{compact:true})}</div>
          <div className="hero-meta"><span className="faint">고정 {fmtKRW(fixedTotal,{compact:true})} + 소비 {fmtKRW(expTotal,{compact:true})}</span></div>
        </div>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-head">
            <div><div className="card-title">통장별 <em>잔액</em></div><div className="card-sub">{store.state.accounts.length}개 계좌</div></div>
          </div>
          {store.state.accounts.map(a => {
            const isDebt = a.balance < 0;
            const pct = isDebt ? (Math.abs(a.balance) / a.limit) * 100 : 100;
            return (
              <div key={a.id} className="row">
                <div className="cat-mark" style={{
                  background: isDebt?'var(--negative-soft)':a.kind==='investment'?'var(--indigo-soft)':'var(--positive-soft)',
                  color: isDebt?'var(--negative)':a.kind==='investment'?'var(--indigo)':'var(--positive)'
                }}>{a.name[0]}</div>
                <div className="row-body">
                  <div className="row-title">{a.name} <span className="text-xs muted" style={{fontWeight:400, marginLeft:6}}>{a.sub}</span></div>
                  <div className="row-meta">{isDebt?`한도 ${fmtKRW(a.limit,{compact:true})} · ${pct.toFixed(1)}%`:'입출금 가능'}</div>
                </div>
                <div style={{minWidth:120}}>{isDebt && <div className="bar thin"><div className="bar-fill" style={{width: pct + '%', background:'var(--negative)'}}></div></div>}</div>
                <div className={'row-amt mono ' + (isDebt?'neg':'')}>{fmtKRW(a.balance)}</div>
              </div>
            );
          })}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head" style={{marginBottom:12}}><div className="card-title">이달 <em>소비 분포</em></div></div>
            {catSegs.length === 0 ? (
              <div style={{padding:'30px 0', textAlign:'center', color:'var(--ink-4)', fontSize:13}}>아직 소비 내역이 없어요</div>
            ) : (
              <div style={{display:'flex', alignItems:'center', gap:18, marginTop:6}}>
                <Donut segments={catSegs} center={
                  <><div className="text-xs muted">합계</div><div className="serif" style={{fontSize:20, fontWeight:500, marginTop:2}}>{fmtKRW(expTotal,{compact:true}).replace('₩','')}</div></>
                } />
                <div style={{flex:1, fontSize:12.5}}>
                  {catSegs.sort((a,b)=>b.value-a.value).slice(0,5).map((s,i) => (
                    <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
                      <span style={{width:8, height:8, borderRadius:'50%', background:s.color}}></span>
                      <span style={{flex:1}}>{s.label}</span>
                      <span className="mono fw6">{fmtKRW(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card" style={{padding:20}}>
            <div className="text-xs muted fw6" style={{textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8}}>30일 예상 현금흐름</div>
            <div className="serif" style={{fontSize:30, fontWeight:400, letterSpacing:'-0.03em'}}>
              <span className={monthNet>=0?'pos':'neg'}>{monthNet>=0?'+':'−'}{fmtKRW(Math.abs(monthNet),{compact:true})}</span>
            </div>
            <div className="text-sm muted" style={{marginTop:6}}>유입 − (고정 + 소비)</div>
          </div>
        </div>
      </div>

      <div style={{marginTop:20}} className="card">
        <div className="card-head">
          <div><div className="card-title">신용카드 <em>한도 사용률</em></div><div className="card-sub">{cards.length}개 카드</div></div>
          <div className="gap-sm">
            <button className="btn btn-sm btn-primary" onClick={openCard}>+ 카드</button>
          </div>
        </div>
        {cards.map(c => {
          const pct = (c.used / c.limit) * 100;
          const isHigh = pct > 70;
          return (
            <div key={c.id}>
              <div className="row">
                <div className="cat-mark" style={{background:'var(--paper-2)', color:'var(--ink)', fontFamily:'var(--mono)', fontSize:11, fontStyle:'normal'}}>•••{c.last4.slice(-2)}</div>
                <div className="row-body" style={{maxWidth:200}}><div className="row-title">{c.co}</div><div className="row-meta">{c.name} · 결제일 {c.paymentDay}일</div></div>
                <div style={{flex:1, minWidth:0}}><div className="bar"><div className="bar-fill" style={{width: pct + '%', background: isHigh?'var(--negative)':'var(--accent)'}}></div></div></div>
                <div className="mono text-sm" style={{textAlign:'right', minWidth:130}}>
                  <span className={'fw6 ' + (isHigh?'neg':'')}>{fmtKRW(c.used)}</span>
                  <span className="faint"> / {fmtKRW(c.limit, {compact:true})}</span>
                </div>
                <div className={'mono fw6 ' + (isHigh?'neg':'muted')} style={{minWidth:50, textAlign:'right'}}>{pct.toFixed(0)}%</div>
                <button className="icon-btn" style={{width:28,height:28}} onClick={() => setEditCardDash(editCardDash===c.id?null:c.id)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
              </div>
              {editCardDash === c.id && (
                <div style={{display:'flex', gap:8, alignItems:'center', padding:'9px 12px', background:'var(--paper-2)', borderRadius:'var(--r-sm)', margin:'4px 0', flexWrap:'wrap'}}>
                  <span style={{fontSize:11.5, fontWeight:600, color:'var(--ink-3)'}}>이달 사용액</span>
                  <input type="number" defaultValue={c.used} id={`ddash-${c.id}`}
                    style={{flex:'1 1 120px', padding:'6px 9px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, fontFamily:'var(--mono)', background:'var(--bg)'}} />
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const v = parseInt(document.getElementById(`ddash-${c.id}`)?.value);
                    if (!isNaN(v)) { store.updateCard(c.id, {used:v}); toast('수정됐어요'); }
                    setEditCardDash(null);
                  }}>저장</button>
                  <button className="btn btn-sm" onClick={() => setEditCardDash(null)}>취소</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────
function AccountsPage({ openAccount, openIncome }) {
  const store = useStore();
  const toast = useToast();
  const [bank, setBank] = uS(store.state.accounts[0]?.id);
  const [editBal, setEditBal] = uS(null); // {id, balance, name}
  // Reset selection if account deleted
  uM(() => {
    if (!store.state.accounts.find(a => a.id === bank) && store.state.accounts[0]) {
      setBank(store.state.accounts[0].id);
    }
  }, [store.state.accounts, bank]);
  const a = store.state.accounts.find(x => x.id === bank) || store.state.accounts[0];
  if (!a) {
    return (
      <div className="tab-content">
        <PageHeader eyebrow="Accounts" title="No accounts " titleEm="yet." sub="첫 통장을 등록해보세요."
          right={<button className="btn btn-primary" onClick={openAccount}>+ 통장 추가</button>} />
      </div>
    );
  }
  const isDebt = a.balance < 0;
  const pct = isDebt ? (Math.abs(a.balance) / a.limit) * 100 : 0;

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Accounts" title="Money in motion, " titleEm="by account." sub="각 통장으로 들어오고 나가는 흐름을 시간순으로 확인하세요."
        right={
          <div className="gap-sm">
            <button className="btn" onClick={openIncome}>월 수입 설정</button>
            <button className="btn btn-primary" onClick={openAccount}>+ 통장 추가</button>
          </div>
        } />

      <div style={{marginBottom:24, display:'flex', gap:6, flexWrap:'wrap'}}>
        {store.state.accounts.map(x => (
          <button key={x.id} className={'btn ' + (x.id === bank?'btn-primary':'')} style={{padding:'6px 14px'}} onClick={() => setBank(x.id)}>{x.name}</button>
        ))}
      </div>

      <div className="card" style={{padding:32, marginBottom:20, background:'linear-gradient(135deg, var(--paper) 0%, var(--paper-2) 100%)'}}>
        <div className="between" style={{alignItems:'flex-start'}}>
          <div>
            <div className="text-xs muted fw6" style={{textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8}}>{a.name} · {a.sub}</div>
            <div className="serif" style={{fontSize:48, fontWeight:400, letterSpacing:'-0.04em', lineHeight:1, color: isDebt?'var(--negative)':'var(--ink)'}}>{fmtKRW(a.balance)}</div>
            <div style={{marginTop:14, display:'flex', gap:14, alignItems:'center'}}>
              <span className="text-sm muted">2026년 4월 26일 기준</span>
              {isDebt && <span className="chip neg">한도 {pct.toFixed(1)}%</span>}
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-sm" onClick={() => setEditBal({id:a.id, balance:a.balance, name:a.name})}>잔액 수정</button>
            {store.state.accounts.length > 1 && (
            <button className="icon-btn" title="통장 삭제"
              onClick={() => { if (confirm(`"${a.name}"을(를) 삭제할까요?`)) { store.deleteAccount(a.id); toast('통장이 삭제되었어요'); }}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            )}
          </div>
        </div>
        {editBal && editBal.id === a.id && (
          <div style={{marginTop:16, padding:'14px 16px', background:'var(--paper-2)', borderRadius:'var(--r-sm)', border:'1px solid var(--line)', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
            <span style={{fontSize:12, fontWeight:600, color:'var(--ink-3)', flex:'0 0 auto'}}>잔액 수정 (원)</span>
            <input type="number" defaultValue={editBal.balance}
              id="bal-edit-input"
              style={{flex:'1 1 160px', padding:'8px 11px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, background:'var(--bg)', fontFamily:'var(--mono)'}} />
            <button className="btn btn-primary btn-sm" onClick={() => {
              const v = parseInt(document.getElementById('bal-edit-input').value);
              if (!isNaN(v)) { store.updateAccount(editBal.id, {balance:v}); toast('잔액이 수정됐어요'); }
              setEditBal(null);
            }}>저장</button>
            <button className="btn btn-sm" onClick={() => setEditBal(null)}>취소</button>
          </div>
        )}
        {isDebt && (
          <div style={{marginTop:24}}>
            <div className="bar" style={{height:6}}><div className="bar-fill" style={{width: pct + '%', background:'var(--negative)'}}></div></div>
          </div>
        )}
      </div>

      <div className="grid-3" style={{marginBottom:20}}>
        <Tile label="이달 유입" num={'+'+fmtKRW(a.flowIn, {compact:true})} sub="급여 등" accent="var(--positive)" />
        <Tile label="이달 지출" num={'−'+fmtKRW(a.flowOut, {compact:true})} sub="자동이체" accent="var(--negative)" />
        <Tile label="순 변동" num={(a.flowIn-a.flowOut>=0?'+':'−')+fmtKRW(Math.abs(a.flowIn-a.flowOut), {compact:true})} sub="흐름 차" accent="var(--accent)" />
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">이달 <em>자금 흐름</em></div></div>
        {FLOW_LIST.map((e, i) => (
          <div key={i} className="row">
            <div className={'day-chip ' + e.kind}>{e.day}</div>
            <div className="row-body"><div className="row-title">{e.desc}</div><div className="row-meta">{e.meta}</div></div>
            <div className={'row-amt mono ' + (e.amount>0?'in':'out')}>{fmtKRW(e.amount, {showPlus: e.amount>0})}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// FLOW MAP - same as before, static
function FlowMapPage() {
  return (
    <div className="tab-content">
      <PageHeader eyebrow="Flow" title="How money " titleEm="travels." sub="급여로 시작해 카드, 고정비, 투자로 흩어지는 자금의 경로를 한 눈에." />
      <div className="card">
        <div className="card-head">
          <div className="card-title">전체 <em>모식도</em></div>
          <div className="gap-sm" style={{flexWrap:'wrap'}}>
            <span className="chip pos">● 유입</span><span className="chip accent">● 허브</span>
            <span className="chip neg">● 고정비</span><span className="chip indigo">● 투자</span>
          </div>
        </div>
        <svg className="flow-svg" viewBox="0 0 900 460" preserveAspectRatio="xMidYMid meet">
          <g><rect className="flow-node-bg income" x="20" y="180" width="150" height="80" rx="10" /><text className="flow-node-text" x="95" y="212">급여 입금</text><text className="flow-node-meta" x="95" y="232">+₩4,200,000</text><text className="flow-node-meta" x="95" y="248" style={{fontSize:10}}>매월 25일</text></g>
          <g><rect className="flow-node-bg hub" x="290" y="180" width="160" height="80" rx="10" /><text className="flow-node-text" x="370" y="212">우리은행 주거래</text><text className="flow-node-meta" x="370" y="232">−₩4,920만</text><text className="flow-node-meta" x="370" y="248" style={{fontSize:10}}>마이너스통장</text></g>
          {[{y:30, label:'주담대 원리금', amount:'−₩1,300,000', cls:'out'},{y:130, label:'카드 결제', amount:'−₩620,000', cls:'out'},{y:230, label:'ISA 투자', amount:'−₩1,500,000', cls:'income'},{y:330, label:'고정비 합계', amount:'−₩504,000', cls:'out'}].map((n, i) => (
            <g key={i}><rect className={'flow-node-bg ' + n.cls} x="600" y={n.y} width="170" height="76" rx="10" /><text className="flow-node-text" x="685" y={n.y+32}>{n.label}</text><text className="flow-node-meta" x="685" y={n.y+52}>{n.amount}</text></g>
          ))}
          <path className="flow-line solid income" d="M 170 220 C 230 220 230 220 290 220" />
          <path className="flow-line solid out" d="M 450 215 C 525 215 525 70 600 70" />
          <path className="flow-line solid out" d="M 450 220 C 525 220 525 168 600 168" />
          <path className="flow-line solid income" d="M 450 225 C 525 225 525 268 600 268" />
          <path className="flow-line solid out" d="M 450 230 C 525 230 525 368 600 368" />
        </svg>
      </div>
    </div>
  );
}

// FIXED COSTS
function FixedCostsPage({ openFixed }) {
  const store = useStore();
  const toast = useToast();
  const [editItem, setEditItem] = uS(null);
  // group by group
  const groups = uM(() => {
    const m = {};
    store.state.fixed.forEach(f => { if (!m[f.group]) m[f.group] = []; m[f.group].push(f); });
    return Object.entries(m).map(([group, items]) => ({ group, items, total: items.reduce((s,i) => s+i.amount, 0) }));
  }, [store.state.fixed]);
  const total = store.state.fixed.reduce((s,f) => s+f.amount, 0);

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Recurring" title="Fixed costs, " titleEm="the spine." sub="매달 같은 날, 같은 곳으로 빠져나가는 돈들."
        right={<button className="btn btn-primary" onClick={openFixed}>+ 항목 추가</button>} />

      <div className="grid-3" style={{marginBottom:20}}>
        <Tile label="월 고정비 합계" num={fmtKRW(total)} sub={`${groups.length}개 카테고리`} accent="var(--negative)" />
        <Tile label="소득 대비 비율" num={`${Math.round(total/store.state.income*100)}%`} sub={`₩${(store.state.income/10000).toFixed(0)}만 중`} accent="var(--warm)" />
        <Tile label="등록된 항목" num={`${store.state.fixed.length}개`} sub="자동이체" accent="var(--accent)" />
      </div>

      {groups.map(g => (
        <div key={g.group} className="card" style={{marginBottom:16, padding:0, overflow:'hidden'}}>
          <div className="between" style={{padding:'18px 24px', background:'var(--paper-2)', borderBottom:'1px solid var(--line)'}}>
            <div><div className="card-title">{g.group}</div><div className="card-sub">{g.items.length}건</div></div>
            <div className="serif" style={{fontSize:22, fontWeight:500}}>{fmtKRW(g.total)}</div>
          </div>
          <div style={{padding:'4px 24px'}}>
            {g.items.map(item => (
              <div key={item.id}>
                <div className="row" style={{cursor:'default'}}>
                  <div className="day-chip">{item.day}</div>
                  <div className="row-body"><div className="row-title">{item.name}</div><div className="row-meta">{item.meta}</div></div>
                  <div className="row-amt out mono">−{fmtKRW(item.amount)}</div>
                  <button className="icon-btn" title="수정" style={{width:28,height:28}} onClick={() => setEditItem(editItem?.id===item.id?null:item)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button className="icon-btn" style={{width:28, height:28}} onClick={() => { store.deleteFixed(item.id); toast('삭제되었어요'); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
                {editItem?.id === item.id && (
                  <InlineEditFixed item={item} onSave={(patch) => { store.updateFixed(item.id, patch); toast('수정됐어요'); setEditItem(null); }} onCancel={() => setEditItem(null)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// TIMELINE
function TimelinePage() {
  const store = useStore();
  const { y, m } = store.state.month;
  const [dayOpen, setDayOpen] = uS(null);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m-1, 1).getDay();

  // Build event map from fixed + expenses
  const eventMap = {};
  store.state.fixed.forEach(f => {
    if (!eventMap[f.day]) eventMap[f.day] = [];
    eventMap[f.day].push({ kind: 'out', label: f.name, amount: f.amount });
  });
  store.state.expenses.forEach(e => {
    const d = new Date(e.date);
    if (d.getFullYear() === y && d.getMonth()+1 === m) {
      const day = d.getDate();
      if (!eventMap[day]) eventMap[day] = [];
      eventMap[day].push({ kind: 'out', label: e.title, amount: e.amount });
    }
  });
  // Income on 25
  if (!eventMap[25]) eventMap[25] = [];
  eventMap[25].unshift({ kind: 'in', label: '급여', amount: store.state.income });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth()+1 === m;

  const sorted = Object.entries(eventMap).map(([d, evs]) => ({ day: Number(d), events: evs })).sort((a,b) => a.day - b.day);

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Calendar" title="Month at " titleEm="a glance." sub="자동이체와 결제일을 한 화면에서." right={<MonthSwitchLive />} />
      <div className="grid-3-2">
        <div className="card">
          <div className="card-head"><div className="card-title">{m}월 <em>캘린더</em></div>
            <div className="gap-sm"><span className="chip pos">유입</span><span className="chip neg">지출</span></div>
          </div>
          <div className="cal-grid">
            {['일','월','화','수','목','금','토'].map(d => <div key={d} className="cal-h">{d}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="cal-day empty"></div>;
              const ev = eventMap[d];
              const isToday = isCurrentMonth && today.getDate() === d;
              return (
                <div key={i} className={'cal-day' + (isToday?' today':'') + (ev&&!isToday?' has-event':'')}
                  onClick={() => setDayOpen(d)}>
                  <div className="num">{d}</div>
                  {ev && <div className="cal-dots">{ev.slice(0,3).map((e, j) => <span key={j} className="cal-dot" style={{background: e.kind==='in'?'var(--positive)':'var(--negative)'}}></span>)}</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">이달의 <em>일정</em></div></div>
          {sorted.length === 0 ? <div style={{padding:30, textAlign:'center', color:'var(--ink-4)'}}>일정이 없어요</div> : sorted.slice(0,8).map((s, i) => (
            <div key={i} className="row">
              <div className={'day-chip ' + (s.events[0].kind==='in'?'in':'out')}>{s.day}</div>
              <div className="row-body">
                <div className="row-title">{s.events[0].label}</div>
                <div className="row-meta">{s.events.length > 1 ? `외 ${s.events.length-1}건` : '단건'}</div>
              </div>
              <div className={'row-amt mono ' + (s.events[0].kind==='in'?'in':'out')}>{s.events[0].kind==='in'?'+':'−'}{fmtKRW(s.events.reduce((sum,e)=>sum+e.amount,0))}</div>
            </div>
          ))}
        </div>
      </div>
      <DayDetail open={dayOpen !== null} onClose={() => setDayOpen(null)}
        day={dayOpen} year={y} month={m}
        events={dayOpen !== null ? (eventMap[dayOpen] || []) : []} />
    </div>
  );
}

// EXPENSES
function ExpensesPage({ openExpense }) {
  const store = useStore();
  const toast = useToast();
  const monthExp = useMonthExpenses();
  const [filter, setFilter] = uS('all');
  const [search, setSearch] = uS('');
  const [dateFrom, setDateFrom] = uS('');
  const [dateTo, setDateTo] = uS('');
  const [cardFilter, setCardFilter] = uS('all');
  const [sortBy, setSortBy] = uS('date');

  const filtered = monthExp.filter(e => {
    if (filter !== 'all' && e.cat !== filter) return false;
    if (cardFilter !== 'all' && e.card !== cardFilter) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  if (sortBy === 'amount') filtered.sort((a,b) => b.amount - a.amount);
  else if (sortBy === 'amount-asc') filtered.sort((a,b) => a.amount - b.amount);
  const total = filtered.reduce((s,e) => s+e.amount, 0);

  const clearFilters = () => { setFilter('all'); setSearch(''); setDateFrom(''); setDateTo(''); setCardFilter('all'); setSortBy('date'); };
  const hasActiveFilters = filter !== 'all' || search || dateFrom || dateTo || cardFilter !== 'all' || sortBy !== 'date';

  // Group by date (skip if sorting by amount)
  const byDate = {};
  if (sortBy === 'date') filtered.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
  const dates = Object.keys(byDate).sort().reverse();

  const toneMap = {accent:'var(--accent)', indigo:'var(--indigo)', warm:'var(--warm)', pos:'var(--positive)', neg:'var(--negative)'};
  const cats = ['all','식비','카페','생활','문화','교통','기타'];
  const dayNames = ['일','월','화','수','목','금','토'];
  const cardOptions = [{value:'all',label:'모든 카드'}, ...store.state.cards.map(c => ({value:c.co, label:c.co}))];
  const sortOptions = [{value:'date',label:'날짜순'}, {value:'amount',label:'큰 금액순'}, {value:'amount-asc',label:'작은 금액순'}];

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Spending" title="Day by " titleEm="day."
        sub={`이달 ${monthExp.length}건 · 합계 ${fmtKRW(monthExp.reduce((s,e)=>s+e.amount,0))}`}
        right={
          <button className="btn btn-primary" onClick={openExpense} style={{display:'flex',alignItems:'center',gap:6}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            소비 추가
          </button>
        } />
      {/* 모바일 플로팅 버튼 */}
      <button onClick={openExpense} style={{
        display:'none',
        position:'fixed', bottom:'calc(72px + env(safe-area-inset-bottom, 0px))', right:20,
        width:52, height:52, borderRadius:'50%',
        background:'var(--accent)', color:'#fff', border:'none',
        boxShadow:'0 4px 20px rgba(0,0,0,.25)',
        cursor:'pointer', zIndex:80,
        alignItems:'center', justifyContent:'center'
      }} className="expense-fab">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      <div className="grid-4" style={{marginBottom:20}}>
        <Tile label="이달 소비" num={fmtKRW(total)} sub={`${filtered.length}건`} accent="var(--negative)" />
        <Tile label="일 평균" num={fmtKRW(Math.round(total / Math.max(new Date().getDate(),1)))} />
        <Tile label="최다 카테고리" num={(() => {
          const t = filtered.reduce((a,e) => { a[e.cat]=(a[e.cat]||0)+e.amount; return a; }, {});
          const top = Object.entries(t).sort((a,b)=>b[1]-a[1])[0];
          return top ? top[0] : '—';
        })()} accent="var(--accent)" />
        <Tile label="필터 결과" num={`${filtered.length}건`} accent="var(--positive)" />
      </div>

      <div className="card" style={{marginBottom:14, padding:'14px 18px'}}>
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
          <input placeholder="🔎 내용 검색" value={search} onChange={e => setSearch(e.target.value)}
            style={{padding:'7px 12px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, background:'var(--bg)', minWidth:160, flex:'0 1 200px'}} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="시작일"
            style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12.5, background:'var(--bg)', color:'var(--ink-2)'}} />
          <span className="text-xs muted">~</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="종료일"
            style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12.5, background:'var(--bg)', color:'var(--ink-2)'}} />
          <select value={cardFilter} onChange={e => setCardFilter(e.target.value)}
            style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12.5, background:'var(--bg)', color:'var(--ink-2)', cursor:'pointer'}}>
            {cardOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12.5, background:'var(--bg)', color:'var(--ink-2)', cursor:'pointer'}}>
            {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button className="btn btn-sm" onClick={clearFilters} style={{marginLeft:'auto'}}>필터 초기화</button>
          )}
        </div>
        <div style={{marginTop:10, display:'flex', gap:6, flexWrap:'wrap'}}>
          {cats.map(c => <button key={c} className={'chip ' + (filter===c?'accent':'')} onClick={() => setFilter(c)} style={{cursor:'pointer', border:filter===c?'1px solid var(--accent-line)':'1px solid var(--line)'}}>{c==='all'?'전체':c}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">{sortBy==='date' ? '최근 ' : '금액 '}<em>{sortBy==='date'?'소비':'정렬'}</em></div>
          <span className="text-sm muted">{filtered.length}건</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{padding:50, textAlign:'center', color:'var(--ink-4)'}}>
            <div className="serif" style={{fontSize:18, fontStyle:'italic', marginBottom:8}}>결과가 없어요</div>
            <div className="text-sm">{hasActiveFilters?'필터를 조정해보세요':'우측 상단 "+ 소비 추가"로 첫 내역을 기록해보세요'}</div>
          </div>
        ) : sortBy !== 'date' ? (
          <div style={{padding:'4px 0'}}>
            {filtered.map(e => (
              <ExpenseRow key={e.id} e={e} toneMap={toneMap} onDelete={() => { store.deleteExpense(e.id); toast('삭제되었어요'); }} onUpdate={(patch) => { store.updateExpense(e.id, patch); toast('수정됐어요'); }} store={store} showDate />
            ))}
          </div>
        ) : dates.map(date => {
          const d = new Date(date);
          const dayTotal = byDate[date].reduce((s,e)=>s+e.amount,0);
          return (
            <div key={date} style={{marginBottom:18}}>
              <div className="between" style={{padding:'10px 0', borderBottom:'1px solid var(--line)', marginBottom:4}}>
                <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                  <span className="serif" style={{fontSize:16, fontWeight:500}}>{d.getMonth()+1}월 {d.getDate()}일</span>
                  <span className="text-xs faint">{dayNames[d.getDay()]}</span>
                </div>
                <span className="mono fw6 neg text-sm">−{fmtKRW(dayTotal)}</span>
              </div>
              {byDate[date].map(e => (
                <ExpenseRow key={e.id} e={e} toneMap={toneMap} onDelete={() => { store.deleteExpense(e.id); toast('삭제되었어요'); }} onUpdate={(patch) => { store.updateExpense(e.id, patch); toast('수정됐어요'); }} store={store} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// CREDIT CARDS
function CreditCardsPage({ openCard }) {
  const store = useStore();
  const toast = useToast();
  const [editCardId, setEditCardId] = uS(null);
  const cards = store.state.cards;
  const totalLimit = cards.reduce((s,c) => s+c.limit, 0);
  const totalUsed = cards.reduce((s,c) => s+c.used, 0);

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Cards" title="Card " titleEm="portfolio."
        sub={`${cards.length}장 · 한도 ${fmtKRW(totalLimit,{compact:true})} · 사용 ${fmtKRW(totalUsed,{compact:true})} (${(totalUsed/totalLimit*100).toFixed(1)}%)`}
        right={<button className="btn btn-primary" onClick={openCard}>+ 카드 추가</button>} />

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:18, marginBottom:24}}>
        {cards.map(c => (
          <div key={c.id} className="cc" style={{background: c.gradient}}>
            <div style={{position:'relative', zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div className="cc-co">{c.co}</div>
                <div className="cc-name">{c.name}</div>
              </div>
              <button onClick={() => { if(confirm('카드를 삭제할까요?')) { store.deleteCard(c.id); toast('삭제되었어요'); }}}
                style={{background:'rgba(255,255,255,0.15)', border:'none', color:'rgba(255,255,255,0.7)', width:24, height:24, borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="cc-foot"><span>•••• •••• •••• {c.last4}</span><span>한도 ₩{(c.limit/10000).toFixed(0)}만</span></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">결제 <em>예정</em></div></div>
        {cards.map(c => {
          const pct = (c.used / c.limit) * 100;
          return (
            <div key={c.id}>
              <div className="row">
                <div className="cat-mark" style={{background:'var(--paper-2)', color:'var(--ink)', fontFamily:'var(--mono)', fontSize:11, fontStyle:'normal'}}>•••{c.last4.slice(-2)}</div>
                <div className="row-body" style={{maxWidth:200}}><div className="row-title">{c.co}</div><div className="row-meta">{c.name}</div></div>
                <div style={{flex:1, minWidth:0}}><div className="bar"><div className="bar-fill" style={{width:pct+'%', background:'var(--accent)'}}></div></div></div>
                <div className="mono fw6 text-sm" style={{minWidth:100, textAlign:'right'}}>{fmtKRW(c.used)} / {fmtKRW(c.limit,{compact:true})}</div>
                <button className="icon-btn" title="사용액 수정" style={{width:28,height:28}} onClick={() => setEditCardId(editCardId===c.id?null:c.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
              </div>
              {editCardId === c.id && (
                <div style={{display:'flex', gap:8, alignItems:'center', padding:'10px 14px', background:'var(--paper-2)', borderRadius:'var(--r-sm)', margin:'4px 0', flexWrap:'wrap'}}>
                  <span style={{fontSize:12, fontWeight:600, color:'var(--ink-3)'}}>이달 사용액 (원)</span>
                  <input type="number" defaultValue={c.used} id={`cused-${c.id}`}
                    style={{flex:'1 1 140px', padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, fontFamily:'var(--mono)', background:'var(--bg)'}} />
                  <span style={{fontSize:12, fontWeight:600, color:'var(--ink-3)'}}>한도 (원)</span>
                  <input type="number" defaultValue={c.limit} id={`climit-${c.id}`}
                    style={{flex:'1 1 140px', padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, fontFamily:'var(--mono)', background:'var(--bg)'}} />
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const used = parseInt(document.getElementById(`cused-${c.id}`)?.value);
                    const limit = parseInt(document.getElementById(`climit-${c.id}`)?.value);
                    store.updateCard(c.id, { used: isNaN(used)?c.used:used, limit: isNaN(limit)?c.limit:limit });
                    toast('카드 정보가 수정됐어요');
                    setEditCardId(null);
                  }}>저장</button>
                  <button className="btn btn-sm" onClick={() => setEditCardId(null)}>취소</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ANALYTICS
function AnalyticsPage() {
  const [q, setQ] = uS('');
  const store = useStore();
  const monthExp = useMonthExpenses();
  const [history, setHistory] = uS([
    { role: 'ai', text: '안녕하세요. 4월 데이터를 기반으로 질문에 답해드릴게요.' },
  ]);
  const send = () => {
    if (!q.trim()) return;
    const userQ = q;
    setHistory(h => [...h, { role: 'user', text: userQ }, { role: 'ai', text: '분석 중…' }]);
    setQ('');
    const summary = `소득 ${fmtKRW(store.state.income)}, 고정비 ${fmtKRW(store.state.fixed.reduce((s,f)=>s+f.amount,0))}, 이달 소비 ${fmtKRW(monthExp.reduce((s,e)=>s+e.amount,0))}, 소비 건수 ${monthExp.length}건.`;
    window.claude?.complete(`당신은 한국 개인재정 분석가입니다. 사용자 데이터: ${summary}\n사용자 질문: ${userQ}\n한국어로 2-3문장 답하세요.`)
      .then(answer => setHistory(h => h.slice(0, -1).concat({ role: 'ai', text: answer })))
      .catch(() => setHistory(h => h.slice(0, -1).concat({ role: 'ai', text: '분석에 실패했습니다.' })));
  };

  return (
    <div className="tab-content">
      <PageHeader eyebrow="Analyze" title="Understand " titleEm="your money." sub="AI가 데이터를 읽고 답해드립니다." />

      <div className="ai-card">
        <div style={{display:'flex', alignItems:'flex-start', gap:14}}>
          <div className="cat-mark" style={{background:'var(--ink)', color:'var(--bg)', fontStyle:'italic'}}>AI</div>
          <div style={{flex:1}}>
            <div className="serif" style={{fontSize:20, fontWeight:500, letterSpacing:'-0.015em'}}>재정 분석 <em style={{color:'var(--ink-3)'}}>대화로 묻기</em></div>
            <div className="text-sm muted" style={{marginTop:4}}>실제 입력한 데이터를 기반으로 분석합니다.</div>
          </div>
        </div>
        <div style={{marginTop:18, display:'flex', flexDirection:'column', gap:12}}>
          {history.map((m, i) => (
            <div key={i} style={{display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{maxWidth:'80%', padding:'12px 16px', borderRadius:'var(--r-md)',
                background: m.role==='user'?'var(--ink)':'var(--paper)', color: m.role==='user'?'var(--bg)':'var(--ink)',
                border: m.role==='ai'?'1px solid var(--line)':'none', fontSize:13.5, lineHeight:1.6}}>{m.text}</div>
            </div>
          ))}
        </div>
        <div className="ai-input-wrap" style={{marginTop:16}}>
          <input className="ai-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} placeholder="질문을 입력하세요…" />
          <button className="btn btn-accent" onClick={send}>분석</button>
        </div>
        <div style={{display:'flex', gap:6, marginTop:14, flexWrap:'wrap'}}>
          {['이달 소비 패턴은?', '절약 가능한 항목은?', '다음 달 흑자 예상?'].map((s, i) => (
            <button key={i} className="chip" style={{cursor:'pointer'}} onClick={() => setQ(s)}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Inline edit helper components ──────────────────────────

function InlineEditFixed({ item, onSave, onCancel }) {
  const [name, setName] = uS(item.name);
  const [meta, setMeta] = uS(item.meta);
  const [day, setDay]   = uS(item.day);
  const [amount, setAmount] = uS(item.amount);
  const inpStyle = {padding:'7px 10px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:13, background:'var(--bg)', fontFamily:'var(--sans)'};
  return (
    <div style={{padding:'12px 14px', background:'var(--accent-soft)', borderRadius:'var(--r-sm)', margin:'4px 0', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:8}}>
      <div><div style={{fontSize:10.5, fontWeight:600, color:'var(--ink-4)', marginBottom:3}}>항목명</div><input value={name} onChange={e=>setName(e.target.value)} style={{...inpStyle, width:'100%'}} /></div>
      <div><div style={{fontSize:10.5, fontWeight:600, color:'var(--ink-4)', marginBottom:3}}>메모</div><input value={meta} onChange={e=>setMeta(e.target.value)} style={{...inpStyle, width:'100%'}} /></div>
      <div><div style={{fontSize:10.5, fontWeight:600, color:'var(--ink-4)', marginBottom:3}}>날짜(일)</div><input type="number" min="1" max="31" value={day} onChange={e=>setDay(+e.target.value)} style={{...inpStyle, width:'100%'}} /></div>
      <div><div style={{fontSize:10.5, fontWeight:600, color:'var(--ink-4)', marginBottom:3}}>금액(원)</div><input type="number" value={amount} onChange={e=>setAmount(+e.target.value)} style={{...inpStyle, width:'100%', fontFamily:'var(--mono)'}} /></div>
      <div style={{display:'flex', gap:6, alignItems:'flex-end'}}>
        <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={() => onSave({name,meta,day,amount})}>저장</button>
        <button className="btn btn-sm" style={{flex:1}} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

function ExpenseRow({ e, toneMap, onDelete, onUpdate, store, showDate }) {
  const [editing, setEditing] = uS(false);
  const [title, setTitle]   = uS(e.title);
  const [amount, setAmount] = uS(e.amount);
  const [cat, setCat]       = uS(e.cat);
  const [card, setCard]     = uS(e.card);
  const cats = ['식비','카페','생활','문화','교통','기타'];
  const catTone = {식비:'indigo',카페:'warm',생활:'pos',문화:'accent',교통:'neg',기타:'indigo'};
  const catMark = {식비:'식',카페:'커',생활:'생',문화:'문',교통:'교',기타:'기'};
  const inpSt = {padding:'6px 9px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', fontSize:12.5, background:'var(--bg)', fontFamily:'var(--sans)'};
  return (
    <div>
      <div className="expense-row">
        <div className="cat-mark" style={{background:'color-mix(in oklab, '+toneMap[e.tone]+' 12%, transparent)', color:toneMap[e.tone]}}>{e.mark}</div>
        <div style={{flex:1, minWidth:0}}>
          <div className="row-title">{e.title}</div>
          <div style={{display:'flex', gap:6, marginTop:4, flexWrap:'wrap'}}>
            <span className="chip">{e.cat}</span>
            <span className="chip">{e.card}</span>
            {showDate && <span className="chip" style={{color:'var(--ink-4)'}}>{e.date.slice(5)}</span>}
          </div>
        </div>
        <button className="icon-btn" style={{width:28,height:28}} onClick={() => setEditing(!editing)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button className="icon-btn" style={{width:28, height:28}} onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div className="mono fw6 neg">−{fmtKRW(e.amount)}</div>
      </div>
      {editing && (
        <div style={{padding:'10px 12px', background:'var(--accent-soft)', borderRadius:'var(--r-sm)', margin:'4px 0', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8}}>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>내용</div><input value={title} onChange={e=>setTitle(e.target.value)} style={{...inpSt,width:'100%'}} /></div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>금액</div><input type="number" value={amount} onChange={e=>setAmount(+e.target.value)} style={{...inpSt,width:'100%',fontFamily:'var(--mono)'}} /></div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>카테고리</div>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{...inpSt,width:'100%',cursor:'pointer'}}>
              {cats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:10.5,fontWeight:600,color:'var(--ink-4)',marginBottom:3}}>카드</div>
            <select value={card} onChange={e=>setCard(e.target.value)} style={{...inpSt,width:'100%',cursor:'pointer'}}>
              {store.state.cards.map(c=><option key={c.id} value={c.co}>{c.co}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={()=>{
              onUpdate({title, amount, cat, tone:catTone[cat]||'indigo', mark:catMark[cat]||'기', card});
              setEditing(false);
            }}>저장</button>
            <button className="btn btn-sm" style={{flex:1}} onClick={()=>setEditing(false)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DashboardPage, AccountsPage, FlowMapPage, FixedCostsPage, TimelinePage, ExpensesPage, CreditCardsPage, AnalyticsPage });
