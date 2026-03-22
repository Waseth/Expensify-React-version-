import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, API } from '../context/AuthContext';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend
} from 'chart.js';
import {
  LayoutDashboard, ListChecks, TrendingUp,
  Menu, X, LogOut,
  PlusCircle, RefreshCw, Trash2, Lock,
  CheckCircle2, AlertTriangle, Info, XCircle,
  ChevronRight, Wallet, PiggyBank, Gamepad2,
  Calendar, ArrowRightLeft, Banknote, CreditCard,
  BarChart2, PieChart, Clock, Edit3,
  ArrowUpRight, ArrowDownRight, Minus,
  DollarSign, ShieldCheck, Zap
} from 'lucide-react';
import XpensifyLogo from '../components/XpensifyLogo';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);


function fmt(n) {
  const v = parseFloat(n || 0);
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentWeekInfo() {
  const day = new Date().getDate();
  if (day <= 7)  return { key: 'fixed_week1', label: 'Fixed + Week 1', num: 1 };
  if (day <= 14) return { key: 'week2',       label: 'Week 2',         num: 2 };
  if (day <= 21) return { key: 'week3',       label: 'Week 3',         num: 3 };
  return           { key: 'week4',       label: 'Week 4',         num: 4 };
}

function getCurrentWeek() {
  return getCurrentWeekInfo().label;
}

function getMonthLabel() {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

const CAT_NAMES = {
  fixed_week1: 'Fixed + Week 1', week2: 'Week 2', week3: 'Week 3', week4: 'Week 4',
  savings: 'Savings', personal: 'Personal'
};


function Notifications({ notifs }) {
  const Icon = ({ type }) => {
    if (type === 'success') return <CheckCircle2 size={14} />;
    if (type === 'error')   return <XCircle      size={14} />;
    if (type === 'warning') return <AlertTriangle size={14} />;
    return                         <Info          size={14} />;
  };
  return (
    <div className="xp-notifications">
      {notifs.map(n => (
        <div key={n.id} className={`xp-notif ${n.type} ${n.fading ? 'fade-out' : ''}`}>
          <Icon type={n.type} />
          {n.message}
        </div>
      ))}
    </div>
  );
}


function Modal({ open, onClose, title, sub, children, actions }) {
  return (
    <div className={`xp-modal-overlay ${open ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="xp-modal">
        <button className="xp-modal-close" onClick={onClose}><X size={16} /></button>
        {title && <h2 className="xp-modal-title">{title}</h2>}
        {sub && <p className="xp-modal-sub">{sub}</p>}
        {children}
        {actions && <div className="xp-modal-actions">{actions}</div>}
      </div>
    </div>
  );
}



function SplitSlider({ pct, onChange, amount, label = 'SPLIT' }) {
  const savingsAmt = parseFloat(((amount || 0) * pct / 100).toFixed(2));
  const personalAmt = parseFloat(((amount || 0) * (100 - pct) / 100).toFixed(2));
  const hasAmount = (amount || 0) > 0;

  return (
    <div className="xp-modal-split">
      <div className="xp-modal-split-header">
        <span className="xp-label">{label}</span>
        <span className="xp-modal-split-ratio">{pct}<span style={{ color: 'var(--text-dim)' }}>/{100 - pct}</span></span>
      </div>

      <div className="xp-modal-split-bar">
        <div className="xp-modal-split-bar-savings" style={{ width: `${pct}%` }} />
        <div className="xp-modal-split-bar-personal" />
      </div>

      <input
        type="range"
        className="xp-slider"
        min="0" max="100"
        value={pct}
        onChange={e => onChange(Number(e.target.value))}
      />

      <div className="xp-modal-split-preview">
        <div className="xp-modal-split-side savings">
          <div className="xp-modal-split-side-icon"><PiggyBank size={16} /></div>
          <div className="xp-modal-split-side-content">
            <span className="xp-modal-split-side-label">SAVINGS</span>
            <span className={`xp-modal-split-side-val ${hasAmount ? 'text-green' : ''}`}>
              {hasAmount ? `Ksh ${fmt(savingsAmt)}` : `${pct}%`}
            </span>
          </div>
        </div>

        <div className="xp-modal-split-divider"><ArrowRightLeft size={12} /></div>

        <div className="xp-modal-split-side personal">
          <div className="xp-modal-split-side-icon"><Gamepad2 size={16} /></div>
          <div className="xp-modal-split-side-content">
            <span className="xp-modal-split-side-label">PERSONAL</span>
            <span className={`xp-modal-split-side-val ${hasAmount ? 'text-gold' : ''}`}>
              {hasAmount ? `Ksh ${fmt(personalAmt)}` : `${100 - pct}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


function WeekCard({ weekKey, weekId, title, data, splitPct, onEndWeek, onEditBudget, expenses }) {
  const pct = data.allocated > 0 ? Math.min(100, (data.spent / data.allocated) * 100) : 0;
  const remaining = data.allocated - data.spent;

  let fillClass = '';
  let alertType = '';
  let alertMsg = '';

  if (data.ended) {
    fillClass = 'ended';
    alertType = 'ended';
    alertMsg = 'Week closed';
  } else if (remaining < 0) {
    fillClass = 'danger';
    alertType = 'danger';
    alertMsg = `Overspent by Ksh ${fmt(Math.abs(remaining))}`;
  } else if (pct >= 90) {
    fillClass = 'warning';
    alertType = 'warning';
    alertMsg = 'Approaching budget limit';
  } else if (pct < 50 && data.spent > 0) {
    fillClass = 'success';
    alertType = 'success';
    alertMsg = `Ksh ${fmt(remaining)} remaining — looking good!`;
  }

  const weekExpenses = expenses.filter(e => e.category === weekKey);

  return (
    <div className={`xp-week-card ${data.ended ? 'ended' : ''}`}>
      <div className="xp-week-card-header">
        <div className="xp-week-card-title-row">
          <span className="xp-week-card-title">{title}</span>
          <span className={`xp-badge ${data.ended ? 'xp-badge-gray' : remaining < 0 ? 'xp-badge-red' : pct < 50 ? 'xp-badge-green' : pct >= 90 ? 'xp-badge-yellow' : 'xp-badge-accent'}`}>
            {data.ended ? 'ENDED' : remaining < 0 ? 'OVERSPENT' : pct >= 90 ? 'NEAR LIMIT' : pct < 50 ? 'UNDER' : 'ON TRACK'}
          </span>
        </div>
        <div className="xp-week-card-actions">
          {!data.ended && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '.58rem', padding: '.3rem .7rem' }}
              onClick={() => onEditBudget(weekKey, title)}
            >
              {data.allocated === 0 ? '+ SET BUDGET' : 'EDIT BUDGET'}
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ fontSize: '.58rem', padding: '.3rem .7rem' }}
            onClick={() => onEndWeek(weekKey)}
            disabled={data.ended}
          >
            {data.ended ? 'CLOSED' : 'END WEEK'}
          </button>
        </div>
      </div>
      <div className="xp-week-card-body">
        <div className="xp-budget-trio">
          <div className="xp-budget-cell">
            <span className="xp-budget-cell-label">Allocated</span>
            <span className="xp-budget-cell-val">Ksh {fmt(data.allocated)}</span>
          </div>
          <div className="xp-budget-cell">
            <span className="xp-budget-cell-label">Spent</span>
            <span className="xp-budget-cell-val text-red">Ksh {fmt(data.spent)}</span>
          </div>
          <div className="xp-budget-cell">
            <span className="xp-budget-cell-label">Remaining</span>
            <span className={`xp-budget-cell-val ${remaining < 0 ? 'text-red' : 'text-green'}`}>Ksh {fmt(remaining)}</span>
          </div>
        </div>

        <div className="xp-progress-wrap">
          <div className="xp-progress-labels">
            <span>USAGE</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="xp-progress-track">
            <div className={`xp-progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {alertMsg && <div className={`xp-alert ${alertType}`}>{alertMsg}</div>}

        <div className="xp-expense-list">
          {weekExpenses.length === 0
            ? <span style={{ fontSize: '.78rem', color: 'var(--text-dimmer)', fontFamily: 'var(--font-mono)' }}>NO EXPENSES</span>
            : weekExpenses.slice(-5).map(e => (
              <div key={e.id} className="xp-expense-item">
                <div className="xp-expense-desc">
                  <strong>{e.description}</strong>
                  <small>{fmtDate(e.expense_date)}</small>
                </div>
                <span className="xp-expense-amt">−Ksh {fmt(e.amount)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}


export default function AppDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('input');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [settings, setSettings] = useState({ monthly_allowance: 0, budget_locked: false, split_percentage: 50 });
  const [weeks, setWeeks] = useState({
    fixed_week1: { allocated: 0, spent: 0, ended: false },
    week2: { allocated: 0, spent: 0, ended: false },
    week3: { allocated: 0, spent: 0, ended: false },
    week4: { allocated: 0, spent: 0, ended: false },
  });
  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState({ savings: { balance: 0, total_spent: 0 }, personal: { balance: 0, total_spent: 0 } });
  const [externalHistory, setExternalHistory] = useState([]);

  const [monthlyAllowance, setMonthlyAllowance] = useState('');
  const [splitPct, setSplitPct] = useState(50);
  const [weekAllocations, setWeekAllocations] = useState({ fixed_week1: '', week2: '', week3: '', week4: '' });
  const [remainingToAllocate, setRemainingToAllocate] = useState(0);
  const [expCat, setExpCat] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  const [extIncomeOpen, setExtIncomeOpen] = useState(false);
  const [extAmt, setExtAmt] = useState('');
  const [extDesc, setExtDesc] = useState('');
  const [endWeekModal, setEndWeekModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const [extSplitPct, setExtSplitPct] = useState(() =>
    parseInt(localStorage.getItem('xp_ext_split') || '50', 10)
  );
  const [endWeekSplitPct, setEndWeekSplitPct] = useState(() =>
    parseInt(localStorage.getItem('xp_week_split') || '50', 10)
  );

  useEffect(() => {
    localStorage.setItem('xp_ext_split', String(extSplitPct));
  }, [extSplitPct]);

  useEffect(() => {
    localStorage.setItem('xp_week_split', String(endWeekSplitPct));
  }, [endWeekSplitPct]);


  const [weekAllocModal, setWeekAllocModal] = useState(null);
  const [weekAllocInput, setWeekAllocInput] = useState('');


  const [notifs, setNotifs] = useState([]);
  const notifIdRef = useRef(0);

  const month = getCurrentMonth();

  const notify = useCallback((message, type = 'info') => {
    const id = ++notifIdRef.current;
    setNotifs(prev => [...prev, { id, message, type, fading: false }]);
    setTimeout(() => {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, fading: true } : n));
      setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 450);
    }, 4500);
  }, []);


  const loadData = useCallback(async () => {
    try {
      const [settingsRes, expensesRes, accountsRes, extRes] = await Promise.all([
        API.get(`/budget/settings?month=${month}`),
        API.get(`/expenses?month=${month}`),
        API.get(`/income/accounts?month=${month}`),
        API.get(`/income/external?month=${month}`),
      ]);

      const s = settingsRes.data;
      setSettings(s.settings);
      setWeeks(s.weeks);
      setSplitPct(s.settings.split_percentage || 50);

      if (s.settings.budget_locked) {
        setMonthlyAllowance(String(s.settings.monthly_allowance));
        const alloc = {};
        Object.keys(s.weeks).forEach(k => { alloc[k] = String(s.weeks[k].allocated); });
        setWeekAllocations(alloc);
      }

      setExpenses(expensesRes.data);
      setAccounts(accountsRes.data);
      setExternalHistory(extRes.data);
    } catch (e) {
      notify('Failed to load data — is the backend running?', 'error');
    }
  }, [month, notify]);

  useEffect(() => { loadData(); }, [loadData]);



  useEffect(() => {
    if (!settings.budget_locked) return;

    const { key, label, num } = getCurrentWeekInfo();
    const currentWeekData = weeks[key];
    const day = new Date().getDate();

    if (currentWeekData && currentWeekData.allocated === 0 && !currentWeekData.ended) {
      const promptKey = `xp_prompted_${month}_${key}`;
      if (!sessionStorage.getItem(promptKey)) {
        sessionStorage.setItem(promptKey, '1');
        setWeekAllocModal({ weekKey: key, label, isPrompt: true });
      }
    }

    const weekEnds = [7, 14, 21, 31];
    const currentEnd = weekEnds[num - 1];
    if (day === currentEnd) {
      const nextWeekKeys = ['week2', 'week3', 'week4'];
      const nextKey = nextWeekKeys[num - 1];
      const nextLabels = ['Week 2', 'Week 3', 'Week 4'];
      const nextLabel = nextLabels[num - 1];

      if (nextKey) {
        const warnKey = `xp_warned_${month}_${nextKey}`;
        if (!sessionStorage.getItem(warnKey)) {
          sessionStorage.setItem(warnKey, '1');
          notify(
            `${nextLabel} starts tomorrow — remember to set its budget!`,
            'warning'
          );
        }
      }
    }
  }, [settings.budget_locked, weeks, month]);


  useEffect(() => {
    const total = parseFloat(monthlyAllowance) || 0;
    const allocated = Object.values(weekAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    setRemainingToAllocate(Math.max(0, total - allocated));
  }, [monthlyAllowance, weekAllocations]);


  const handleUpdateBudget = async () => {
    const allowance = parseFloat(monthlyAllowance);
    if (!allowance || allowance <= 0) return notify('Enter a valid monthly allowance', 'error');

    const alloc = {};
    let totalAlloc = 0;
    for (const [k, v] of Object.entries(weekAllocations)) {
      const n = parseFloat(v) || 0;
      alloc[k] = n;
      totalAlloc += n;
    }

    if (totalAlloc > allowance) return notify('Total week allocations exceed monthly allowance', 'error');

    const leftover = parseFloat((allowance - totalAlloc).toFixed(2));

    try {
      await API.post('/budget/settings', {
        month_year: month,
        monthly_allowance: allowance,
        split_percentage: splitPct,
        week_allocations: alloc,
        leftover,
      });
      notify(leftover > 0 ? `Budget locked! Ksh ${fmt(leftover)} added to Savings` : 'Budget plan locked!', 'success');
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to update budget', 'error');
    }
  };


  const handleSaveWeekAllocation = async () => {
    const amount = parseFloat(weekAllocInput);
    if (!amount || amount <= 0) return notify('Enter a valid amount', 'error');
    if (!weekAllocModal) return;

    try {
      await API.post('/budget/week-allocation', {
        month_year: month,
        week_key: weekAllocModal.weekKey,
        allocated: amount,
      });
      notify(`${weekAllocModal.label} budget set to Ksh ${fmt(amount)}`, 'success');
      setWeekAllocModal(null);
      setWeekAllocInput('');
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to update week budget', 'error');
    }
  };


  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expCat || !expDesc || !expAmt || !expDate) return notify('Fill all fields', 'error');

    const weekNums = { fixed_week1: 1, week2: 2, week3: 3, week4: 4 };
    if (weekNums[expCat] !== undefined) {
      if (weekNums[expCat] > getCurrentWeekInfo().num) {
        return notify(`That week hasn't started yet — you can only log expenses for the current or past weeks`, 'error');
      }
      if (weeks[expCat]?.ended) {
        return notify(`${CAT_NAMES[expCat]} is already closed — no more expenses can be added`, 'error');
      }
    }
    try {
      await API.post('/expenses', {
        month_year: month, category: expCat,
        description: expDesc, amount: parseFloat(expAmt), expense_date: expDate,
      });
      setExpDesc(''); setExpAmt(''); setExpCat('');
      setExpDate(new Date().toISOString().split('T')[0]);
      notify('Expense added!', 'success');
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to add expense', 'error');
    }
  };


  const handleDeleteExpense = async () => {
    if (!deleteModal) return;
    try {
      await API.delete(`/expenses/${deleteModal.id}`);
      setDeleteModal(null);
      notify('Expense deleted', 'success');
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const handleEditBudget = (weekKey, label) => {
    const currentAlloc = weeks[weekKey]?.allocated || 0;
    setWeekAllocInput(currentAlloc > 0 ? String(currentAlloc) : '');
    setWeekAllocModal({ weekKey, label, isPrompt: false });
  };


  const handleEndWeek = (weekKey) => {
    if (weeks[weekKey]?.ended) return notify('Week already ended', 'warning');
    setEndWeekModal({ weekKey, data: weeks[weekKey] });
  };

  const confirmEndWeek = async () => {
    if (!endWeekModal) return;
    try {
      const r = await API.post('/budget/end-week', {
        month_year: month, week_key: endWeekModal.weekKey, split_percentage: endWeekSplitPct,
      });
      const diff = r.data.diff;
      if (diff > 0) notify(`Week ended! Ksh ${fmt(diff)} surplus split ${endWeekSplitPct}/${100 - endWeekSplitPct}`, 'success');
      else if (diff < 0) notify(`Week ended! Ksh ${fmt(Math.abs(diff))} deficit deducted`, 'warning');
      else notify('Week ended! Perfect budget.', 'info');
      setEndWeekModal(null);
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed to end week', 'error');
    }
  };


  const handleAddExtIncome = async () => {
    const amount = parseFloat(extAmt);
    if (!amount || amount <= 0) return notify('Enter a valid amount', 'error');
    try {
      await API.post('/income/external', {
        month_year: month, amount, description: extDesc || 'External Income', split_percentage: extSplitPct,
      });
      setExtAmt(''); setExtDesc(''); setExtIncomeOpen(false);
      notify(`Ksh ${fmt(amount)} added — split ${extSplitPct}/${100 - extSplitPct}`, 'success');
      loadData();
    } catch (e) {
      notify(e.response?.data?.error || 'Failed', 'error');
    }
  };


  const handleResetMonth = async () => {
    try {
      await API.post('/budget/reset-month', { month_year: month, new_month_year: month });
      setConfirmResetOpen(false);
      setMonthlyAllowance('');
      setWeekAllocations({ fixed_week1: '', week2: '', week3: '', week4: '' });
      notify('Month reset! Balances carried over.', 'success');
      loadData();
    } catch (e) {
      notify('Failed to reset', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      await API.delete(`/budget/clear-all?month=${month}`);
      setConfirmClearOpen(false);
      setMonthlyAllowance('');
      setWeekAllocations({ fixed_week1: '', week2: '', week3: '', week4: '' });
      notify('All data cleared!', 'success');
      loadData();
    } catch (e) {
      notify('Failed to clear', 'error');
    }
  };


  const totalNeedsAllocated = Object.values(weeks).reduce((s, w) => s + w.allocated, 0);
  const totalNeedsSpent = Object.values(weeks).reduce((s, w) => s + w.spent, 0);
  const totalExternal = externalHistory.reduce((s, e) => s + e.amount, 0);


  const barData = {
    labels: ['Fixed + Wk1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Allocated', data: [weeks.fixed_week1.allocated, weeks.week2.allocated, weeks.week3.allocated, weeks.week4.allocated],
        backgroundColor: 'rgba(232,255,0,.6)', borderColor: 'rgba(232,255,0,.9)', borderWidth: 1,
      },
      {
        label: 'Spent', data: [weeks.fixed_week1.spent, weeks.week2.spent, weeks.week3.spent, weeks.week4.spent],
        backgroundColor: 'rgba(255,77,77,.6)', borderColor: 'rgba(255,77,77,.9)', borderWidth: 1,
      }
    ]
  };

  const pieData = {
    labels: ['Needs Spent', 'Savings', 'Personal'],
    datasets: [{
      data: [totalNeedsSpent, accounts.savings?.balance || 0, accounts.personal?.balance || 0],
      backgroundColor: ['rgba(232,255,0,.7)', 'rgba(0,255,163,.7)', 'rgba(255,193,61,.7)'],
      borderColor: ['var(--accent)', 'var(--accent3)', 'var(--gold)'],
      borderWidth: 1,
    }]
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#888', font: { family: 'Space Mono', size: 11 } } } },
    scales: {
      x: { ticks: { color: '#666' }, grid: { color: 'rgba(255,255,255,.04)' } },
      y: { ticks: { color: '#666', callback: v => 'Ksh ' + fmt(v) }, grid: { color: 'rgba(255,255,255,.04)' } }
    }
  };

  const pieOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: '#888', font: { family: 'Space Mono', size: 11 }, padding: 16 } } }
  };


  const navTabs = [
    { key: 'input',  label: 'INPUT',  icon: <LayoutDashboard size={20} /> },
    { key: 'needs',  label: 'NEEDS',  icon: <ListChecks      size={20} /> },
    { key: 'income', label: 'INCOME', icon: <TrendingUp      size={20} /> },
  ];

  return (
    <>
      <Notifications notifs={notifs} />

      <nav className="xp-nav">
        <div className="xp-nav-brand">
          <XpensifyLogo size={24} showWordmark={true} />
        </div>

        <div className="xp-nav-tabs">
          {navTabs.map(t => (
            <button key={t.key} className={`xp-nav-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="xp-nav-user">
          <div className="xp-nav-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
          <span>{user?.username}</span>
          <button className="xp-nav-logout" onClick={logout}>
            <LogOut size={13} style={{ marginRight: '.35rem' }} />LOGOUT
          </button>
        </div>
      </nav>

      <div className="xp-mobile-bottom-nav">
        {navTabs.map(t => (
          <button
            key={t.key}
            className={`xp-mobile-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <button className="xp-mobile-tab logout-tab" onClick={logout}>
          <LogOut size={20} />
          <span>LOGOUT</span>
        </button>
      </div>

      <div className="xp-action-bar">
        <span className="xp-week-badge">
          <Calendar size={13} style={{marginRight:'.4rem'}} />
          {getCurrentWeek().toUpperCase()} — {getMonthLabel()}
        </span>
        <div className="xp-action-bar-row">
          <button className="btn btn-ghost" onClick={() => setExtIncomeOpen(true)}><PlusCircle size={14} /> EXTERNAL INCOME</button>
          <button className="btn btn-warn"  onClick={() => setConfirmResetOpen(true)}><RefreshCw size={14} /> RESET MONTH</button>
        </div>
        <div className="xp-action-bar-clear">
          <button className="btn btn-danger" onClick={() => setConfirmClearOpen(true)}><Trash2 size={14} /> CLEAR ALL</button>
        </div>
      </div>

      <main className="xp-main">

        {activeTab === 'input' && (
          <div>
            <div className="xp-section-header">
              <div className="xp-section-label"><LayoutDashboard size={12} style={{marginRight:'.4rem'}}/>// BUDGET CONTROL</div>
              <h1 className="xp-section-title">INPUT<br /><span className="accent">DASHBOARD</span></h1>
              <p className="xp-section-sub">Set your monthly budget and track expenses</p>
            </div>

            <div className="xp-grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="xp-card">
                <div className="xp-card-header">
                  <span className="xp-card-title"><Wallet size={14} style={{marginRight:'.5rem'}}/>MONTHLY SETUP</span>
                  {settings.budget_locked && <span className="xp-badge xp-badge-yellow"><Lock size={10} style={{marginRight:'.3rem'}}/>LOCKED</span>}
                </div>
                <div className="xp-card-body">
                  <div className="xp-form-group">
                    <label className="xp-label">Monthly Allowance</label>
                    <div className="xp-input-prefix">
                      <span className="xp-prefix-label">Ksh</span>
                      <input className="xp-input" type="number" value={monthlyAllowance}
                        onChange={e => setMonthlyAllowance(e.target.value)}
                        disabled={settings.budget_locked} placeholder="0" />
                    </div>
                  </div>

                  <div className="xp-split-control">
                    <div className="xp-split-title">SURPLUS / DEFICIT SPLIT</div>
                    <div className="xp-split-display">
                      <div className="xp-split-side">
                        <span className="xp-split-side-label">SAVINGS</span>
                        <span className="xp-split-side-val">{splitPct}%</span>
                      </div>
                      <div className="xp-split-side right">
                        <span className="xp-split-side-label">PERSONAL</span>
                        <span className="xp-split-side-val">{100 - splitPct}%</span>
                      </div>
                    </div>
                    <div className="xp-split-bar">
                      <div className="xp-split-bar-savings" style={{ width: `${splitPct}%` }} />
                      <div className="xp-split-bar-personal" />
                    </div>
                    <input type="range" className="xp-slider" min="0" max="100"
                      value={splitPct} onChange={e => setSplitPct(Number(e.target.value))}
                      disabled={settings.budget_locked} />
                    <p className="xp-helper" style={{ marginTop: '.5rem' }}>
                      Week surpluses, deficits, and external income use this split
                    </p>
                  </div>

                  <div style={{ marginBottom: '.5rem' }}>
                    <span className="xp-label" style={{ display: 'block', marginBottom: '.8rem' }}>WEEKLY BUDGET ALLOCATIONS</span>
                    {Object.entries(weekAllocations).map(([key, val]) => (
                      <div className="xp-form-group" key={key}>
                        <label className="xp-label">{CAT_NAMES[key]}</label>
                        <div className="xp-input-prefix">
                          <span className="xp-prefix-label">Ksh</span>
                          <input className="xp-input" type="number" value={val}
                            onChange={e => setWeekAllocations(prev => ({ ...prev, [key]: e.target.value }))}
                            disabled={settings.budget_locked} placeholder="0" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {remainingToAllocate > 0 && !settings.budget_locked && (
                    <div className="xp-alert info" style={{ marginBottom: '1rem' }}>
                      Ksh {fmt(remainingToAllocate)} unallocated → goes to Savings when locked
                    </div>
                  )}

                  <button className="btn btn-accent" style={{ width: '100%' }}
                    onClick={handleUpdateBudget} disabled={settings.budget_locked}>
                    {settings.budget_locked
                      ? <><ShieldCheck size={14} style={{marginRight:'.4rem'}}/>BUDGET LOCKED</>
                      : <><Lock size={14} style={{marginRight:'.4rem'}}/>LOCK BUDGET PLAN</>}
                  </button>
                </div>
              </div>

              <div className="xp-card">
                <div className="xp-card-header">
                  <span className="xp-card-title"><CreditCard size={14} style={{marginRight:'.5rem'}}/>ADD EXPENSE</span>
                </div>
                <div className="xp-card-body">
                  <form onSubmit={handleAddExpense}>
                    <div className="xp-form-group">
                      <label className="xp-label">Category</label>
                      <select className="xp-select" value={expCat} onChange={e => setExpCat(e.target.value)} required>
                        <option value="">SELECT CATEGORY</option>
                        <optgroup label="Needs">
                          {[
                            { value: 'fixed_week1', label: 'Fixed + Week 1', num: 1 },
                            { value: 'week2',       label: 'Week 2',         num: 2 },
                            { value: 'week3',       label: 'Week 3',         num: 3 },
                            { value: 'week4',       label: 'Week 4',         num: 4 },
                          ].map(w => {
                            const isFuture = w.num > getCurrentWeekInfo().num;
                            const isEnded  = weeks[w.value]?.ended;
                            return (
                              <option
                                key={w.value}
                                value={w.value}
                                disabled={isFuture || isEnded}
                              >
                                {w.label}{isFuture ? ' (not started)' : isEnded ? ' (ended)' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                        <optgroup label="Income">
                          <option value="personal">Personal Spending</option>
                          <option value="savings">Savings</option>
                        </optgroup>
                      </select>
                    </div>
                    <div className="xp-form-group">
                      <label className="xp-label">Description</label>
                      <input className="xp-input" type="text" value={expDesc}
                        onChange={e => setExpDesc(e.target.value)} placeholder="Lunch, Transport, ..." required />
                    </div>
                    <div className="xp-form-group">
                      <label className="xp-label">Amount</label>
                      <div className="xp-input-prefix">
                        <span className="xp-prefix-label">Ksh</span>
                        <input className="xp-input" type="number" value={expAmt}
                          onChange={e => setExpAmt(e.target.value)} placeholder="0" required />
                      </div>
                    </div>
                    <div className="xp-form-group">
                      <label className="xp-label">Date</label>
                      <input className="xp-input" type="date" value={expDate}
                        onChange={e => setExpDate(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-accent" style={{ width: '100%' }}>
                      <PlusCircle size={14} style={{marginRight:'.4rem'}}/>ADD EXPENSE
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="xp-card xp-col-span-2" style={{ marginBottom: '1.5rem' }}>
              <div className="xp-card-header"><span className="xp-card-title"><BarChart2 size={14} style={{marginRight:'.5rem'}}/>BUDGET SUMMARY</span></div>
              <div className="xp-card-body">
                <div className="xp-grid-2">
                  <div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key">Monthly Allowance</span>
                      <span className="xp-summary-val">Ksh {fmt(settings.monthly_allowance)}</span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key">Total Needs Allocated</span>
                      <span className="xp-summary-val">Ksh {fmt(totalNeedsAllocated)}</span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key">Total Needs Spent</span>
                      <span className="xp-summary-val text-red">Ksh {fmt(totalNeedsSpent)}</span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key" style={{ fontWeight: 600 }}>Needs Remaining</span>
                      <span className={`xp-summary-val ${totalNeedsAllocated - totalNeedsSpent < 0 ? 'text-red' : 'text-green'}`}>
                        Ksh {fmt(totalNeedsAllocated - totalNeedsSpent)}
                      </span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key">Split Ratio</span>
                      <span className="xp-summary-val mono">{splitPct}/{100 - splitPct}</span>
                    </div>
                  </div>
                  <div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key"><PiggyBank size={12} style={{marginRight:'.3rem'}}/>Savings Balance</span>
                      <span className="xp-summary-val text-green">Ksh {fmt(accounts.savings?.balance)}</span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key"><Gamepad2 size={12} style={{marginRight:'.3rem'}}/>Personal Balance</span>
                      <span className="xp-summary-val text-gold">Ksh {fmt(accounts.personal?.balance)}</span>
                    </div>
                    <div className="xp-summary-row">
                      <span className="xp-summary-key"><Banknote size={12} style={{marginRight:'.3rem'}}/>Total External Income</span>
                      <span className="xp-summary-val accent">Ksh {fmt(totalExternal)}</span>
                    </div>
                  </div>
                </div>

                {settings.budget_locked && (() => {
                  const weekDefs = [
                    { key: 'fixed_week1', label: 'Fixed + Week 1' },
                    { key: 'week2', label: 'Week 2' },
                    { key: 'week3', label: 'Week 3' },
                    { key: 'week4', label: 'Week 4' },
                  ];
                  const unallocated = weekDefs.filter(w => weeks[w.key]?.allocated === 0 && !weeks[w.key]?.ended);
                  if (unallocated.length === 0) return null;
                  return (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                      <span className="xp-label">WEEKS WITHOUT A BUDGET SET</span>
                      {unallocated.map(w => (
                        <div key={w.key} className="xp-alert warning" style={{ justifyContent: 'space-between' }}>
                          <span><AlertTriangle size={12} style={{marginRight:'.4rem'}}/>{w.label} has no budget yet</span>
                          <button className="btn btn-ghost"
                            style={{ fontSize: '.6rem', padding: '.25rem .7rem', marginLeft: '1rem' }}
                            onClick={() => { setWeekAllocInput(''); setWeekAllocModal({ weekKey: w.key, label: w.label, isPrompt: false }); }}>
                            <Edit3 size={10} style={{marginRight:'.3rem'}}/>SET NOW
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="xp-card">
              <div className="xp-card-header"><span className="xp-card-title"><Clock size={14} style={{marginRight:'.5rem'}}/>RECENT EXPENSES</span></div>
              <div className="xp-card-body">
                <div className="xp-table-wrap">
                  <table className="xp-table">
                    <thead>
                      <tr>
                        <th>DATE</th><th>CATEGORY</th><th>DESCRIPTION</th>
                        <th>AMOUNT</th><th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.slice(0, 12).map(e => (
                        <tr key={e.id}>
                          <td>{fmtDate(e.expense_date)}</td>
                          <td><span className="xp-badge xp-badge-dim">{CAT_NAMES[e.category] || e.category}</span></td>
                          <td>{e.description}</td>
                          <td className="text-red mono">Ksh {fmt(e.amount)}</td>
                          <td>
                            <button className="btn btn-danger" style={{ fontSize: '.58rem', padding: '.25rem .6rem' }}
                              onClick={() => setDeleteModal(e)}><Trash2 size={11} /></button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dimmer)', padding: '2rem' }}>NO EXPENSES YET</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'needs' && (
          <div>
            <div className="xp-section-header">
              <div className="xp-section-label"><ListChecks size={12} style={{marginRight:'.4rem'}}/>// WEEKLY TRACKING</div>
              <h1 className="xp-section-title">NEEDS <span className="accent">DASHBOARD</span></h1>
              <p className="xp-section-sub">Monitor weekly spending and close weeks</p>
            </div>

            <div className="xp-card" style={{ marginBottom: '1.5rem' }}>
              <div className="xp-card-header"><span className="xp-card-title"><BarChart2 size={14} style={{marginRight:'.5rem'}}/>WEEKLY OVERVIEW</span></div>
              <div className="xp-card-body">
                <div className="xp-chart-wrap">
                  <Bar data={barData} options={chartOpts} />
                </div>
              </div>
            </div>

            <div className="xp-grid-2">
              {[
                { key: 'fixed_week1', id: 'week1', title: 'FIXED + WEEK 1' },
                { key: 'week2', id: 'week2', title: 'WEEK 2' },
                { key: 'week3', id: 'week3', title: 'WEEK 3' },
                { key: 'week4', id: 'week4', title: 'WEEK 4' },
              ].map(w => (
                <WeekCard key={w.key} weekKey={w.key} weekId={w.id} title={w.title}
                  data={weeks[w.key]} splitPct={splitPct}
                  onEndWeek={handleEndWeek}
                  onEditBudget={handleEditBudget}
                  expenses={expenses} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'income' && (
          <div>
            <div className="xp-section-header">
              <div className="xp-section-label"><TrendingUp size={12} style={{marginRight:'.4rem'}}/>// MONEY FLOW</div>
              <h1 className="xp-section-title">INCOME <span className="accent">DASHBOARD</span></h1>
              <p className="xp-section-sub">Savings, personal spending, and money flow</p>
            </div>

            <div className="xp-grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="xp-card">
                <div className="xp-card-header"><span className="xp-card-title"><PieChart size={14} style={{marginRight:'.5rem'}}/>MONEY DISTRIBUTION</span></div>
                <div className="xp-card-body">
                  <div className="xp-chart-wrap" style={{ height: '280px' }}>
                    <Pie data={pieData} options={pieOpts} />
                  </div>
                </div>
              </div>

              <div className="xp-card">
                <div className="xp-card-header"><span className="xp-card-title"><ArrowRightLeft size={14} style={{marginRight:'.5rem'}}/>INCOME SUMMARY</span></div>
                <div className="xp-card-body">
                  <div className="xp-flow">
                    <div className="xp-flow-step">
                      <div className="xp-flow-icon"><DollarSign size={18} /></div>
                      <div className="xp-flow-content">
                        <div className="xp-flow-content-label">MONTHLY ALLOWANCE</div>
                        <div className="xp-flow-content-val">Ksh {fmt(settings.monthly_allowance)}</div>
                      </div>
                    </div>
                    <div className="xp-flow-arrow"><ChevronRight size={14} style={{transform:'rotate(90deg)'}}/></div>
                    <div className="xp-flow-step">
                      <div className="xp-flow-icon"><Wallet size={18} /></div>
                      <div className="xp-flow-content">
                        <div className="xp-flow-content-label">NEEDS BUDGET</div>
                        <div className="xp-flow-content-val">Ksh {fmt(totalNeedsAllocated)}</div>
                      </div>
                    </div>
                    <div className="xp-flow-arrow"><ChevronRight size={14} style={{transform:'rotate(90deg)'}}/></div>
                    <div className="xp-flow-step">
                      <div className="xp-flow-icon"><Zap size={18} /></div>
                      <div className="xp-flow-content">
                        <div className="xp-flow-content-label">EXTERNAL INCOME</div>
                        <div className="xp-flow-content-val accent">Ksh {fmt(totalExternal)}</div>
                      </div>
                    </div>
                    <div className="xp-flow-arrow"><ChevronRight size={14} style={{transform:'rotate(90deg)'}}/> split {splitPct}/{100 - splitPct}</div>
                    <div className="xp-flow-split-row">
                      <div className="xp-flow-step">
                        <div className="xp-flow-icon"><PiggyBank size={18} /></div>
                        <div className="xp-flow-content">
                          <div className="xp-flow-content-label">SAVINGS</div>
                          <div className="xp-flow-content-val text-green">Ksh {fmt(accounts.savings?.balance)}</div>
                        </div>
                      </div>
                      <div className="xp-flow-step">
                        <div className="xp-flow-icon"><Gamepad2 size={18} /></div>
                        <div className="xp-flow-content">
                          <div className="xp-flow-content-label">PERSONAL</div>
                          <div className="xp-flow-content-val text-gold">Ksh {fmt(accounts.personal?.balance)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xp-grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="xp-card">
                <div className="xp-card-header">
                  <span className="xp-card-title"><PiggyBank size={14} style={{marginRight:'.5rem'}}/>SAVINGS</span>
                  <span className="xp-summary-val text-green" style={{ fontSize: '1.1rem' }}>Ksh {fmt(accounts.savings?.balance)}</span>
                </div>
                <div className="xp-card-body">
                  <div className="xp-expense-list">
                    {expenses.filter(e => e.category === 'savings').length === 0
                      ? <span style={{ fontSize: '.78rem', color: 'var(--text-dimmer)', fontFamily: 'var(--font-mono)' }}>NO TRANSACTIONS</span>
                      : expenses.filter(e => e.category === 'savings').slice(-6).map(e => (
                        <div key={e.id} className="xp-expense-item">
                          <div className="xp-expense-desc">
                            <strong>{e.description}</strong>
                            <small>{fmtDate(e.expense_date)}</small>
                          </div>
                          <span className="xp-expense-amt">−Ksh {fmt(e.amount)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              <div className="xp-card">
                <div className="xp-card-header">
                  <span className="xp-card-title"><Gamepad2 size={14} style={{marginRight:'.5rem'}}/>PERSONAL</span>
                  <span className="xp-summary-val text-gold" style={{ fontSize: '1.1rem' }}>Ksh {fmt(accounts.personal?.balance)}</span>
                </div>
                <div className="xp-card-body">
                  <div className="xp-summary-row" style={{ marginBottom: '.5rem' }}>
                    <span className="xp-summary-key">Total Spent</span>
                    <span className="xp-summary-val text-red">Ksh {fmt(accounts.personal?.total_spent)}</span>
                  </div>
                  <div className="xp-expense-list">
                    {expenses.filter(e => e.category === 'personal').length === 0
                      ? <span style={{ fontSize: '.78rem', color: 'var(--text-dimmer)', fontFamily: 'var(--font-mono)' }}>NO TRANSACTIONS</span>
                      : expenses.filter(e => e.category === 'personal').slice(-6).map(e => (
                        <div key={e.id} className="xp-expense-item">
                          <div className="xp-expense-desc">
                            <strong>{e.description}</strong>
                            <small>{fmtDate(e.expense_date)}</small>
                          </div>
                          <span className="xp-expense-amt">−Ksh {fmt(e.amount)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="xp-card">
              <div className="xp-card-header"><span className="xp-card-title"><ArrowRightLeft size={14} style={{marginRight:'.5rem'}}/>ALL TRANSACTIONS</span></div>
              <div className="xp-card-body">
                <div className="xp-table-wrap">
                  <table className="xp-table">
                    <thead>
                      <tr><th>DATE</th><th>CATEGORY</th><th>DESCRIPTION</th><th>AMOUNT</th></tr>
                    </thead>
                    <tbody>
                      {expenses.filter(e => ['savings', 'personal'].includes(e.category)).map(e => (
                        <tr key={e.id}>
                          <td>{fmtDate(e.expense_date)}</td>
                          <td><span className={`xp-badge ${e.category === 'savings' ? 'xp-badge-green' : 'xp-badge-yellow'}`}>{CAT_NAMES[e.category]}</span></td>
                          <td>{e.description}</td>
                          <td className="text-red mono">−Ksh {fmt(e.amount)}</td>
                        </tr>
                      ))}
                      {externalHistory.map(e => (
                        <tr key={`ext-${e.id}`}>
                          <td>{fmtDate(e.income_date)}</td>
                          <td><span className="xp-badge xp-badge-accent">EXTERNAL</span></td>
                          <td>{e.description}</td>
                          <td className="text-green mono">+Ksh {fmt(e.amount)}</td>
                        </tr>
                      ))}
                      {expenses.filter(e => ['savings', 'personal'].includes(e.category)).length === 0 &&
                        externalHistory.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dimmer)', padding: '2rem' }}>NO INCOME TRANSACTIONS</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="xp-footer">
        <p className="xp-footer-text">Developed by <strong style={{ color: 'var(--accent)' }}>Emmanuel Waseth</strong></p>
        <div className="xp-footer-links">
          <a href="https://github.com/Waseth" target="_blank" rel="noreferrer" className="xp-footer-link">GitHub</a>
          <a href="https://instagram.com/waseth.dev" target="_blank" rel="noreferrer" className="xp-footer-link">Instagram</a>
          <a href="mailto:wasethsapriso@gmail.com" className="xp-footer-link">Email</a>
        </div>
      </footer>


      <Modal open={extIncomeOpen} onClose={() => setExtIncomeOpen(false)}
        title="EXTERNAL INCOME" sub="Add income from outside your monthly allowance"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setExtIncomeOpen(false)}><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</button>
          <button className="btn btn-accent" onClick={handleAddExtIncome}>
            <PlusCircle size={13} style={{marginRight:'.3rem'}}/>ADD INCOME
          </button>
        </>}>
        <div className="xp-form-group">
          <label className="xp-label">Amount</label>
          <div className="xp-input-prefix">
            <span className="xp-prefix-label">Ksh</span>
            <input className="xp-input" type="number" value={extAmt}
              onChange={e => setExtAmt(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="xp-form-group">
          <label className="xp-label">Description (optional)</label>
          <input className="xp-input" type="text" value={extDesc}
            onChange={e => setExtDesc(e.target.value)} placeholder="Bonus, Gift, Side hustle..." />
        </div>

        <SplitSlider
          pct={extSplitPct}
          onChange={setExtSplitPct}
          amount={parseFloat(extAmt) || 0}
          label="HOW TO SPLIT THIS INCOME"
        />
      </Modal>

      {endWeekModal && (() => {
        const d = endWeekModal.data;
        const surplus = parseFloat((d.allocated - d.spent).toFixed(2));
        const absSurplus = Math.abs(surplus);
        const isSurplus = surplus > 0;
        const isDeficit = surplus < 0;
        const savingsChange = parseFloat((absSurplus * endWeekSplitPct / 100).toFixed(2));
        const personalChange = parseFloat((absSurplus * (100 - endWeekSplitPct) / 100).toFixed(2));

        return (
          <Modal open={!!endWeekModal} onClose={() => setEndWeekModal(null)}
            title={`END ${CAT_NAMES[endWeekModal.weekKey]?.toUpperCase()}`}
            actions={<>
              <button className="btn btn-ghost" onClick={() => setEndWeekModal(null)}><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</button>
              <button className="btn btn-accent" onClick={confirmEndWeek}><CheckCircle2 size={13} style={{marginRight:'.3rem'}}/>CONFIRM</button>
            </>}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
              <div className="xp-summary-row">
                <span className="xp-summary-key">Allocated</span>
                <span className="xp-summary-val mono">Ksh {fmt(d.allocated)}</span>
              </div>
              <div className="xp-summary-row">
                <span className="xp-summary-key">Spent</span>
                <span className="xp-summary-val text-red mono">Ksh {fmt(d.spent)}</span>
              </div>
              <div className="xp-summary-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '.6rem', marginTop: '.2rem' }}>
                <span className="xp-summary-key" style={{ fontWeight: 700, color: isSurplus ? 'var(--accent3)' : isDeficit ? 'var(--accent2)' : 'var(--text)' }}>
                  {isSurplus ? <><ArrowUpRight size={13} style={{marginRight:'.3rem'}}/>SURPLUS</> : isDeficit ? <><ArrowDownRight size={13} style={{marginRight:'.3rem'}}/>DEFICIT</> : <><Minus size={13} style={{marginRight:'.3rem'}}/>PERFECT</>}
                </span>
                <span className={`xp-summary-val mono ${isSurplus ? 'text-green' : isDeficit ? 'text-red' : ''}`}>
                  Ksh {fmt(absSurplus)}
                </span>
              </div>
            </div>

            {surplus !== 0 && (
              <SplitSlider
                pct={endWeekSplitPct}
                onChange={setEndWeekSplitPct}
                amount={absSurplus}
                label={isSurplus ? 'HOW TO SPLIT THIS SURPLUS' : 'HOW TO SPLIT THIS DEFICIT'}
              />
            )}

            {isSurplus && (
              <div className="xp-info-box" style={{ marginTop: '1rem' }}>
                ✓ Savings will receive <strong style={{ color: 'var(--accent3)' }}>+Ksh {fmt(savingsChange)}</strong> and Personal will receive <strong style={{ color: 'var(--gold)' }}>+Ksh {fmt(personalChange)}</strong>
              </div>
            )}
            {isDeficit && (
              <div className="xp-warning-box" style={{ marginTop: '1rem' }}>
                ⚠ Ksh {fmt(personalChange)} deducted from Personal first, then Ksh {fmt(savingsChange)} from Savings if needed
              </div>
            )}
            {surplus === 0 && (
              <div className="xp-info-box" style={{ marginTop: '1rem' }}>
                ✓ Perfect spend — no adjustments needed
              </div>
            )}

            <div className="xp-warning-box" style={{ marginTop: '.6rem' }}>
              ⚠ Once closed, no more expenses can be added to this week
            </div>
          </Modal>
        );
      })()}

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title="DELETE EXPENSE" sub="This cannot be undone."
        actions={<>
          <button className="btn btn-ghost" onClick={() => setDeleteModal(null)}><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</button>
          <button className="btn btn-danger" onClick={handleDeleteExpense}><Trash2 size={13} style={{marginRight:'.3rem'}}/>DELETE</button>
        </>}>
        {deleteModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
            <div className="xp-summary-row">
              <span className="xp-summary-key">Description</span>
              <span className="xp-summary-val">{deleteModal.description}</span>
            </div>
            <div className="xp-summary-row">
              <span className="xp-summary-key">Amount</span>
              <span className="xp-summary-val text-red">Ksh {fmt(deleteModal.amount)}</span>
            </div>
            <div className="xp-summary-row">
              <span className="xp-summary-key">Category</span>
              <span className="xp-summary-val">{CAT_NAMES[deleteModal.category]}</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)}
        title="CLEAR ALL DATA" sub="This will permanently delete all expenses, budgets, and balances for this month."
        actions={<>
          <button className="btn btn-ghost" onClick={() => setConfirmClearOpen(false)}><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</button>
          <button className="btn btn-danger" onClick={handleClearAll}><Trash2 size={13} style={{marginRight:'.3rem'}}/>CLEAR EVERYTHING</button>
        </>}>
        <div className="xp-warning-box">
          <AlertTriangle size={13} style={{marginRight:'.5rem',flexShrink:0}}/> All data will be permanently lost. This action cannot be undone.
        </div>
      </Modal>

      <Modal open={confirmResetOpen} onClose={() => setConfirmResetOpen(false)}
        title="RESET MONTH" sub="Clears all expenses and budgets. Savings and Personal balances are carried over."
        actions={<>
          <button className="btn btn-ghost" onClick={() => setConfirmResetOpen(false)}><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</button>
          <button className="btn btn-warn" onClick={handleResetMonth}><RefreshCw size={13} style={{marginRight:'.3rem'}}/>RESET MONTH</button>
        </>}>
        <div className="xp-info-box">
          <PiggyBank size={13} style={{marginRight:'.5rem',flexShrink:0}}/> Savings: Ksh {fmt(accounts.savings?.balance)} carried forward<br />
          <Gamepad2 size={13} style={{marginRight:'.5rem',flexShrink:0,marginTop:'.4rem'}}/> Personal: Ksh {fmt(accounts.personal?.balance)} carried forward
        </div>
      </Modal>


      <Modal
        open={!!weekAllocModal}
        onClose={() => { setWeekAllocModal(null); setWeekAllocInput(''); }}
        title={weekAllocModal?.isPrompt ? `${weekAllocModal?.label?.toUpperCase()} HAS STARTED` : `SET BUDGET — ${weekAllocModal?.label?.toUpperCase()}`}
        sub={weekAllocModal?.isPrompt
          ? `A new week has begun but it has no budget yet. Set an amount to start tracking.`
          : `Update the allocated budget for this week. You can change this anytime before ending the week.`
        }
        actions={<>
          <button className="btn btn-ghost" onClick={() => { setWeekAllocModal(null); setWeekAllocInput(''); }}>
            {weekAllocModal?.isPrompt ? <><X size={13} style={{marginRight:'.3rem'}}/>SKIP FOR NOW</> : <><X size={13} style={{marginRight:'.3rem'}}/>CANCEL</>}
          </button>
          <button className="btn btn-accent" onClick={handleSaveWeekAllocation}>
            {weeks[weekAllocModal?.weekKey]?.allocated > 0
              ? <><Edit3 size={13} style={{marginRight:'.3rem'}}/>UPDATE BUDGET</>
              : <><CheckCircle2 size={13} style={{marginRight:'.3rem'}}/>SET BUDGET</>}
          </button>
        </>}
      >
        {weekAllocModal && (
          <>

            {weeks[weekAllocModal.weekKey]?.allocated > 0 && (
              <div className="xp-summary-row" style={{ marginBottom: '.8rem' }}>
                <span className="xp-summary-key">Current Allocation</span>
                <span className="xp-summary-val mono">Ksh {fmt(weeks[weekAllocModal.weekKey].allocated)}</span>
              </div>
            )}
            {weeks[weekAllocModal.weekKey]?.spent > 0 && (
              <div className="xp-summary-row" style={{ marginBottom: '.8rem' }}>
                <span className="xp-summary-key">Already Spent</span>
                <span className="xp-summary-val text-red mono">Ksh {fmt(weeks[weekAllocModal.weekKey].spent)}</span>
              </div>
            )}

            <div className="xp-form-group">
              <label className="xp-label">Budget Amount for {weekAllocModal.label}</label>
              <div className="xp-input-prefix">
                <span className="xp-prefix-label">Ksh</span>
                <input
                  className="xp-input"
                  type="number"
                  value={weekAllocInput}
                  onChange={e => setWeekAllocInput(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            {weekAllocInput && parseFloat(weekAllocInput) > 0 && (
              <div className="xp-week-alloc-preview">
                <div className="xp-week-alloc-row">
                  <span>Budget</span>
                  <span className="accent mono">Ksh {fmt(parseFloat(weekAllocInput))}</span>
                </div>
                <div className="xp-week-alloc-row">
                  <span>Already spent</span>
                  <span className="text-red mono">Ksh {fmt(weeks[weekAllocModal.weekKey]?.spent || 0)}</span>
                </div>
                <div className="xp-week-alloc-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '.5rem', marginTop: '.2rem' }}>
                  <span style={{ fontWeight: 600 }}>Remaining</span>
                  <span className={`mono ${parseFloat(weekAllocInput) - (weeks[weekAllocModal.weekKey]?.spent || 0) >= 0 ? 'text-green' : 'text-red'}`} style={{ fontWeight: 700 }}>
                    Ksh {fmt(parseFloat(weekAllocInput) - (weeks[weekAllocModal.weekKey]?.spent || 0))}
                  </span>
                </div>
              </div>
            )}

            {weekAllocModal.isPrompt && (
              <div className="xp-info-box" style={{ marginTop: '1rem' }}>
                ● You can update this amount anytime from the Needs Dashboard before ending the week
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}