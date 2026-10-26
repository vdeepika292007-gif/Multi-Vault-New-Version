import React from 'react';
import { MenuIcon, SearchIcon, PlusIcon } from './Icons';

export function Header({ title, onOpenSidebar, onNewNote, searchQuery, setSearchQuery, onSearchSubmit }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <header className="app-header" id="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          id="mobile-menu-toggle"
          className="btn btn-ghost btn-sm"
          onClick={onOpenSidebar}
          aria-label="Toggle navigation menu"
          style={{ padding: 6 }}
        >
          <MenuIcon size={20} />
        </button>
        <h1 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>{title}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Global Search Bar */}
        <div style={{ position: 'relative', width: 260 }}>
          <SearchIcon
            size={16}
            color="var(--color-text-muted)"
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          />
          <input
            id="global-search-input"
            type="text"
            className="input-text"
            placeholder="Search vault..."
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              paddingLeft: 34,
              paddingRight: 12,
              height: 36,
              fontSize: 13,
              backgroundColor: 'var(--color-surface-raised)'
            }}
          />
        </div>

        {/* Quick New Note Button */}
        <button
          id="header-new-note-btn"
          className="btn btn-primary btn-sm"
          onClick={onNewNote}
        >
          <PlusIcon size={14} />
          <span style={{ display: 'inline-block' }}>New Note</span>
        </button>
      </div>
    </header>
  );
}
