import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SearchIcon, PlusIcon, TagIcon, TrashIcon, ExternalLinkIcon } from '../components/Icons';
import { ConfirmModal } from '../components/ConfirmModal';

export function NotesPage({ onNewNote, onOpenNote, onNoteDeleted, initialTag = '', initialSearch = '', refreshTrigger = 0 }) {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState(initialSearch);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [sort, setSort] = useState('updatedAt_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deletion modal state
  const [deleteNoteId, setDeleteNoteId] = useState(null);
  const [deleteNoteTitle, setDeleteNoteTitle] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [notesRes, tagsRes] = await Promise.all([
        api.getNotes({ search, tag: selectedTag, sort }),
        api.getTags()
      ]);
      setNotes(notesRes.notes || []);
      setTags(tagsRes.tags || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedTag, sort, refreshTrigger]);

  const handleDeleteConfirm = async () => {
    if (!deleteNoteId) return;
    try {
      await api.deleteNote(deleteNoteId);
      setDeleteNoteId(null);
      loadData();
      if (onNoteDeleted) {
        onNoteDeleted();
      }
    } catch (err) {
      alert(`Failed to delete note: ${err.message}`);
    }
  };

  return (
    <div id="notes-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Filter & Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 380 }}>
          <SearchIcon
            size={16}
            color="var(--color-text-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
          <input
            id="notes-search-filter"
            type="text"
            className="input-text"
            placeholder="Filter notes by title or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36, height: 38 }}
          />
        </div>

        {/* Sort selector & New Note */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            id="notes-sort-select"
            className="select-input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ height: 38, padding: '0 12px', minWidth: 160 }}
          >
            <option value="updatedAt_desc">Recently Modified</option>
            <option value="updatedAt_asc">Oldest Modified</option>
            <option value="title_asc">Title (A – Z)</option>
            <option value="title_desc">Title (Z – A)</option>
          </select>

          <button id="notes-page-new-note" className="btn btn-primary" onClick={onNewNote}>
            <PlusIcon size={16} />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Tag filter pills */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <TagIcon size={14} /> Filter:
          </span>
          <button
            id="tag-filter-all"
            className={`tag-badge ${!selectedTag ? 'active' : ''}`}
            onClick={() => setSelectedTag('')}
          >
            All Notes
          </button>
          {tags.map((t) => (
            <button
              key={t.tag}
              id={`tag-filter-${t.tag}`}
              className={`tag-badge ${selectedTag === t.tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(selectedTag === t.tag ? '' : t.tag)}
            >
              #{t.tag} ({t.count})
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* Notes Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h3 style={{ marginBottom: 8 }}>No notes found</h3>
          <p style={{ maxWidth: 400, margin: '0 auto 20px', fontSize: 14 }}>
            {search || selectedTag
              ? 'No notes match your active filter criteria. Try adjusting your search or clearing the tag filter.'
              : 'Your vault is currently empty. Create your first note to begin organizing your thoughts.'}
          </p>
          {search || selectedTag ? (
            <button
              id="clear-notes-filters-btn"
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setSelectedTag(''); }}
            >
              Clear Filters
            </button>
          ) : (
            <button id="notes-empty-new-note-btn" className="btn btn-primary btn-sm" onClick={onNewNote}>
              <PlusIcon size={14} />
              <span>Create Note</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16
        }}>
          {notes.map((note) => (
            <div
              key={note._id || note.id}
              className="card card-interactive"
              id={`note-card-${note._id || note.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 180,
                cursor: 'pointer'
              }}
              onClick={() => onOpenNote(note._id || note.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <h4 style={{ fontSize: 16, color: 'var(--color-text)', wordBreak: 'break-word' }}>
                    {note.title}
                  </h4>
                  <button
                    id={`delete-note-btn-${note._id || note.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 4, height: 28, minHeight: 28, color: 'var(--color-text-muted)' }}
                    title="Delete Note"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteNoteId(note._id || note.id);
                      setDeleteNoteTitle(note.title);
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>

                <p style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--color-text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: 12
                }}>
                  {note.content || 'Empty note'}
                </p>

                {note.resourceUrl && (
                  <div style={{ marginBottom: 12 }}>
                    <a
                      href={note.resourceUrl.startsWith('http') ? note.resourceUrl : `https://${note.resourceUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="resource-link-chip"
                      onClick={(e) => e.stopPropagation()}
                      title={note.resourceUrl}
                    >
                      <ExternalLinkIcon size={12} />
                      <span>{note.resourceUrl.replace(/^https?:\/\//, '').slice(0, 36)}</span>
                    </a>
                  </div>
                )}
              </div>

              <div>
                {note.tags && note.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="tag-badge"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(tag);
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                  {note.linkedNoteIds && note.linkedNoteIds.length > 0 && (
                    <span>{note.linkedNoteIds.length} link{note.linkedNoteIds.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteNoteId}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteNoteTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteNoteId(null)}
      />
    </div>
  );
}
