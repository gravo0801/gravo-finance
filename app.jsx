// Main app shell + tweaks
const { useState: useS, useEffect: useE } = React;

const PAGES = {
  dashboard: DashboardPage,
  accounts: AccountsPage,
  flowmap: FlowMapPage,
  fixedcosts: FixedCostsPage,
  timeline: TimelinePage,
  expenses: ExpensesPage,
  creditcards: CreditCardsPage,
  analytics: AnalyticsPage,
};

const ACCENT_PRESETS = {
  terracotta: { accent: '#C96442', accent2: '#B5532E' },
  ink:        { accent: '#1A1714', accent2: '#000000' },
  sage:       { accent: '#5C8A5A', accent2: '#456B43' },
  indigo:     { accent: '#5B6CB5', accent2: '#465596' },
  amber:      { accent: '#C49058', accent2: '#A07442' },
};

function AppShell() {
  const [active, setActive] = useS('dashboard');
  const [expenseOpen, setExpenseOpen] = useS(false);
  const [fixedOpen, setFixedOpen] = useS(false);
  const [cardOpen, setCardOpen] = useS(false);
  const [accountOpen, setAccountOpen] = useS(false);
  const [incomeOpen, setIncomeOpen] = useS(false);
  const [drawerOpen, setDrawerOpen] = useS(false);
  const [searchOpen, setSearchOpen] = useS(false);
  const [notifOpen, setNotifOpen] = useS(false);
  const [settingsOpen, setSettingsOpen] = useS(false);

  // Lock body scroll when drawer open
  useE(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Cmd+K / Ctrl+K to open search
  useE(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
    "accent": "terracotta",
    "theme": "light",
    "density": "comfy",
    "serifTitles": true
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULS);

  useE(() => {
    document.body.setAttribute('data-theme', tweaks.theme);
    document.body.setAttribute('data-density', tweaks.density);
    const preset = ACCENT_PRESETS[tweaks.accent] || ACCENT_PRESETS.terracotta;
    const root = document.documentElement;
    root.style.setProperty('--accent', preset.accent);
    root.style.setProperty('--accent-2', preset.accent2);
    root.style.setProperty('--accent-soft', preset.accent + '1A');
    root.style.setProperty('--accent-line', preset.accent + '38');
    const serif = tweaks.serifTitles ? "'Source Serif 4', Georgia, serif" : "'Pretendard', sans-serif";
    root.style.setProperty('--serif', serif);
  }, [tweaks]);

  const Page = PAGES[active] || DashboardPage;

  return (
    <>
      <div className="app">
        <Sidebar active={active} setActive={setActive} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
        <div className="main">
          <Topbar active={active} setDrawerOpen={setDrawerOpen}
            openSearch={() => setSearchOpen(true)}
            openNotif={() => setNotifOpen(true)}
            openSettings={() => setSettingsOpen(true)} />
          <div className="content">
            <Page
              openExpense={() => setExpenseOpen(true)}
              openFixed={() => setFixedOpen(true)}
              openCard={() => setCardOpen(true)}
              openAccount={() => setAccountOpen(true)}
              openIncome={() => setIncomeOpen(true)}
              setActive={setActive}
            />
          </div>
        </div>
        <BottomNav active={active} setActive={setActive} onAdd={() => setExpenseOpen(true)} />
      </div>

      <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <AddFixedModal open={fixedOpen} onClose={() => setFixedOpen(false)} />
      <AddCardModal open={cardOpen} onClose={() => setCardOpen(false)} />
      <AddAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <EditIncomeModal open={incomeOpen} onClose={() => setIncomeOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        setActive={setActive}
        openExpense={() => setExpenseOpen(true)}
        openFixed={() => setFixedOpen(true)}
        openCard={() => setCardOpen(true)}
        openAccount={() => setAccountOpen(true)}
        openIncome={() => setIncomeOpen(true)}
        openSettings={() => setSettingsOpen(true)}
      />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        setActive={setActive}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio label="Background" value={tweaks.theme}
            options={[{value:'light', label:'Cream'}, {value:'dark', label:'Ink'}]}
            onChange={v => setTweak('theme', v)} />
          <TweakRadio label="Density" value={tweaks.density}
            options={[{value:'comfy', label:'Comfy'}, {value:'compact', label:'Compact'}]}
            onChange={v => setTweak('density', v)} />
          <TweakToggle label="Serif headlines" checked={tweaks.serifTitles} onChange={v => setTweak('serifTitles', v)} />
        </TweakSection>
        <TweakSection title="Accent color">
          <TweakSelect label="Preset" value={tweaks.accent}
            options={[
              {value:'terracotta', label:'Terracotta (Claude)'},
              {value:'ink', label:'Pure Ink'},
              {value:'sage', label:'Sage Green'},
              {value:'indigo', label:'Soft Indigo'},
              {value:'amber', label:'Warm Amber'},
            ]} onChange={v => setTweak('accent', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
