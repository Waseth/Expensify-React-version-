import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import XpensifyLogo from '../components/XpensifyLogo';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [sliding, setSliding] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const switchMode = (newMode) => {
    if (newMode === mode || sliding) return;
    setSliding(true);
    setTimeout(() => {
      setMode(newMode);
      setSliding(false);
      setLoginError('');
      setRegError('');
    }, 400);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/app');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }
    setRegLoading(true);
    try {
      await register(regUsername, regEmail, regPassword);
      navigate('/app');
    } catch (err) {
      setRegError(err.response?.data?.error || 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-bg-grid" />
      <div className="auth-noise" />

      <div className="auth-container">
        {/* ── BRAND ── */}
        <div className="auth-brand">
          <XpensifyLogo size={32} showWordmark={true} />
        </div>

        {/* ── PANEL ── */}
        <div className={`auth-panel ${sliding ? 'sliding' : ''}`}>
          {/* ── TABS ── */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >LOGIN</button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >SIGN UP</button>
            <div className={`auth-tab-indicator ${mode === 'signup' ? 'right' : 'left'}`} />
          </div>

          {/* ── FORMS WRAPPER ── */}
          <div className={`auth-forms-track ${mode === 'signup' ? 'show-signup' : 'show-login'}`}>
            {/* LOGIN */}
            <form className="auth-form" onSubmit={handleLogin} autoComplete="off">
              <div className="auth-form-header">
                <h2 className="auth-form-title">WELCOME BACK</h2>
                <p className="auth-form-sub">Track your expenses with precision</p>
              </div>

              {loginError && <div className="auth-error"><AlertCircle size={14} /> {loginError}</div>}

              <div className="auth-field">
                <label className="auth-label">EMAIL</label>
                <div className="auth-input-wrap">
                  <Mail size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">PASSWORD</label>
                <div className="auth-input-wrap">
                  <Lock size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit" disabled={loginLoading}>
                {loginLoading ? <span className="auth-spinner" /> : <><ArrowRight size={15} style={{marginRight:'.4rem'}}/>LOGIN</>}
              </button>

              <p className="auth-switch-text">
                No account?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('signup')}>
                  Create one
                </button>
              </p>
            </form>

            {/* SIGNUP */}
            <form className="auth-form" onSubmit={handleRegister} autoComplete="off">
              <div className="auth-form-header">
                <h2 className="auth-form-title">CREATE ACCOUNT</h2>
                <p className="auth-form-sub">Start budgeting smarter today</p>
              </div>

              {regError && <div className="auth-error"><AlertCircle size={14} /> {regError}</div>}

              <div className="auth-field">
                <label className="auth-label">USERNAME</label>
                <div className="auth-input-wrap">
                  <User size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="text"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="yourname"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">EMAIL</label>
                <div className="auth-input-wrap">
                  <Mail size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">PASSWORD</label>
                <div className="auth-input-wrap">
                  <Lock size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">CONFIRM PASSWORD</label>
                <div className="auth-input-wrap">
                  <Lock size={15} className="auth-input-icon" />
                  <input
                    className="auth-input"
                    type="password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit" disabled={regLoading}>
                {regLoading ? <span className="auth-spinner" /> : <><ArrowRight size={15} style={{marginRight:'.4rem'}}/>CREATE ACCOUNT</>}
              </button>

              <p className="auth-switch-text">
                Already have an account?{' '}
                <button type="button" className="auth-switch-link" onClick={() => switchMode('login')}>
                  Log in
                </button>
              </p>
            </form>
          </div>
        </div>

        <p className="auth-footer-text">
          Developed by <strong>Emmanuel Waseth</strong>
        </p>
      </div>
    </div>
  );
}