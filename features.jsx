// Command palette (search) + Notifications panel + Day detail sheet
const { useState: fS, useEffect: fE, useRef: fR, useMemo: fM } = React;

// ─────────────────────────────────────────────────────────
// Command Palette — Cmd+K / search icon
// ─────────────────────────────────────────────────────────
function CommandPalette({ open, onClose, setActive, openExpense, openFixed, openCard, openAccount, openIncome, openSettings }) {
  const store = useStore();
  const [q, setQ] = fS('');
  const inputRef = fR(null);

  fE(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build searchable items
  const items = fM(() => {
    const list = [];
    // Pages
    NAV.flatMap(g => g.items).forEach(p => {
      list.push({ kind: 'page', id: p.id, label: p.label, sub: '페이지로 이동', go: () => { setActive(p.id); onClose(); }});
    });
    // Quick actions
    list.push({ kind: 'action', label: '소비 추가', sub: '새 소비 내역 기록', go: () => { openExpense(); onClose(); }});
    list.push({ kind: 'action', label: '고정비 추가', sub: '월 자동이체 등록', go: () => { openFixed(); onClose(); }});
    list.push({ kind: 'action', label: '카드 추가', sub: '신용카드 등록', go: () => { openCard(); onClose(); }});
    list.push({ kind: 'action', label: '통장 추가', sub: '은행 계좌 등록', go: () => { openAccount(); onClose(); }});
    list.push({ kind: 'action', label: '월 수입 설정', sub: '세후 수입 입력', go: () => { openIncome(); onClose(); }});
    list.push({ kind: 'action', label: '데이터 내보내기 / 가져오기', sub: 'JSON 백업·복원', go: () => { openSettings && openSettings(); onClose(); }});
    // Recent expenses
    store.state.expenses.slice(0, 30).forEach(e => {
      list.push({ kind: 'expense', label: e.title, sub: `${e.cat} · ${e.card} · ${fmtKRW(e.amount)} · ${e.date.slice(5)}`, go: () => { setActive('expenses'); onClose(); }});
    });
    // Accounts
    store.state.accounts.forEach(a => {
      list.push({ kind: 'account', label: a.name, sub: `${a.sub} · ${fmtKRW(a.balance,{compact:true})}`, go: () => { setActive('accounts'); onClose(); }});
    });
    // Cards
    store.state.cards.forEach(c => {
      list.push({ kind: 'card', label: c.co + ' ' + c.name, sub: `한도 ${fmtKRW(c.limit,{compact:true})} · 결제일 ${c.paymentDay}일`, go: () => { setActive('creditcards'); onClose(); }});
    });
    return list;
  }, [store.state, open]);

  const filtered = q.trim() === '' ? items.slice(0, 12) : items.filter(it =>
    (it.label + ' ' + (it.sub||'')).toLowerCase().includes(q.toLowerCase())
  ).slice(0, 30);

  const [sel, setSel] = fS(0);
  fE(() => { setSel(0); }, [q]);

  fE(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s+1, filtered.length-1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.go(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, sel]);

  if (!open) return null;
  const kindLabel = {page:'페이지', action:'동작', expense:'소비', account:'통장', card:'카드'};
  const kindColor = {page:'var(--ink-3)', action:'var(--accent)', expense:'var(--negative)', account:'var(--positive)', card:'var(--indigo)'};

  return (
    <div className="modal-scrim" onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(26,23,20,0.45)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:200, padding:'12vh 20px 20px',
      animation:'fadeUp .18s ease'
    }}>
      <div onClick={e => e.stopPropagation()} className="modal-card" style={{
        background:'var(--paper)', borderRadius:'var(--r-lg)', border:'1px solid var(--line)',
        width:'100%', maxWidth:560, boxShadow:'var(--shadow-lg)', overflow:'hidden'
      }}>
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--line)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-3)'}}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input ref={inputRef} placeholder="검색하거나 동작 선택…" value={q} onChange={e => setQ(e.target.value)}
            style={{flex:1, border:'none', background:'transparent', fontSize:15, color:'var(--ink)', fontFamily:'var(--sans)', outline:'none'}} />
          <kbd style={{fontFamily:'var(--mono)', fontSize:10, padding:'2px 6px', border:'1px solid var(--line)', borderRadius:4, color:'var(--ink-4)'}}>ESC</kbd>
        </div>
        <div style={{maxHeight:'58vh', overflowY:'auto', padding:'6px 0'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'40px 24px', textAlign:'center', color:'var(--ink-4)', fontSize:13}}>
              <div className="serif" style={{fontSize:16, fontStyle:'italic', marginBottom:6}}>결과가 없어요</div>
              "{q}" 와(과) 일치하는 항목이 없습니다
            </div>
          ) : filtered.map((it, i) => (
            <button key={i} onClick={it.go} onMouseEnter={() => setSel(i)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'10px 18px', border:'none', textAlign:'left',
                background: sel === i ? 'var(--paper-2)' : 'transparent',
                cursor:'pointer', color:'var(--ink)'
              }}>
              <span style={{
                fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
                color: kindColor[it.kind], minWidth:48
              }}>{kindLabel[it.kind]}</span>
              <span style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13.5, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{it.label}</div>
                {it.sub && <div style={{fontSize:11.5, color:'var(--ink-4)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{it.sub}</div>}
              </span>
              {sel === i && <span style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-4)'}}>↵</span>}
            </button>
          ))}
        </div>
        <div style={{padding:'8px 18px', borderTop:'1px solid var(--line)', display:'flex', gap:14, fontSize:11, color:'var(--ink-4)'}}>
          <span><kbd style={kbdStyle}>↑↓</kbd> 탐색</span>
          <span><kbd style={kbdStyle}>↵</kbd> 선택</span>
          <span style={{marginLeft:'auto'}}><kbd style={kbdStyle}>⌘K</kbd> 검색 열기</span>
        </div>
      </div>
    </div>
  );
}
const kbdStyle = { fontFamily:'var(--mono)', fontSize:10, padding:'1px 5px', border:'1px solid var(--line)', borderRadius:3, color:'var(--ink-3)', background:'var(--paper)' };

// ─────────────────────────────────────────────────────────
// Notification panel — bell icon
// ─────────────────────────────────────────────────────────
function NotificationPanel({ open, onClose, setActive }) {
  const store = useStore();
  const today = new Date();
  const todayDay = today.getDate();

  // Build notifications from upcoming fixed costs + card payments
  const notifs = fM(() => {
    const list = [];
    store.state.fixed.forEach(f => {
      const days = f.day - todayDay;
      if (days >= 0 && days <= 7) {
        list.push({
          kind: days <= 2 ? 'urgent' : 'soon',
          icon: 'calendar',
          title: f.name,
          sub: `${f.day}일 자동이체 · ${fmtKRW(f.amount)}`,
          when: days === 0 ? '오늘' : days === 1 ? '내일' : `${days}일 후`,
          go: () => { setActive('fixedcosts'); onClose(); }
        });
      }
    });
    store.state.cards.forEach(c => {
      const days = c.paymentDay - todayDay;
      if (days >= 0 && days <= 7 && c.used > 0) {
        list.push({
          kind: 'soon',
          icon: 'card',
          title: c.co + ' 결제',
          sub: `${c.paymentDay}일 결제 예정 · ${fmtKRW(c.used)}`,
          when: days === 0 ? '오늘' : days === 1 ? '내일' : `${days}일 후`,
          go: () => { setActive('creditcards'); onClose(); }
        });
      }
    });
    // Over-budget warning
    const fixedTotal = store.state.fixed.reduce((s,f)=>s+f.amount,0);
    if (fixedTotal / store.state.income > 0.5) {
      list.push({
        kind: 'urgent',
        icon: 'warn',
        title: '고정비 비중이 높아요',
        sub: `소득의 ${Math.round(fixedTotal/store.state.income*100)}% — 50% 권장 초과`,
        when: '점검',
        go: () => { setActive('fixedcosts'); onClose(); }
      });
    }
    // High card usage
    store.state.cards.forEach(c => {
      const pct = c.used / c.limit;
      if (pct > 0.7) {
        list.push({
          kind: 'urgent',
          icon: 'warn',
          title: c.co + ' 한도 임박',
          sub: `${(pct*100).toFixed(0)}% 사용 — 한도 조정 검토`,
          when: '점검',
          go: () => { setActive('creditcards'); onClose(); }
        });
      }
    });
    list.sort((a,b) => (a.kind==='urgent'?0:1) - (b.kind==='urgent'?0:1));
    return list;
  }, [store.state, open]);

  const ICONS = {
    calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    card: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
    warn: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>,
  };

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{position:'fixed', inset:0, zIndex:90, background:'transparent'}}></div>
      <div style={{
        position:'fixed', top:64, right:24, width:380, maxWidth:'calc(100vw - 32px)',
        background:'var(--paper)', border:'1px solid var(--line)', borderRadius:'var(--r-lg)',
        boxShadow:'var(--shadow-lg)', zIndex:100, overflow:'hidden',
        animation:'fadeUp .2s ease'
      }}>
        <div className="between" style={{padding:'16px 20px', borderBottom:'1px solid var(--line)'}}>
          <div>
            <div className="serif" style={{fontSize:16, fontWeight:500}}>알림</div>
            <div className="text-xs muted" style={{marginTop:2}}>{notifs.length}건의 점검 사항</div>
          </div>
          <span className="chip">{today.getMonth()+1}월 {todayDay}일</span>
        </div>
        <div style={{maxHeight:'56vh', overflowY:'auto'}}>
          {notifs.length === 0 ? (
            <div style={{padding:'48px 24px', textAlign:'center', color:'var(--ink-4)'}}>
              <div className="serif" style={{fontSize:18, fontStyle:'italic', marginBottom:6}}>모두 정상이에요</div>
              <div className="text-sm">7일 이내 결제 예정도 점검 사항도 없습니다</div>
            </div>
          ) : notifs.map((n, i) => (
            <button key={i} onClick={n.go} style={{
              width:'100%', display:'flex', gap:12, padding:'14px 20px',
              border:'none', borderBottom:'1px solid var(--line)', background:'transparent',
              cursor:'pointer', textAlign:'left', alignItems:'flex-start'
            }}>
              <div style={{
                width:32, height:32, borderRadius:8, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: n.kind === 'urgent' ? 'var(--negative-soft)' : 'var(--accent-soft)',
                color: n.kind === 'urgent' ? 'var(--negative)' : 'var(--accent)'
              }}>{ICONS[n.icon]}</div>
              <div style={{flex:1, minWidth:0}}>
                <div className="between" style={{alignItems:'baseline', gap:8}}>
                  <div style={{fontSize:13.5, fontWeight:600, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{n.title}</div>
                  <div className="text-xs mono" style={{color: n.kind==='urgent'?'var(--negative)':'var(--ink-4)', fontWeight:600, flexShrink:0}}>{n.when}</div>
                </div>
                <div className="text-xs muted" style={{marginTop:3}}>{n.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Day detail sheet (Timeline calendar click)
// ─────────────────────────────────────────────────────────
function DayDetail({ open, onClose, day, year, month, events }) {
  if (!open) return null;
  const dateStr = `${year}.${String(month).padStart(2,'0')}.${String(day).padStart(2,'0')}`;
  const dayName = ['일','월','화','수','목','금','토'][new Date(year, month-1, day).getDay()];
  const inSum = events.filter(e=>e.kind==='in').reduce((s,e)=>s+e.amount,0);
  const outSum = events.filter(e=>e.kind==='out').reduce((s,e)=>s+e.amount,0);
  return (
    <Modal open={open} onClose={onClose} title={`${month}월 ${day}일 ${dayName}요일`}>
      <div className="grid-2" style={{gap:12, marginBottom:16}}>
        <div style={{padding:14, border:'1px solid var(--line)', borderRadius:'var(--r-md)'}}>
          <div className="text-xs muted fw6" style={{textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6}}>유입</div>
          <div className="mono fw6 pos" style={{fontSize:18}}>+{fmtKRW(inSum, {compact:true})}</div>
        </div>
        <div style={{padding:14, border:'1px solid var(--line)', borderRadius:'var(--r-md)'}}>
          <div className="text-xs muted fw6" style={{textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6}}>지출</div>
          <div className="mono fw6 neg" style={{fontSize:18}}>−{fmtKRW(outSum, {compact:true})}</div>
        </div>
      </div>
      <div className="text-xs muted fw6" style={{textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8}}>예정 항목 ({events.length}건)</div>
      {events.length === 0 ? (
        <div style={{padding:'28px 0', textAlign:'center', color:'var(--ink-4)', fontSize:13}}>이 날에는 예정된 항목이 없어요</div>
      ) : events.map((e, i) => (
        <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--line)'}}>
          <div className={'day-chip ' + e.kind} style={{width:32, height:32, fontSize:10}}>
            {e.kind === 'in' ? '入' : '出'}
          </div>
          <div style={{flex:1, fontSize:13.5, fontWeight:500}}>{e.label}</div>
          <div className={'mono fw6 text-sm ' + (e.kind==='in'?'pos':'neg')}>
            {e.kind==='in'?'+':'−'}{fmtKRW(e.amount)}
          </div>
        </div>
      ))}
    </Modal>
  );
}

Object.assign(window, { CommandPalette, NotificationPanel, DayDetail });
