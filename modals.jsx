
function SyncSection() {
  const store = useStore();  // ← 최상단에서 한 번만 호출
  const toast = useToast();
  const [status, setStatus] = mS('off');
  const [apiKey, setApiKey] = mS(localStorage.getItem('gf_fb_apikey') || '');
  const [projId, setProjId] = mS(localStorage.getItem('gf_fb_projid') || '');
  const [code,   setCode]   = mS(localStorage.getItem('gf_fb_synccode') || '');
  const [error,  setError]  = mS('');
  const [busy,   setBusy]   = mS(false);

  React.useEffect(() => {
    const unsub = store.fbOnStatus(setStatus);
    return unsub;
  }, []);

  const connect = async () => {
    if (!apiKey || !projId || !code) { setError('모든 항목을 입력하세요'); return; }
    setBusy(true); setError('');
    try {
      await store.fbConnect(apiKey, projId, code);
      toast('✅ 동기화 연결됨');
    } catch(e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const disconnect = () => {
    store.fbDisconnect();
    toast('동기화 해제됨');
  };

  const dotColor = { off:'var(--ink-5)', connecting:'var(--warm)', ok:'var(--positive)', error:'var(--negative)' }[status];
  const dotLabel = { off:'연결 안 됨', connecting:'연결 중...', ok:'동기화 중', error:'오류' }[status];
  const syncCode = localStorage.getItem('gf_fb_synccode') || '';

  if (status === 'ok') {
    return (
      <div style={{padding:'12px 14px', background:'var(--positive-soft)', border:'1px solid var(--positive)', borderRadius:'var(--r-sm)', marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'var(--positive)',display:'inline-block',boxShadow:'0 0 6px var(--positive)'}}></span>
          <span style={{fontSize:13, fontWeight:600, color:'var(--positive)'}}>실시간 동기화 활성</span>
        </div>
        <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:10, lineHeight:1.6}}>
          코드: <strong>{syncCode}</strong><br/>
          같은 코드로 접속한 모든 기기에 자동 동기화됩니다.
        </div>
        <button className="btn" onClick={disconnect} style={{fontSize:12, color:'var(--negative)', borderColor:'var(--negative-soft)'}}>연결 해제</button>
      </div>
    );
  }

  return (
    <div style={{marginBottom:16}}>
      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:12, padding:'8px 10px', background:'var(--bg)', borderRadius:'var(--r-sm)', border:'1px solid var(--line)'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:dotColor,display:'inline-block'}}></span>
        <span style={{fontSize:12, color:'var(--ink-4)'}}>{dotLabel}</span>
      </div>
      <Field label="Firebase API Key">
        <TextInput type="password" placeholder="AIzaSy..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </Field>
      <Field label="Project ID">
        <TextInput placeholder="endoapp-cc066" value={projId} onChange={e => setProjId(e.target.value)} />
      </Field>
      <Field label="동기화 코드" hint="모든 기기에서 같은 코드 사용">
        <TextInput placeholder="예: gravo2026" value={code} onChange={e => setCode(e.target.value)} />
      </Field>
      {error && <div style={{fontSize:12, color:'var(--negative)', marginBottom:8, padding:'8px 10px', background:'var(--negative-soft)', borderRadius:'var(--r-sm)'}}>{error}</div>}
      <button className="btn btn-primary" onClick={connect} disabled={busy} style={{width:'100%', justifyContent:'center'}}>
        {busy ? '연결 중...' : '📡 동기화 연결'}
      </button>
    </div>
  );
}

// Modal forms for adding/editing
const { useState: mS } = React;

function AddExpenseModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const today = new Date().toISOString().slice(0,10);
  const [f, setF] = mS({ date: today, title: '', amount: '', cat: '식비', card: '롯데카드' });
  React.useEffect(() => { if (open) setF({ date: today, title: '', amount: '', cat: '식비', card: '롯데카드' }); }, [open]);

  const cats = [
    { value:'식비', label:'식비', tone:'indigo', mark:'식' },
    { value:'카페', label:'카페', tone:'warm', mark:'커' },
    { value:'생활', label:'생활', tone:'pos', mark:'생' },
    { value:'문화', label:'문화', tone:'accent', mark:'문' },
    { value:'교통', label:'교통', tone:'neg', mark:'교' },
    { value:'기타', label:'기타', tone:'indigo', mark:'기' },
  ];

  const submit = () => {
    if (!f.title || !f.amount) { toast('제목과 금액을 입력하세요'); return; }
    const cat = cats.find(c => c.value === f.cat);
    store.addExpense({ date: f.date, title: f.title, amount: Number(f.amount), cat: f.cat, card: f.card, tone: cat.tone, mark: cat.mark });
    toast('소비 내역이 추가되었어요');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="소비 추가" footer={
      <>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>저장</button>
      </>
    }>
      <Field label="날짜">
        <TextInput type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} />
      </Field>
      <Field label="내용">
        <TextInput placeholder="예: 점심 — 평양면옥" value={f.title} onChange={e => setF({...f, title: e.target.value})} />
      </Field>
      <Field label="금액 (원)" hint="'12000', '1.2만', '50만' 모두 가능">
        <NumberInput placeholder="0" value={f.amount} onChange={v => setF({...f, amount: v})} />
      </Field>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Field label="카테고리">
          <Select value={f.cat} onChange={v => setF({...f, cat: v})} options={cats.map(c => ({value:c.value, label:c.label}))} />
        </Field>
        <Field label="결제 카드">
          <Select value={f.card} onChange={v => setF({...f, card: v})} options={store.state.cards.map(c => ({value:c.co, label:c.co}))} />
        </Field>
      </div>
    </Modal>
  );
}

function AddFixedModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const [f, setF] = mS({ group: '주거비', day: 1, name: '', meta: '', amount: '' });
  React.useEffect(() => { if (open) setF({ group: '주거비', day: 1, name: '', meta: '', amount: '' }); }, [open]);
  const submit = () => {
    if (!f.name || !f.amount) { toast('이름과 금액을 입력하세요'); return; }
    store.addFixed({ ...f, day: Number(f.day), amount: Number(f.amount) });
    toast('고정비가 등록되었어요');
    onClose();
  };
  const groups = [...new Set(store.state.fixed.map(x => x.group))];
  return (
    <Modal open={open} onClose={onClose} title="고정비 추가" footer={
      <>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </>
    }>
      <Field label="그룹">
        <Select value={f.group} onChange={v => setF({...f, group: v})} options={groups.map(g => ({value:g, label:g})).concat([{value:'기타', label:'기타'}])} />
      </Field>
      <Field label="이름"><TextInput placeholder="예: 인터넷 요금" value={f.name} onChange={e => setF({...f, name: e.target.value})} /></Field>
      <Field label="메모"><TextInput placeholder="예: KT 자동이체" value={f.meta} onChange={e => setF({...f, meta: e.target.value})} /></Field>
      <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:12}}>
        <Field label="결제일"><TextInput type="number" min="1" max="31" value={f.day} onChange={e => setF({...f, day: e.target.value})} /></Field>
        <Field label="금액"><NumberInput placeholder="0" value={f.amount} onChange={v => setF({...f, amount: v})} /></Field>
      </div>
    </Modal>
  );
}

function AddCardModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const gradients = [
    'linear-gradient(135deg,#1F2937 0%,#374151 60%,#C96442 200%)',
    'linear-gradient(135deg,#1F2937 0%,#3F3530 60%,#5C8A5A 200%)',
    'linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#5B6CB5 200%)',
    'linear-gradient(135deg,#1A1714 0%,#3D3833 60%,#C49058 200%)',
    'linear-gradient(135deg,#0F1419 0%,#2D2823 60%,#A855F7 200%)',
  ];
  const [f, setF] = mS({ co:'', name:'', last4:'', limit:'', paymentDay:14, gradient: gradients[0] });
  React.useEffect(() => { if (open) setF({ co:'', name:'', last4:'', limit:'', paymentDay:14, gradient: gradients[0] }); }, [open]);
  const submit = () => {
    if (!f.co || !f.name || !f.limit) { toast('필수 항목을 입력하세요'); return; }
    store.addCard({ ...f, last4: f.last4 || '0000', limit: Number(f.limit), used: 0, paymentDay: Number(f.paymentDay) });
    toast('카드가 등록되었어요');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="신용카드 추가" footer={
      <>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </>
    }>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Field label="카드사"><TextInput placeholder="예: 현대카드" value={f.co} onChange={e => setF({...f, co: e.target.value})} /></Field>
        <Field label="카드명"><TextInput placeholder="예: M Edition" value={f.name} onChange={e => setF({...f, name: e.target.value})} /></Field>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
        <Field label="끝 4자리"><TextInput maxLength="4" placeholder="0000" value={f.last4} onChange={e => setF({...f, last4: e.target.value})} /></Field>
        <Field label="결제일"><TextInput type="number" min="1" max="31" value={f.paymentDay} onChange={e => setF({...f, paymentDay: e.target.value})} /></Field>
        <Field label="한도"><NumberInput placeholder="0" value={f.limit} onChange={v => setF({...f, limit: v})} /></Field>
      </div>
      <Field label="카드 디자인">
        <div style={{display:'flex', gap:8}}>
          {gradients.map((g, i) => (
            <div key={i} onClick={() => setF({...f, gradient: g})} style={{
              flex:1, aspectRatio:'1.6/1', borderRadius:8, background:g, cursor:'pointer',
              border: f.gradient === g ? '2px solid var(--accent)' : '2px solid transparent'
            }}></div>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

Object.assign(window, { AddExpenseModal, AddFixedModal, AddCardModal, AddAccountModal, EditIncomeModal });

function AddAccountModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const KINDS = [
    { value:'checking', label:'입출금' },
    { value:'savings', label:'저축' },
    { value:'investment', label:'투자' },
    { value:'credit-line', label:'마이너스통장' },
  ];
  const [f, setF] = mS({ name:'', sub:'', kind:'checking', balance:'', limit:'' });
  React.useEffect(() => { if (open) setF({ name:'', sub:'', kind:'checking', balance:'', limit:'' }); }, [open]);
  const submit = () => {
    if (!f.name) { toast('통장 이름을 입력하세요'); return; }
    const isLine = f.kind === 'credit-line';
    store.addAccount({
      name: f.name, sub: f.sub || (isLine?'마이너스통장':'주거래'),
      kind: f.kind,
      balance: isLine ? -Math.abs(Number(f.balance)||0) : Number(f.balance)||0,
      limit: isLine ? Number(f.limit)||0 : 0,
      flowIn: 0, flowOut: 0,
    });
    toast('통장이 등록되었어요');
    onClose();
  };
  const isLine = f.kind === 'credit-line';
  return (
    <Modal open={open} onClose={onClose} title="통장 추가" footer={
      <>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </>
    }>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Field label="이름"><TextInput placeholder="예: 토스뱅크" value={f.name} onChange={e => setF({...f, name: e.target.value})} /></Field>
        <Field label="별칭"><TextInput placeholder="예: 비상금" value={f.sub} onChange={e => setF({...f, sub: e.target.value})} /></Field>
      </div>
      <Field label="종류">
        <Select value={f.kind} onChange={v => setF({...f, kind: v})} options={KINDS} />
      </Field>
      <div style={{display:'grid', gridTemplateColumns: isLine?'1fr 1fr':'1fr', gap:12}}>
        <Field label={isLine?'사용 금액':'현재 잔액'} hint={isLine?'마이너스로 자동 처리':''}>
          <NumberInput placeholder="0" value={f.balance} onChange={v => setF({...f, balance: v})} />
        </Field>
        {isLine && <Field label="한도"><NumberInput placeholder="0" value={f.limit} onChange={v => setF({...f, limit: v})} /></Field>}
      </div>
    </Modal>
  );
}

function EditIncomeModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const [v, setV] = mS('');
  React.useEffect(() => { if (open) setV(store.state.income); }, [open]);
  const submit = () => {
    const n = Number(v);
    if (!n || n < 0) { toast('금액을 확인해주세요'); return; }
    store.setIncome(n);
    toast('월 수입이 업데이트되었어요');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="월 수입 설정" footer={
      <>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>저장</button>
      </>
    }>
      <Field label="월 수입 (세후)" hint="대시보드와 비율 계산에 쓰여요">
        <NumberInput placeholder="0" value={v} onChange={n => setV(n)} />
      </Field>
      <div className="text-sm muted" style={{marginTop:8}}>
        현재 설정: <span className="mono fw6">₩{(store.state.income/10000).toLocaleString()}만</span>
      </div>
    </Modal>
  );
}

function SettingsModal({ open, onClose }) {
  const store = useStore();
  const toast = useToast();
  const fileRef = React.useRef(null);
  const [confirmReset, setConfirmReset] = mS(false);
  const [importPreview, setImportPreview] = mS(null);

  const counts = {
    accounts: store.state.accounts.length,
    cards: store.state.cards.length,
    fixed: store.state.fixed.length,
    expenses: store.state.expenses.length,
  };

  const handleExport = () => {
    const data = store.exportData();
    const payload = {
      __app: 'gravo-finance',
      __version: 2,
      __exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `gravo-finance-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('백업 파일을 내려받았어요');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.data || parsed;
      // Basic shape check
      if (!Array.isArray(payload.accounts) || !Array.isArray(payload.expenses)) {
        throw new Error('형식이 올바르지 않습니다');
      }
      setImportPreview({
        filename: file.name,
        exportedAt: parsed.__exportedAt,
        data: payload,
        counts: {
          accounts: payload.accounts?.length || 0,
          cards: payload.cards?.length || 0,
          fixed: payload.fixed?.length || 0,
          expenses: payload.expenses?.length || 0,
        }
      });
    } catch(err) {
      toast('파일을 읽지 못했어요: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  const confirmImport = () => {
    if (!importPreview) return;
    // Auto-backup current before import
    try {
      const backup = JSON.stringify({ __app:'gravo-finance', __autoBackup:true, __at:new Date().toISOString(), data: store.exportData() });
      localStorage.setItem('gravo-finance-autobackup', backup);
    } catch(e) {}
    try {
      store.importData(importPreview.data);
      setImportPreview(null);
      toast('데이터를 가져왔어요. 이전 데이터는 자동 백업됨');
    } catch(err) {
      toast('가져오기 실패: ' + err.message);
    }
  };

  const restoreAutoBackup = () => {
    try {
      const raw = localStorage.getItem('gravo-finance-autobackup');
      if (!raw) { toast('자동 백업이 없어요'); return; }
      const parsed = JSON.parse(raw);
      store.importData(parsed.data);
      toast('자동 백업으로 복원했어요');
    } catch(err) {
      toast('복원 실패: ' + err.message);
    }
  };

  const handleReset = () => {
    // Auto-backup before reset
    try {
      const backup = JSON.stringify({ __app:'gravo-finance', __autoBackup:true, __at:new Date().toISOString(), data: store.exportData() });
      localStorage.setItem('gravo-finance-autobackup', backup);
    } catch(e) {}
    store.reset();
    setConfirmReset(false);
    toast('초기 데이터로 되돌렸어요. 자동 백업됨');
  };

  const hasAutoBackup = (() => {
    try { return !!localStorage.getItem('gravo-finance-autobackup'); } catch(e) { return false; }
  })();

  if (!open) return null;
  if (importPreview) {
    return (
      <Modal open={true} onClose={() => setImportPreview(null)} title="가져오기 확인" footer={
        <>
          <button className="btn" onClick={() => setImportPreview(null)}>취소</button>
          <button className="btn btn-primary" onClick={confirmImport}>덮어쓰기 가져오기</button>
        </>
      }>
        <div style={{padding:'12px 14px', background:'var(--accent-soft)', border:'1px solid var(--accent-line)', borderRadius:'var(--r-sm)', fontSize:13, marginBottom:14, color:'var(--accent-2)', lineHeight:1.6}}>
          현재 데이터는 자동으로 백업되며, "자동 백업 복원"으로 되돌릴 수 있어요.
        </div>
        <div style={{fontSize:12.5, color:'var(--ink-3)', marginBottom:6}}>파일</div>
        <div className="mono fw6" style={{fontSize:13, marginBottom:14}}>{importPreview.filename}</div>
        {importPreview.exportedAt && (
          <>
            <div style={{fontSize:12.5, color:'var(--ink-3)', marginBottom:6}}>내보낸 시각</div>
            <div className="mono" style={{fontSize:12.5, marginBottom:14}}>{new Date(importPreview.exportedAt).toLocaleString('ko-KR')}</div>
          </>
        )}
        <div style={{fontSize:12.5, color:'var(--ink-3)', marginBottom:8}}>가져올 데이터</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8}}>
          {[['통장', importPreview.counts.accounts, counts.accounts],
            ['카드', importPreview.counts.cards, counts.cards],
            ['고정비', importPreview.counts.fixed, counts.fixed],
            ['소비', importPreview.counts.expenses, counts.expenses]].map(([label, next, curr]) => (
            <div key={label} style={{padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'var(--r-sm)'}}>
              <div style={{fontSize:11, color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.06em'}}>{label}</div>
              <div className="mono" style={{fontSize:14, marginTop:4}}>
                <span style={{color:'var(--ink-3)'}}>{curr}</span>
                <span style={{margin:'0 6px', color:'var(--ink-4)'}}>→</span>
                <span style={{color:'var(--accent-2)', fontWeight:600}}>{next}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="데이터 관리">
      <div style={{fontSize:12.5, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8}}>현재 데이터</div>
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        {[['통장', counts.accounts], ['카드', counts.cards], ['고정비', counts.fixed], ['소비', counts.expenses]].map(([l,n]) => (
          <div key={l} style={{flex:'1 1 0', minWidth:80, padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--r-sm)'}}>
            <div style={{fontSize:11, color:'var(--ink-4)'}}>{l}</div>
            <div className="mono fw6" style={{fontSize:18, marginTop:2}}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:12.5, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8}}>백업</div>
      <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:18}}>
        <button className="btn btn-primary" onClick={handleExport} style={{justifyContent:'flex-start'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          내보내기 (JSON 다운로드)
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} style={{display:'none'}} />
        <button className="btn" onClick={() => fileRef.current?.click()} style={{justifyContent:'flex-start'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
          가져오기 (JSON 파일 선택)
        </button>
        <div style={{fontSize:11.5, color:'var(--ink-4)', lineHeight:1.6, marginTop:2}}>
          가져오기 전 현재 데이터는 자동 백업되며, 아래 버튼으로 되돌릴 수 있어요.
        </div>
      </div>


      {/* ─── Firebase 동기화 ─── */}
      <div style={{fontSize:12.5, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8, marginTop:4}}>실시간 동기화</div>
      <SyncSection />
      <div style={{fontSize:12.5, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8}}>복구</div>
      <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:18}}>
        <button className="btn" onClick={restoreAutoBackup} disabled={!hasAutoBackup} style={{justifyContent:'flex-start', opacity: hasAutoBackup?1:0.5}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8}}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          자동 백업 복원 {hasAutoBackup ? '' : '(없음)'}
        </button>
      </div>

      <div style={{fontSize:12.5, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8}}>위험</div>
      {!confirmReset ? (
        <button className="btn" onClick={() => setConfirmReset(true)} style={{justifyContent:'flex-start', color:'var(--negative)', borderColor:'var(--negative-soft)'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:8}}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          모든 데이터 초기화
        </button>
      ) : (
        <div style={{padding:14, background:'var(--negative-soft)', border:'1px solid var(--negative)', borderRadius:'var(--r-sm)'}}>
          <div style={{fontSize:13, color:'var(--negative)', fontWeight:600, marginBottom:6}}>정말 초기화할까요?</div>
          <div style={{fontSize:12, color:'var(--ink-3)', lineHeight:1.6, marginBottom:12}}>
            모든 통장·카드·고정비·소비내역이 시드 데이터로 되돌아갑니다. 현재 데이터는 자동 백업됩니다.
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={() => setConfirmReset(false)}>취소</button>
            <button className="btn" onClick={handleReset} style={{background:'var(--negative)', color:'#fff', borderColor:'var(--negative)'}}>초기화</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { SettingsModal });
