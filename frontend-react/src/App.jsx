import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotesPage } from './pages/NotesPage';
import { NoteEditorPage } from './pages/NoteEditorPage';
import { JournalPage } from './pages/JournalPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { TagsPage } from './pages/TagsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

export function App() {
  const { isAuthenticated, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [editorOrigin, setEditorOrigin] = useState('notes');
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeTagFilter, setActiveTagFilter] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toast, setToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ id: Date.now(), message, type });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-secondary)',
        fontSize: 16
      }}>
        Initializing Multi Vault workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const handleNewNote = (origin) => {
    const originTab = origin || (currentTab === 'note-editor' ? 'notes' : currentTab);
    setEditorOrigin(originTab);
    setActiveNoteId('new');
    setCurrentTab('note-editor');
  };

  const handleOpenNote = (id, origin) => {
    const originTab = origin || (currentTab === 'note-editor' ? 'notes' : currentTab);
    setEditorOrigin(originTab);
    setActiveNoteId(id);
    setCurrentTab('note-editor');
  };

  const handleNoteSaved = ({ message = 'Note saved successfully.' }) => {
    setActiveNoteId(null);
    setCurrentTab('dashboard');
    showToast(message, 'success');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleNoteEditorBack = () => {
    setActiveNoteId(null);
    setCurrentTab('dashboard');
  };

  const handleJournalSaved = ({ message = 'Journal entry saved successfully.' }) => {
    showToast(message, 'success');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleJournalExit = () => {
    setCurrentTab('dashboard');
  };

  const handleSelectTag = (tag) => {
    setActiveTagFilter(tag);
    setCurrentTab('notes');
  };

  const handleGlobalSearchSubmit = () => {
    setCurrentTab('notes');
  };

  const pageTitles = {
    dashboard: 'Workspace Dashboard',
    notes: 'All Notes',
    'note-editor': activeNoteId === 'new' ? 'New Note' : 'Edit Note',
    journal: 'Daily Journal',
    graph: 'Knowledge Graph',
    tags: 'Tags Overview',
    settings: 'Settings'
  };

  return (
    <div className="app-container" id="app-root-container">
      {/* Global Toast Notification */}
      {toast && (
        <div className="toast-container" id="toast-container" aria-live="polite">
          <div className={`toast toast-${toast.type}`} id="app-toast-alert" role="status">
            <span className="toast-icon" style={{ fontWeight: 700, fontSize: 16 }}>
              {toast.type === 'success' ? '✓' : '⚠'}
            </span>
            <span>{toast.message}</span>
            <button
              className="toast-close-btn"
              onClick={() => setToast(null)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'notes') {
            setActiveTagFilter('');
          }
        }}
        onNewNote={() => handleNewNote(currentTab)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <Header
          title={pageTitles[currentTab] || 'Multi Vault'}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onNewNote={() => handleNewNote(currentTab)}
          searchQuery={globalSearch}
          setSearchQuery={setGlobalSearch}
          onSearchSubmit={handleGlobalSearchSubmit}
        />

        <main className="page-content" id="page-content-wrapper">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNewNote={(orig) => handleNewNote(orig || 'dashboard')}
              onOpenNote={(id, orig) => handleOpenNote(id, orig || 'dashboard')}
              onOpenJournal={() => setCurrentTab('journal')}
              onOpenGraph={() => setCurrentTab('graph')}
              onOpenNotes={() => { setActiveTagFilter(''); setCurrentTab('notes'); }}
              onOpenTags={() => setCurrentTab('tags')}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'notes' && (
            <NotesPage
              onNewNote={(orig) => handleNewNote(orig || 'notes')}
              onOpenNote={(id, orig) => handleOpenNote(id, orig || 'notes')}
              onNoteDeleted={() => {
                setRefreshTrigger(prev => prev + 1);
                showToast('Note deleted successfully', 'success');
              }}
              initialTag={activeTagFilter}
              initialSearch={globalSearch}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'note-editor' && (
            <NoteEditorPage
              noteId={activeNoteId}
              onBack={handleNoteEditorBack}
              onNoteSaved={handleNoteSaved}
            />
          )}

          {currentTab === 'journal' && (
            <JournalPage
              onJournalSaved={handleJournalSaved}
              onExit={handleJournalExit}
            />
          )}

          {currentTab === 'graph' && (
            <KnowledgeGraphPage
              onOpenNote={(id) => handleOpenNote(id, 'graph')}
              onNewNote={() => handleNewNote('graph')}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'tags' && (
            <TagsPage
              onSelectTag={handleSelectTag}
              onNewNote={() => handleNewNote('tags')}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage />
          )}

          {/* Fallback to Dashboard to guarantee no blank screen is ever displayed */}
          {!['dashboard', 'notes', 'note-editor', 'journal', 'graph', 'tags', 'settings'].includes(currentTab) && (
            <DashboardPage
              onNewNote={(orig) => handleNewNote(orig || 'dashboard')}
              onOpenNote={(id, orig) => handleOpenNote(id, orig || 'dashboard')}
              onOpenJournal={() => setCurrentTab('journal')}
              onOpenGraph={() => setCurrentTab('graph')}
              onOpenNotes={() => { setActiveTagFilter(''); setCurrentTab('notes'); }}
              onOpenTags={() => setCurrentTab('tags')}
              refreshTrigger={refreshTrigger}
            />
          )}
        </main>
      </div>
    </div>
  );
}
