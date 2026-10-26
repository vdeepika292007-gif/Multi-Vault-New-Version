import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Please enter your name');
        }
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail('vaultkeeper@multivault.app');
    setPassword('vaultPass2026!');
    if (isRegister) {
      setName('Vault Keeper');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-bg)',
      padding: 20
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        {/* Wordmark Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: 'var(--color-primary-soft)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
            marginBottom: 12
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>Multi Vault</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Personal Knowledge Workspace & Daily Journal
          </p>
        </div>

        {/* Tab switch */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--color-surface-raised)',
          borderRadius: 8,
          padding: 4,
          marginBottom: 24,
          border: '1px solid var(--color-border)'
        }}>
          <button
            id="auth-tab-signin"
            type="button"
            className={`btn btn-sm ${!isRegister ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, height: 34 }}
            onClick={() => { setIsRegister(false); setErrorMsg(''); }}
          >
            Sign In
          </button>
          <button
            id="auth-tab-register"
            type="button"
            className={`btn btn-sm ${isRegister ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, height: 34 }}
            onClick={() => { setIsRegister(true); setErrorMsg(''); }}
          >
            Create Account
          </button>
        </div>

        {errorMsg && (
          <div className="alert alert-error" id="auth-error-alert" role="alert">
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="auth-form">
          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name-input">Full Name</label>
              <input
                id="auth-name-input"
                type="text"
                className="input-text"
                placeholder="e.g. Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isRegister}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email-input">Email Address</label>
            <input
              id="auth-email-input"
              type="email"
              className="input-text"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password-input">Password</label>
            <input
              id="auth-password-input"
              type="password"
              className="input-text"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isRegister ? 'Create Vault Account' : 'Sign In to Vault')}
          </button>
        </form>

        {/* Demo filler helper */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            id="auth-demo-btn"
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleDemoFill}
            style={{ fontSize: 12, color: 'var(--color-primary-hover)' }}
          >
            Fill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
