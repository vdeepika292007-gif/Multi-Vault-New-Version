import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { JournalIcon, CheckIcon, LinkIcon } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';

export function JournalPage({ onJournalSaved, onExit }) {
  const getTodayDate = () => new Date().toISOString().slice(0, 10);

  const [currentDate, setCurrentDate] = useState(getTodayDate());
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [linkedNoteIds, setLinkedNoteIds] = useState([]);
  const [initialLinkedNoteIds, setInitialLinkedNoteIds] = useState([]);
  
  const [allNotesList, setAllNotesList] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'dirty' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Load entry for current date, notes for linking, and history
  const loadData = async (date) => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [entryRes, histRes, notesRes] = await Promise.all([
        api.getJournalEntry(date),
        api.getJournalHistory(),
        api.getNotes()
      ]);

      const entryContent = entryRes.entry?.content || '';
      const entryLinked = entryRes.entry?.linkedNoteIds || [];

      setContent(entryContent);
      setInitialContent(entryContent);
      setLinkedNoteIds(entryLinked);
      setInitialLinkedNoteIds(entryLinked);
      setSaveStatus('saved');
      setHistory(histRes.history || []);
      setAllNotesList(notesRes.notes || []);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load journal entry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(currentDate);
  }, [currentDate]);

  // Track unsaved dirty state
  useEffect(() => {
    const isDirty =
      content !== initialContent ||
      JSON.stringify(linkedNoteIds) !== JSON.stringify(initialLinkedNoteIds);

    if (isDirty) {
      setSaveStatus('dirty');
    } else {
      if (saveStatus !== 'saving') {
        setSaveStatus('saved');
      }
    }
  }, [content, initialContent, linkedNoteIds, initialLinkedNoteIds]);

  const handleDateChange = (newDate) => {
    if (newDate) {
      setCurrentDate(newDate);
    }
  };

  const handleStepDay = (delta) => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setCurrentDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleToggleLinkedNote = (noteId) => {
    if (linkedNoteIds.includes(noteId)) {
      setLinkedNoteIds(linkedNoteIds.filter(id => id !== noteId));
    } else {
      setLinkedNoteIds([...linkedNoteIds, noteId]);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      setErrorMessage('');

      await api.saveJournalEntry(currentDate, content, linkedNoteIds);

      setInitialContent(content);
      setInitialLinkedNoteIds(linkedNoteIds);
      setSaveStatus('saved');
      setIsSaving(false);

      // Refresh history list immediately
      const histRes = await api.getJournalHistory();
      setHistory(histRes.history || []);

      // Notify parent to refresh dashboard statistics immediately and show toast
      if (onJournalSaved) {
        onJournalSaved({
          date: currentDate,
          message: 'Journal entry saved successfully.'
        });
      }
    } catch (err) {
      setIsSaving(false);
      setSaveStatus('error');
      // Content preserved intact
      setErrorMessage(err.message || 'Failed to save journal entry. Please retry.');
    }
  };

  const handleExitAttempt = () => {
    const isDirty =
      content !== initialContent ||
      JSON.stringify(linkedNoteIds) !== JSON.stringify(initialLinkedNoteIds);

    if (isDirty) {
      setShowExitConfirm(true);
    } else if (onExit) {
      onExit();
    }
  };

  const formattedDate = new Date(currentDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isToday = currentDate === getTodayDate();

  return (
    <div id="journal-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Date navigation and Toolbar */}
      <div className="card" style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            id="journal-prev-day-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleStepDay(-1)}
            title="Previous Day"
          >
            ← Prev
          </button>

          <input
            id="journal-date-picker"
            type="date"
            className="input-text"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{ width: 140, height: 34, padding: '4px 8px', fontSize: 13 }}
          />

          <button
            id="journal-next-day-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleStepDay(1)}
            title="Next Day"
          >
            Next →
          </button>

          {!isToday && (
            <button
              id="journal-jump-today-btn"
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentDate(getTodayDate())}
              style={{ fontSize: 12, color: 'var(--color-primary-hover)' }}
            >
              Jump to Today
            </button>
          )}
        </div>

        {/* Save status, Done action, & manual save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span id="journal-save-status" style={{
            fontSize: 12,
            color:
              saveStatus === 'saved' ? 'var(--color-success)' :
              saveStatus === 'saving' ? 'var(--color-warning)' :
              saveStatus === 'dirty' ? 'var(--color-text-muted)' : 'var(--color-danger)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving entry...'}
            {saveStatus === 'dirty' && 'Unsaved edits'}
            {saveStatus === 'error' && 'Failed to save'}
          </span>

          {onExit && (
            <button
              id="journal-done-btn"
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleExitAttempt}
              title="Return to previous view"
            >
              Done
            </button>
          )}

          <button
            id="journal-save-btn"
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <CheckIcon size={14} />
            <span>{isSaving ? 'Saving...' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error" id="journal-error-alert" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Journal Layout: Editor + History Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 20 }}>
        {/* Distraction-free Editor */}
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <JournalIcon size={20} color="var(--color-primary)" />
            <h2 style={{ fontSize: 20 }}>{formattedDate}</h2>
          </div>

          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            {isToday ? "Today's daily entry. Record your focus, decisions, and personal learnings." : `Journal archive entry for ${currentDate}.`}
          </p>

          <textarea
            id="journal-content-textarea"
            className="textarea-input"
            placeholder="Write your daily thoughts, milestones, obstacles, and reflections here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              minHeight: 380,
              fontSize: 15,
              lineHeight: 1.6,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)'
            }}
          />

          {/* Related Notes Connection for Journal Entries */}
          {allNotesList.length > 0 && (
            <div style={{
              marginTop: 10,
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <LinkIcon size={15} color="var(--color-primary)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  Link to Related Notes (optional)
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  ({linkedNoteIds.length} linked)
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 120, overflowY: 'auto' }}>
                {allNotesList.map((note) => {
                  const nid = note._id || note.id;
                  const isLinked = linkedNoteIds.includes(nid);
                  return (
                    <button
                      key={nid}
                      type="button"
                      id={`journal-link-note-${nid}`}
                      className={`btn btn-sm ${isLinked ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleToggleLinkedNote(nid)}
                      style={{ fontSize: 12 }}
                    >
                      {isLinked ? '✓ ' : '+ '} {note.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Journal History Sidebar */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Recent Entries</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
              ({history.length})
            </span>
          </h3>

          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No journal history yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {history.map((h) => {
                const isActive = h.entryDate === currentDate;
                return (
                  <div
                    key={h.entryDate}
                    id={`journal-history-${h.entryDate}`}
                    onClick={() => setCurrentDate(h.entryDate)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'var(--color-primary-soft)' : 'var(--color-surface-raised)',
                      border: `1px solid ${isActive ? 'rgba(139, 92, 246, 0.4)' : 'var(--color-border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: isActive ? 'var(--color-primary-hover)' : 'var(--color-text)',
                      marginBottom: 2
                    }}>
                      {h.entryDate} {h.entryDate === getTodayDate() ? '(Today)' : ''}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {h.content || 'Empty entry'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Discard Unsaved Changes Modal */}
      <ConfirmModal
        isOpen={showExitConfirm}
        title="Unsaved Changes"
        message="You have unsaved edits in today's journal entry. Are you sure you want to exit without saving?"
        confirmText="Discard and Exit"
        cancelText="Keep Editing"
        isDanger={true}
        onConfirm={() => {
          setShowExitConfirm(false);
          if (onExit) onExit();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  );
}
