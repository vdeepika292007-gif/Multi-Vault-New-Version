import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { TagIcon, NotesIcon } from '../components/Icons';

export function TagsPage({ onSelectTag, onNewNote }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.getTags();
        setTags(res.tags || []);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div id="tags-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Vault Tags</h2>
        <p style={{ fontSize: 14 }}>
          Tags help you classify notes and construct automatic relationship clusters across your knowledge graph.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>Failed to load tags: {error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          Loading tags...
        </div>
      ) : tags.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <TagIcon size={36} color="var(--color-text-muted)" />
          <h3 style={{ marginTop: 14, marginBottom: 8 }}>No Tags Yet</h3>
          <p style={{ maxWidth: 380, margin: '0 auto 20px', fontSize: 14 }}>
            When you add tags like <span className="tag-badge">#architecture</span> or <span className="tag-badge">#journal</span> to your notes, they will appear here.
          </p>
          <button id="tags-empty-new-note" className="btn btn-primary btn-sm" onClick={onNewNote}>
            Create a Note with Tags
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16
        }}>
          {tags.map((t) => (
            <div
              key={t.tag}
              id={`tag-card-${t.tag}`}
              className="card card-interactive"
              onClick={() => onSelectTag(t.tag)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--color-primary)' }}><TagIcon size={18} /></span>
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>
                  #{t.tag}
                </span>
              </div>

              <span style={{
                backgroundColor: 'var(--color-primary-soft)',
                color: 'var(--color-primary-hover)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 10px',
                fontSize: 12,
                fontWeight: 600
              }}>
                {t.count} {t.count === 1 ? 'note' : 'notes'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
