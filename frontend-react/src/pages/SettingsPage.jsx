import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const { user, logout, updatePreferences } = useAuth();
  const [theme, setTheme] = useState(user?.preferences?.theme || 'obsidian');
  const [defaultSort, setDefaultSort] = useState(user?.preferences?.defaultSort || 'updatedAt_desc');
  const [graphShowSharedTags, setGraphShowSharedTags] = useState(
    user?.preferences?.graphShowSharedTags ?? true
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [showSignoutModal, setShowSignoutModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getSettings();
        if (res.settings) {
          setTheme(res.settings.theme || 'obsidian');
          setDefaultSort(res.settings.defaultSort || 'updatedAt_desc');
          setGraphShowSharedTags(res.settings.graphShowSharedTags ?? true);
        }
      } catch (err) {
        console.warn('Could not load settings:', err);
      }
    }
    load();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await api.updateSettings({
        theme,
        defaultSort,
        graphShowSharedTags
      });
      updatePreferences(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutConfirm = async () => {
    setShowSignoutModal(false);
    await logout();
  };

  return (
    <div id="settings-page" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Workspace Settings</h2>
        <p style={{ fontSize: 14 }}>
          Manage your personal interface preferences and account security. Only working settings are displayed.
        </p>
      </div>

      {saveSuccess && (
        <div className="alert alert-success" id="settings-success-alert" role="alert">
          <span>✓ Settings saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <span>Error saving settings: {error}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings}>
        {/* Appearance & Themes */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            Appearance & Workspace Style
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-theme-select">Theme Variant</label>
            <select
              id="settings-theme-select"
              className="select-input"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                document.body.setAttribute('data-theme', e.target.value);
              }}
            >
              <option value="obsidian">Obsidian Vault (Deep Charcoal & Violet Accent)</option>
              <option value="dark">Classic Minimalist Dark</option>
              <option value="violet">Violet Night</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Tailored high-contrast dark surfaces designed for focused writing.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="settings-sort-select">Default Note Sorting</label>
            <select
              id="settings-sort-select"
              className="select-input"
              value={defaultSort}
              onChange={(e) => setDefaultSort(e.target.value)}
            >
              <option value="updatedAt_desc">Recently Modified First</option>
              <option value="updatedAt_asc">Oldest Modified First</option>
              <option value="title_asc">Title Alphabetical (A to Z)</option>
              <option value="title_desc">Title Alphabetical (Z to A)</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                id="settings-graph-shared-tags"
                type="checkbox"
                checked={graphShowSharedTags}
                onChange={(e) => setGraphShowSharedTags(e.target.checked)}
              />
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                Display shared tag relationships in Knowledge Graph by default
              </span>
            </label>
          </div>

          <button
            id="settings-save-btn"
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ alignSelf: 'flex-start' }}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* User Account Info */}
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            Account Profile
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 14 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Full Name:</span>
            <strong>{user?.name}</strong>

            <span style={{ color: 'var(--color-text-muted)' }}>Email:</span>
            <strong>{user?.email}</strong>

            <span style={{ color: 'var(--color-text-muted)' }}>User ID:</span>
            <code style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{user?.id || user?._id}</code>
          </div>
        </div>

        {/* Session & Sign Out */}
        <div className="card" style={{ borderColor: 'rgba(248, 113, 113, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h4 style={{ fontSize: 15, color: 'var(--color-text)', marginBottom: 2 }}>Session Security</h4>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--color-text-muted)' }}>
              Sign out from your active session on this device.
            </p>
          </div>

          <button
            id="settings-signout-btn"
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setShowSignoutModal(true)}
          >
            Sign Out
          </button>
        </div>
      </form>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignoutModal}
        title="Sign Out"
        message="Are you sure you want to sign out from your Multi Vault workspace?"
        confirmText="Sign Out"
        isDanger={true}
        onConfirm={handleSignOutConfirm}
        onCancel={() => setShowSignoutModal(false)}
      />
    </div>
  );
}
