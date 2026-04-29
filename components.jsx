// Shared UI primitives
const { useState, useEffect, useRef, useMemo } = React;

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark">G</div>
      <div className="brand-name">Gravo<em> finance</em></div>
    </div>
  );
}

function Sidebar({ active, setActive, drawerOpen, setDrawerOpen }) {
  const handleNav = (id) => {
    setActive(id);
    setDrawerOpen && setDrawerOpen(false);
  };
  return (
    <>
      <div
        className={'sidebar-scrim' + (drawerOpen ? ' open' : '')}
        onClick={() => setDrawerOpen && setDrawerOpen(false)}
      ></div>
      <aside className={'sidebar' + (drawerOpen ? ' open' : '')}>
        <div className="sidebar-head-mobile">
          <Logo />
          <button className="icon-btn sidebar-close" onClick={() => setDrawerOpen && setDrawerOpen(false)} aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="sidebar-head-desktop">
          <Logo />
        </div>
        {NAV.map(group => (
          <div key={group.group} className="nav-section">
            <div className="nav-section-title">{group.group}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={'nav-item' + (active === item.id ? ' active' : '')}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-item-dot"></span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'italic', color: 'var(--ink-2)', marginBottom: 4 }}>gravo0801</div>
          <div>Personal Finance OS · v3.2</div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ active, setDrawerOpen, openSearch, openNotif, openSettings, theme, onToggleTheme }) {
  const isDark = theme === 'dark';
  const current = NAV.flatMap(g => g.items).find(i => i.id === active) || NAV[0].items[0];
  const groupOf = NAV.find(g => g.items.some(i => i.id === active))?.group || 'Overview';
  return (
    <header className="topbar">
      <button className="icon-btn topbar-menu" onClick={() => setDrawerOpen && setDrawerOpen(true)} aria-label="메뉴">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
      <div className="crumbs">
        <span className="crumbs-section">{groupOf}</span>
        <span className="crumbs-divider">/</span>
        <span className="crumbs-current">{current.label}</span>
      </div>
      <div className="topbar-right">
        <div className="date-pill">{new Date().toLocaleDateString("ko-KR",{year:"2-digit",month:"2-digit",day:"2-digit"}).replace(/\. /g,".").replace(".","")}.</div>
        <button className="icon-btn" title="검색 (⌘K)" onClick={openSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
        <button className="icon-btn" title="알림" onClick={openNotif} style={{position:'relative'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span style={{position:'absolute', top:5, right:6, width:6, height:6, borderRadius:'50%', background:'var(--accent)'}}></span>
        </button>
        <button className="icon-btn" title={isDark ? '라이트 모드로' : '다크 모드로'} onClick={onToggleTheme}
          style={{background: isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.04)', borderRadius:8, padding:6}}>
          {isDark ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
        <button className="icon-btn" title="데이터 설정" onClick={openSettings}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </header>
  );
}

// Bottom navigation for mobile — picks 5 most-used items
const BOTTOM_NAV_IDS = ['dashboard', 'expenses', 'fixedcosts', 'creditcards', 'analytics'];
const BOTTOM_NAV_ICONS = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  expenses: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/><path d="M12 7v5l3 2"/></svg>,
  fixedcosts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  creditcards: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>,
  analytics: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10l7 7"/><circle cx="12" cy="12" r="2"/></svg>,
};
function BottomNav({ active, setActive }) {
  const items = NAV.flatMap(g => g.items).filter(i => BOTTOM_NAV_IDS.includes(i.id));
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map(item => (
        <button
          key={item.id}
          className={'bn-item' + (active === item.id ? ' active' : '')}
          onClick={() => setActive(item.id)}
        >
          <span className="bn-icon">{BOTTOM_NAV_ICONS[item.id]}</span>
          <span className="bn-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function PageHeader({ eyebrow, title, titleEm, sub, right }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">
          {title}{titleEm && <em> {titleEm}</em>}
        </h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function MonthSwitch({ month = 4, year = 2026 }) {
  return (
    <div className="month-switch">
      <button>‹</button>
      <span className="label">{year}년 {month}월</span>
      <button>›</button>
    </div>
  );
}

// Sparkline SVG
function Sparkline({ data, color, height = 56 }) {
  const w = 200, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 8 - ((v - min) / range) * (h - 16)]);
  const linePath = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  const areaPath = linePath + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path className="area" d={areaPath} style={{ fill: color || 'var(--accent)' }} />
      <path className="line" d={linePath} style={{ stroke: color || 'var(--accent)' }} />
    </svg>
  );
}

// Donut chart
function Donut({ segments, size = 140, thickness = 18, center }) {
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const dasharray = `${len} ${c - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            strokeLinecap="butt"
          />
        );
      })}
      {center && (
        <foreignObject x="0" y="0" width={size} height={size}>
          <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
            {center}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

// Multi-line area chart
function AreaChart({ data, height = 180, color }) {
  const w = 600, h = height, pad = 10;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (w - pad*2), h - pad - ((v - min) / range) * (h - pad*2)]);
  const linePath = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  const areaPath = linePath + ` L ${w-pad} ${h-pad} L ${pad} ${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height:'auto' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color || 'var(--accent)'} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color || 'var(--accent)'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke={color || 'var(--accent)'} strokeWidth="1.8" />
      {pts.map((p, i) => i === pts.length - 1 && <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={color || 'var(--accent)'} />)}
    </svg>
  );
}

function Tile({ label, num, sub, accent }) {
  return (
    <div className="tile">
      <div className="tile-label" style={accent ? { color: accent } : null}>{label}</div>
      <div className="tile-num">{num}</div>
      {sub && <div className="text-xs muted" style={{marginTop: 6}}>{sub}</div>}
    </div>
  );
}

Object.assign(window, {
  Logo, Sidebar, Topbar, PageHeader, MonthSwitch, Sparkline, Donut, AreaChart, Tile
});
