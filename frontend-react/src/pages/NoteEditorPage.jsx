import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { TrashIcon, CheckIcon, PlusIcon, CloseIcon, LinkIcon, ExternalLinkIcon } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';

export function NoteEditorPage({ noteId, onBack, onNoteSaved }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [linkedNoteIds, setLinkedNoteIds] = useState([]);
  
  // Suggested existing tags from vault
  const [vaultTags, setVaultTags] = useState([]);
  const [allNotesList, setAllNotesList] = useState([]);
  const [noteFilterQuery, setNoteFilterQuery] = useState('');

  const [initialData, setInitialData] = useState({
    title: '',
    content: '',
    resourceUrl: '',
    tags: [],
    linkedNoteIds: []
  });
  
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'dirty' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  // Modals
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load existing note data and available tags/notes
  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [allNotesRes, allTagsRes] = await Promise.all([
          api.getNotes(),
          api.getTags()
        ]);

        if (!isMounted) return;

        // Exclude current note from linkable options
        setAllNotesList((allNotesRes.notes || []).filter(n => (n._id || n.id) !== noteId));
        setVaultTags(allTagsRes.tags || []);

        if (noteId && noteId !== 'new') {
          const res = await api.getNote(noteId);
          if (!isMounted) return;
          const n = res.note;
          setTitle(n.title || '');
          setContent(n.content || '');
          setResourceUrl(n.resourceUrl || '');
          setTags(n.tags || []);
          setLinkedNoteIds(n.linkedNoteIds || []);
          setCreatedAt(n.createdAt);
          setUpdatedAt(n.updatedAt);
          setInitialData({
            title: n.title || '',
            content: n.content || '',
            resourceUrl: n.resourceUrl || '',
            tags: n.tags || [],
            linkedNoteIds: n.linkedNoteIds || []
          });
          setSaveStatus('saved');
        } else {
          setTitle('');
          setContent('');
          setResourceUrl('');
          setTags([]);
          setLinkedNoteIds([]);
          setInitialData({
            title: '',
            content: '',
            resourceUrl: '',
            tags: [],
            linkedNoteIds: []
          });
          setSaveStatus('dirty');
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load note.');
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  // Track dirty changes
  useEffect(() => {
    const dirty =
      title !== initialData.title ||
      content !== initialData.content ||
      resourceUrl !== initialData.resourceUrl ||
      JSON.stringify(tags) !== JSON.stringify(initialData.tags) ||
      JSON.stringify(linkedNoteIds) !== JSON.stringify(initialData.linkedNoteIds);

    setIsDirty(dirty);
    if (dirty && saveStatus === 'saved') {
      setSaveStatus('dirty');
    }
  }, [title, content, resourceUrl, tags, linkedNoteIds, initialData]);

  // Tag management
  const handleAddTag = (e) => {
    if (e && e.key && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const raw = tagInput.trim();
    if (raw) {
      const parts = raw.split(/[,;\s]+/).map(t => t.trim().toLowerCase().replace(/^#+/, '')).filter(Boolean);
      const nextTags = [...tags];
      parts.forEach(p => {
        if (!nextTags.includes(p)) nextTags.push(p);
      });
      setTags(nextTags);
      setTagInput('');
    }
  };

  const handleSelectExistingTag = (tagToAdd) => {
    const clean = tagToAdd.trim().toLowerCase().replace(/^#+/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleToggleLinkedNote = (targetId) => {
    if (linkedNoteIds.includes(targetId)) {
      setLinkedNoteIds(linkedNoteIds.filter(id => id !== targetId));
    } else {
      setLinkedNoteIds([...linkedNoteIds, targetId]);
    }
  };

  // Save handler with validation and automatic exit
  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMessage('Note title is required. Please enter a title before saving.');
      return;
    }

    if (isSaving) return; // Prevent duplicate submissions

    try {
      setIsSaving(true);
      setSaveStatus('saving');
      setErrorMessage('');

      let savedNote;
      const payload = {
        title: title.trim(),
        content,
        resourceUrl: resourceUrl.trim(),
        tags,
        linkedNoteIds
      };

      if (noteId && noteId !== 'new') {
        const res = await api.updateNote(noteId, payload);
        savedNote = res.note;
      } else {
        const res = await api.createNote(payload);
        savedNote = res.note;
      }

      setInitialData({
        title: savedNote.title,
        content: savedNote.content || '',
        resourceUrl: savedNote.resourceUrl || '',
        tags: savedNote.tags || [],
        linkedNoteIds: savedNote.linkedNoteIds || []
      });
      setIsDirty(false);
      setSaveStatus('saved');
      setIsSaving(false);

      // Trigger automatic exit and notify caller with success message
      if (onNoteSaved) {
        onNoteSaved({
          noteId: savedNote._id || savedNote.id,
          note: savedNote,
          message: 'Note saved successfully.'
        });
      }
    } catch (err) {
      setIsSaving(false);
      setSaveStatus('error');
      // Content remains intact so user does not lose unsaved work
      setErrorMessage(err.message || 'Failed to save note. Please verify your connection and try again.');
    }
  };

  const handleBackAttempt = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onBack();
    }
  };

  const handleDelete = async () => {
    if (!noteId || noteId === 'new') return;
    try {
      await api.deleteNote(noteId);
      setShowDeleteModal(false);
      if (onNoteSaved) {
        onNoteSaved({
          noteId,
          deleted: true,
          message: 'Note deleted successfully.'
        });
      } else {
        onBack();
      }
    } catch (err) {
      alert(`Error deleting note: ${err.message}`);
    }
  };

  // Filter available existing tags to show clickable suggestions
  const suggestedTags = vaultTags
    .map(t => t.tag)
    .filter(t => !tags.includes(t));

  // Filter linkable notes
  const filteredLinkableNotes = allNotesList.filter(n =>
    !noteFilterQuery.trim() ||
    (n.title || '').toLowerCase().includes(noteFilterQuery.toLowerCase().trim())
  );

  return (
    <div id="note-editor-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top action toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            id="editor-back-btn"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleBackAttempt}
          >
            ← Back
          </button>

          {/* Status Indicator */}
          <span id="editor-save-status" style={{
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color:
              saveStatus === 'saved' ? 'var(--color-success)' :
              saveStatus === 'saving' ? 'var(--color-warning)' :
              saveStatus === 'dirty' ? 'var(--color-text-muted)' : 'var(--color-danger)'
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'currentColor'
            }}></span>
            {saveStatus === 'saved' && 'Saved to Vault'}
            {saveStatus === 'saving' && 'Saving note...'}
            {saveStatus === 'dirty' && 'Unsaved changes'}
            {saveStatus === 'error' && 'Save failed'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {noteId && noteId !== 'new' && (
            <button
              id="editor-delete-btn"
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setShowDeleteModal(true)}
              title="Delete Note"
            >
              <TrashIcon size={14} />
              <span>Delete</span>
            </button>
          )}

          <button
            id="editor-done-btn"
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleBackAttempt}
            title="Done editing"
          >
            Done
          </button>

          <button
            id="editor-save-btn"
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <CheckIcon size={14} />
            <span>{isSaving ? 'Saving...' : 'Save & Exit'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error" id="editor-error-alert" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Editor Body */}
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Title Input */}
        <div>
          <label className="form-label" htmlFor="editor-title-input" style={{ marginBottom: 4, display: 'block' }}>
            Note Title <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="editor-title-input"
            type="text"
            placeholder="e.g. System Architecture Guide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: 22,
              fontWeight: 700,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              outline: 'none',
              color: 'var(--color-text)',
              width: '100%'
            }}
          />
        </div>

        {/* Resource URL (optional) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="form-label" htmlFor="editor-resource-url-input">
              Resource URL (optional)
            </label>
            {resourceUrl.trim() && (
              <a
                href={resourceUrl.startsWith('http') ? resourceUrl : `https://${resourceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-link-chip"
                style={{ fontSize: 11 }}
              >
                <ExternalLinkIcon size={12} />
                <span>Visit Link</span>
              </a>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <LinkIcon
              size={15}
              color="var(--color-text-muted)"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              id="editor-resource-url-input"
              type="url"
              className="input-text"
              placeholder="https://example.com/documentation or research reference"
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Tags Section */}
        <div>
          <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
            Tags (optional)
          </label>

          {/* Active Tags & Input Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)'
          }}>
            {tags.map((tag) => (
              <span key={tag} className="tag-badge" style={{ gap: 6 }}>
                #{tag}
                <button
                  type="button"
                  id={`remove-tag-${tag}-btn`}
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                id="editor-tag-input"
                type="text"
                placeholder="+ Type tag & press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="input-text"
                style={{
                  height: 30,
                  padding: '2px 10px',
                  fontSize: 13,
                  width: 200,
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-full)'
                }}
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  id="editor-add-tag-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddTag}
                  style={{ height: 30, minHeight: 30, padding: '0 10px', fontSize: 12 }}
                >
                  Add Tag
                </button>
              )}
            </div>
          </div>

          {/* Existing tags suggestions picker */}
          {suggestedTags.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Select existing vault tags:
              </span>
              {suggestedTags.slice(0, 12).map((existingTag) => (
                <button
                  key={existingTag}
                  type="button"
                  id={`suggest-tag-${existingTag}`}
                  className="tag-suggestion-pill"
                  onClick={() => handleSelectExistingTag(existingTag)}
                  title={`Click to add #${existingTag}`}
                >
                  + #{existingTag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Textarea */}
        <div>
          <label className="form-label" htmlFor="editor-content-textarea" style={{ marginBottom: 4, display: 'block' }}>
            Note Content / Body
          </label>
          <textarea
            id="editor-content-textarea"
            className="textarea-input"
            placeholder="Write note content, thoughts, markdown, code, or study notes..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              minHeight: 320,
              fontSize: 15,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-raised)',
              borderRadius: 'var(--radius-sm)'
            }}
          />
        </div>

        {/* Related Notes Connections (Knowledge Graph Links) */}
        {allNotesList.length > 0 && (
          <div style={{
            marginTop: 8,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  Related Notes (Knowledge Graph Connections)
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                  ({linkedNoteIds.length} connected)
                </span>
              </div>

              {allNotesList.length > 5 && (
                <input
                  type="text"
                  placeholder="Filter notes..."
                  value={noteFilterQuery}
                  onChange={(e) => setNoteFilterQuery(e.target.value)}
                  className="input-text"
                  style={{ width: 160, height: 28, fontSize: 12, padding: '2px 8px' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {filteredLinkableNotes.map((other) => {
                const oid = other._id || other.id;
                const isLinked = linkedNoteIds.includes(oid);
                return (
                  <button
                    key={oid}
                    type="button"
                    id={`link-note-btn-${oid}`}
                    className={`btn btn-sm ${isLinked ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleToggleLinkedNote(oid)}
                    style={{ fontSize: 12 }}
                  >
                    {isLinked ? '✓ ' : '+ '} {other.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        {updatedAt && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <span>Created: {new Date(createdAt).toLocaleString()}</span>
            <span>Last Modified: {new Date(updatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Discard Unsaved Changes Modal */}
      <ConfirmModal
        isOpen={showDiscardModal}
        title="Unsaved Changes"
        message="You have unsaved edits in this note. Navigating away now will discard your changes. Are you sure you want to discard them?"
        confirmText="Discard and Leave"
        cancelText="Keep Editing"
        isDanger={true}
        onConfirm={() => {
          setShowDiscardModal(false);
          onBack();
        }}
        onCancel={() => setShowDiscardModal(false)}
      />

      {/* Delete Note Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Note"
        message={`Are you sure you want to permanently delete "${title || 'Untitled Note'}"? This action cannot be undone.`}
        confirmText="Delete Note"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
