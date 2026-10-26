import React from 'react';
import {
  DashboardIcon,
  NotesIcon,
  JournalIcon,
  GraphIcon,
  TagIcon,
  SettingsIcon,
  PlusIcon,
  CloseIcon
} from './Icons';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ currentTab, setTab, onNewNote, isOpen, onClose }) {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'notes', label: 'All Notes', icon: NotesIcon },
    { id: 'journal', label: 'Daily Journal', icon: JournalIcon },
    { id: 'graph', label: 'Knowledge Graph', icon: GraphIcon },
    { id: 'tags', label: 'Tags', icon: TagIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  const handleNav = (id) => {
    setTab(id);
    if (onClose) onClose();
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} id="main-sidebar">
      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: 'var(--color-primary-soft)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>Multi Vault</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Obsidian Edition</div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
          id="close-sidebar-btn"
          aria-label="Close navigation"
          style={{ display: 'none', padding: 4 }}
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Quick Action: New Note */}
      <button
        id="sidebar-new-note-btn"
        className="btn btn-primary"
        onClick={() => {
          onNewNote();
          if (onClose) onClose();
        }}
        style={{ width: '100%', marginBottom: 20 }}
      >
        <PlusIcon size={16} />
        <span>New Note</span>
      </button>

      {/* Navigation List */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }} aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              <Icon size={18} color={isActive ? 'var(--color-primary-hover)' : 'currentColor'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User profile footer */}
      {user && (
        <div style={{
          marginTop: 'auto',
          paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-primary-hover)'
          }}>
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
