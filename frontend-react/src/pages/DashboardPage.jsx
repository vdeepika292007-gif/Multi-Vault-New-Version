import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NotesIcon, TagIcon, JournalIcon, GraphIcon, PlusIcon } from '../components/Icons';

export function DashboardPage({ onNewNote, onOpenNote, onOpenJournal, onOpenGraph, onOpenNotes, onOpenTags, refreshTrigger = 0 }) {
  const [metrics, setMetrics] = useState({
    noteCount: 0,
    tagCount: 0,
    journalCount: 0,
    hasTodayJournal: false,
    recentNotes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDashboard();
      if (data) {
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Direct getDashboard failed, falling back to authoritative notes/tags/journal APIs:', err);
      try {
        const [notesRes, tagsRes, journalRes] = await Promise.all([
          api.getNotes(),
          api.getTags(),
          api.getJournalHistory().catch(() => ({ history: [] }))
        ]);
        const notes = notesRes.notes || [];
        const tags = tagsRes.tags || [];
        const journal = journalRes.history || [];
        const todayStr = new Date().toISOString().slice(0, 10);
        const hasToday = journal.some(j => j.entryDate === todayStr);

        setMetrics({
          noteCount: notes.length,
          tagCount: tags.length,
          journalCount: journal.length,
          hasTodayJournal: hasToday,
          recentNotes: notes.slice(0, 5).map(n => ({
            _id: n._id || n.id,
            title: n.title,
            tags: n.tags || [],
            updatedAt: n.updatedAt,
            contentSnippet: (n.content || '').slice(0, 120)
          }))
        });
        setError(null);
      } catch (fallbackErr) {
        console.error('All dashboard data fetching failed:', fallbackErr);
        setError(fallbackErr.message || err.message || 'Failed to load dashboard data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [refreshTrigger]);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div id="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Real Error State Banner */}
      {error && (
        <div
          id="dashboard-error-banner"
          className="alert alert-error"
          role="alert"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.4)',
            color: 'var(--color-danger)'
          }}
        >
          <span>⚠ {error}</span>
          <button
            id="dash-retry-btn"
            className="btn btn-secondary btn-sm"
            onClick={fetchDashboard}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(33, 29, 44, 0.9) 0%, rgba(18, 16, 25, 0.9) 100%)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Welcome to your Personal Vault</h2>
          <p style={{ fontSize: 14 }}>Today is <strong style={{ color: 'var(--color-text)' }}>{todayStr}</strong>. Keep your thoughts, knowledge, and daily reflections connected.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="dash-new-note-btn" className="btn btn-primary" onClick={() => onNewNote('dashboard')}>
            <PlusIcon size={16} />
            <span>Create Note</span>
          </button>
          <button id="dash-journal-btn" className="btn btn-secondary" onClick={() => onOpenJournal('dashboard')}>
            <JournalIcon size={16} color="var(--color-primary-hover)" />
            <span>{metrics?.hasTodayJournal ? "View Today's Journal" : "Write Today's Journal"}</span>
          </button>
        </div>
      </div>

      {/* Real Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {/* Metric 1: Notes */}
        <div
          id="metric-notes-card"
          className="card card-interactive"
          onClick={onOpenNotes}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Notes</span>
            <div style={{ color: 'var(--color-primary)' }}><NotesIcon size={20} /></div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
            {loading ? '...' : (metrics?.noteCount ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {loading ? 'Loading notes...' : 'Click to browse all notes'}
          </div>
        </div>

        {/* Metric 2: Tags */}
        <div
          id="metric-tags-card"
          className="card card-interactive"
          onClick={onOpenTags}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Active Tags</span>
            <div style={{ color: 'var(--color-primary)' }}><TagIcon size={20} /></div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
            {loading ? '...' : (metrics?.tagCount ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {loading ? 'Loading tags...' : 'Click to manage tags'}
          </div>
        </div>

        {/* Metric 3: Journal entries */}
        <div
          id="metric-journal-card"
          className="card card-interactive"
          onClick={onOpenJournal}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Daily Entries</span>
            <div style={{ color: 'var(--color-primary)' }}><JournalIcon size={20} /></div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
            {loading ? '...' : (metrics?.journalCount ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: metrics?.hasTodayJournal ? 'var(--color-success)' : 'var(--color-warning)', marginTop: 4 }}>
            {loading ? 'Checking status...' : (metrics?.hasTodayJournal ? '✓ Today recorded' : '○ Today not written yet')}
          </div>
        </div>

        {/* Metric 4: Graph shortcut */}
        <div
          id="metric-graph-card"
          className="card card-interactive"
          onClick={onOpenGraph}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>Knowledge Graph</span>
            <div style={{ color: 'var(--color-primary)' }}><GraphIcon size={20} /></div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginTop: 8 }}>
            Interactive Network
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Explore visual connections
          </div>
        </div>
      </div>

      {/* Recent Notes Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18 }}>Recent Notes</h3>
          <button id="dash-view-all-notes" className="btn btn-ghost btn-sm" onClick={onOpenNotes}>
            View all →
          </button>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
            Loading recent notes and workspace metrics...
          </div>
        ) : (!metrics?.recentNotes || metrics.recentNotes.length === 0) ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <NotesIcon size={32} color="var(--color-text-muted)" />
            <h4 style={{ marginTop: 12, marginBottom: 6 }}>
              {(metrics?.journalCount || 0) > 0 ? 'No notes created yet' : 'Your vault is empty'}
            </h4>
            <p style={{ fontSize: 13, marginBottom: 18, maxWidth: 360, margin: '0 auto 18px' }}>
              {(metrics?.journalCount || 0) > 0
                ? `You have recorded ${metrics.journalCount} daily journal ${metrics.journalCount === 1 ? 'entry' : 'entries'}. Create your first note to begin organizing your knowledge.`
                : 'Create your first note or journal entry to start building your personal knowledge network.'}
            </p>
            <button id="dash-empty-new-note" className="btn btn-primary btn-sm" onClick={() => onNewNote('dashboard')}>
              <PlusIcon size={14} />
              <span>Create First Note</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {metrics.recentNotes.map((note) => (
              <div
                key={note._id}
                className="card card-interactive"
                onClick={() => onOpenNote(note._id, 'dashboard')}
                style={{
                  cursor: 'pointer',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: 'var(--color-text)' }}>
                    {note.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.contentSnippet || 'No content'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="tag-badge">#{tag}</span>
                      ))}
                      {note.tags.length > 2 && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{note.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
