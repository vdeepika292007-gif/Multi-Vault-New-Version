import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GraphIcon, PlusIcon, NotesIcon, ExternalLinkIcon, LinkIcon, CloseIcon, TagIcon } from '../components/Icons';

export function KnowledgeGraphPage({ onOpenNote, onNewNote, refreshTrigger }) {
  const { user } = useAuth();

  const [graphData, setGraphData] = useState({ nodes: [], edges: [], allEdges: [], counts: {}, connectionRules: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list'
  const [zoomLevel, setZoomLevel] = useState(1);

  // Initialize filters with user's saved preferences from Settings
  const [showExplicit, setShowExplicit] = useState(true);
  const [showContentMentions, setShowContentMentions] = useState(true);
  const [showSharedTags, setShowSharedTags] = useState(user?.preferences?.graphShowSharedTags ?? true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);

  // Recompute & fetch latest graph from backend with active filters
  const loadGraph = useCallback(async (overrides) => {
    try {
      setLoading(true);
      const appliedFilters = {
        explicit: overrides?.explicit !== undefined ? overrides.explicit : showExplicit,
        contentMentions: overrides?.contentMentions !== undefined ? overrides.contentMentions : showContentMentions,
        sharedTags: overrides?.sharedTags !== undefined ? overrides.sharedTags : showSharedTags
      };

      const data = await api.getGraph(appliedFilters);
      setGraphData(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load knowledge graph.');
    } finally {
      setLoading(false);
    }
  }, [showExplicit, showContentMentions, showSharedTags]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph, refreshTrigger]);

  // Comprehensive list of all relationships discovered in the vault
  const rawEdges = (graphData.allEdges && graphData.allEdges.length > 0)
    ? graphData.allEdges
    : (graphData.edges || []);

  // Compute active relationship types based on filter checkboxes
  const activeTypes = new Set();
  if (showExplicit) activeTypes.add('explicit');
  if (showContentMentions) activeTypes.add('content-mention');
  if (showSharedTags) {
    activeTypes.add('shared-tag');
    activeTypes.add('shared-resource');
  }

  // Filter edges: an edge is shown if AT LEAST ONE of its relationship reasons is active
  const filteredEdges = rawEdges.filter(e => {
    if (e.types && e.types.length > 0) {
      return e.types.some(t => activeTypes.has(t));
    }
    return activeTypes.has(e.type);
  });

  // Calculate dynamic active degree (connection count) per node
  const activeDegreeMap = {};
  filteredEdges.forEach(e => {
    activeDegreeMap[e.source] = (activeDegreeMap[e.source] || 0) + 1;
    activeDegreeMap[e.target] = (activeDegreeMap[e.target] || 0) + 1;
  });

  // Calculate total discovered connections by category for UI count badges
  const totalExplicit = rawEdges.filter(e => (e.types || [e.type]).includes('explicit')).length;
  const totalMentions = rawEdges.filter(e => (e.types || [e.type]).includes('content-mention')).length;
  const totalTags = rawEdges.filter(e => (e.types || [e.type]).some(t => t === 'shared-tag' || t === 'shared-resource')).length;

  // Calculate layout coordinates in clean dynamic arrangement
  const width = 800;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;
  const nodes = graphData.nodes || [];
  const nodeCount = nodes.length;

  const nodePositions = {};
  if (nodeCount === 1) {
    nodePositions[nodes[0].id] = { x: cx, y: cy };
  } else if (nodeCount === 2) {
    nodePositions[nodes[0].id] = { x: cx - 140, y: cy };
    nodePositions[nodes[1].id] = { x: cx + 140, y: cy };
  } else if (nodeCount <= 8) {
    const radius = Math.min(width, height) * 0.35;
    nodes.forEach((node, idx) => {
      const angle = (idx / nodeCount) * 2 * Math.PI - Math.PI / 2;
      nodePositions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      };
    });
  } else {
    // 9+ nodes: Concentric dual-ring layout based on active degree
    const sortedByDegree = [...nodes].sort((a, b) => (activeDegreeMap[b.id] || 0) - (activeDegreeMap[a.id] || 0));
    const innerCount = Math.max(3, Math.floor(nodeCount * 0.4));
    const innerNodes = sortedByDegree.slice(0, innerCount);
    const outerNodes = sortedByDegree.slice(innerCount);

    const innerRadius = 110;
    const outerRadius = 195;

    innerNodes.forEach((node, idx) => {
      const angle = (idx / innerNodes.length) * 2 * Math.PI - Math.PI / 2;
      nodePositions[node.id] = {
        x: cx + innerRadius * Math.cos(angle),
        y: cy + innerRadius * Math.sin(angle)
      };
    });

    outerNodes.forEach((node, idx) => {
      const angle = (idx / outerNodes.length) * 2 * Math.PI - Math.PI / 2 + (Math.PI / Math.max(outerNodes.length, 1));
      nodePositions[node.id] = {
        x: cx + outerRadius * Math.cos(angle),
        y: cy + outerRadius * Math.sin(angle)
      };
    });
  }

  // When a user selects a node, find full node data from graph or API
  const handleSelectNode = async (node) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
    const found = graphData.nodes.find(n => n.id === node.id) || node;
    setSelectedNode(found);

    if (found.content === undefined || found.resourceUrl === undefined) {
      try {
        const fullRes = await api.getNote(node.id);
        if (fullRes?.note) {
          const fresh = {
            ...found,
            content: fullRes.note.content || '',
            resourceUrl: fullRes.note.resourceUrl || '',
            tags: fullRes.note.tags || [],
            linkedNoteIds: (fullRes.note.linkedNoteIds || []).map(String),
            updatedAt: fullRes.note.updatedAt,
            createdAt: fullRes.note.createdAt
          };
          setSelectedNode(fresh);
        }
      } catch (err) {
        console.warn('Could not fetch fresh full note details:', err);
      }
    }
  };

  // Compute distinct relationships for the active selected node
  const activeNodeId = selectedNode?.id;

  const explicitRelatedNotes = selectedNode
    ? filteredEdges
        .filter(e => (e.types || [e.type]).includes('explicit') && (e.source === activeNodeId || e.target === activeNodeId))
        .map(e => {
          const otherId = e.source === activeNodeId ? e.target : e.source;
          const otherNode = graphData.nodes.find(n => n.id === otherId);
          return otherNode ? { node: otherNode, label: e.label } : null;
        })
        .filter(Boolean)
    : [];

  const contentMentionRelatedNotes = selectedNode
    ? filteredEdges
        .filter(e => (e.types || [e.type]).includes('content-mention') && (e.source === activeNodeId || e.target === activeNodeId))
        .map(e => {
          const otherId = e.source === activeNodeId ? e.target : e.source;
          const otherNode = graphData.nodes.find(n => n.id === otherId);
          return otherNode ? { node: otherNode, label: e.label } : null;
        })
        .filter(Boolean)
    : [];

  const sharedTagRelatedNotes = selectedNode
    ? filteredEdges
        .filter(e => (e.types || [e.type]).some(t => t === 'shared-tag' || t === 'shared-resource') && (e.source === activeNodeId || e.target === activeNodeId))
        .map(e => {
          const otherId = e.source === activeNodeId ? e.target : e.source;
          const otherNode = graphData.nodes.find(n => n.id === otherId);
          return otherNode ? { node: otherNode, sharedTags: e.sharedTags || [], label: e.label } : null;
        })
        .filter(Boolean)
    : [];

  return (
    <div id="knowledge-graph-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Graph Control & Legend Bar */}
      <div className="card" style={{
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        {/* Connection Rules Legend with real-time interactive visibility toggles and count badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Filters:</span>

          <label
            htmlFor="graph-toggle-explicit"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showExplicit ? 'var(--color-primary-hover)' : 'var(--color-text-muted)', userSelect: 'none' }}
          >
            <input
              id="graph-toggle-explicit"
              type="checkbox"
              checked={showExplicit}
              onChange={(e) => setShowExplicit(e.target.checked)}
            />
            <span style={{ width: 14, height: 3, backgroundColor: showExplicit ? '#A78BFA' : 'var(--color-border)', display: 'inline-block', borderRadius: 2 }} />
            <span>Explicit Links ({totalExplicit})</span>
          </label>

          <label
            htmlFor="graph-toggle-content-mentions"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showContentMentions ? '#FCD34D' : 'var(--color-text-muted)', userSelect: 'none' }}
          >
            <input
              id="graph-toggle-content-mentions"
              type="checkbox"
              checked={showContentMentions}
              onChange={(e) => setShowContentMentions(e.target.checked)}
            />
            <span style={{ width: 14, height: 2, borderTop: `2px dotted ${showContentMentions ? '#FCD34D' : 'var(--color-border)'}`, display: 'inline-block' }} />
            <span>Content Mentions ({totalMentions})</span>
          </label>

          <label
            htmlFor="graph-toggle-shared-tags"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showSharedTags ? '#93C5FD' : 'var(--color-text-muted)', userSelect: 'none' }}
          >
            <input
              id="graph-toggle-shared-tags"
              type="checkbox"
              checked={showSharedTags}
              onChange={(e) => setShowSharedTags(e.target.checked)}
            />
            <span style={{ width: 14, height: 2, borderTop: `2px dashed ${showSharedTags ? '#93C5FD' : 'var(--color-border)'}`, display: 'inline-block' }} />
            <span>Shared Tags ({totalTags})</span>
          </label>

          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', borderLeft: '1px solid var(--color-border)', paddingLeft: 10 }}>
            Showing {filteredEdges.length} of {rawEdges.length} {rawEdges.length === 1 ? 'connection' : 'connections'}
            {filteredEdges.length < rawEdges.length && ` (${rawEdges.length - filteredEdges.length} hidden)`}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            id="graph-refresh-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => loadGraph()}
            style={{ height: 28, fontSize: 12, padding: '0 10px' }}
            title="Recompute & Refresh Knowledge Graph with latest notes and settings"
          >
            ↻ Refresh
          </button>

          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-raised)', borderRadius: 8, padding: 2, border: '1px solid var(--color-border)' }}>
            <button
              id="graph-view-btn"
              className={`btn btn-sm ${viewMode === 'graph' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('graph')}
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
            >
              Graph View
            </button>
            <button
              id="graph-list-btn"
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('list')}
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
            >
              Accessible List
            </button>
          </div>

          {viewMode === 'graph' && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                id="graph-zoom-in"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoomLevel(z => Math.min(z + 0.2, 2.0))}
                style={{ padding: '0 8px', height: 28 }}
                title="Zoom In"
              >
                +
              </button>
              <button
                id="graph-zoom-reset"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoomLevel(1)}
                style={{ padding: '0 8px', height: 28, fontSize: 11 }}
                title="Reset Zoom"
              >
                100%
              </button>
              <button
                id="graph-zoom-out"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoomLevel(z => Math.max(z - 0.2, 0.6))}
                style={{ padding: '0 8px', height: 28 }}
                title="Zoom Out"
              >
                -
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span>Failed to load graph: {error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>
          Computing vault connection graph...
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <GraphIcon size={40} color="var(--color-text-muted)" />
          <h3 style={{ marginTop: 16, marginBottom: 8 }}>Knowledge Graph Empty</h3>
          <p style={{ maxWidth: 420, margin: '0 auto 20px', fontSize: 14 }}>
            Create notes with tags, wikilinks, or explicit references to see your interactive knowledge network come alive.
          </p>
          <button id="graph-empty-new-note" className="btn btn-primary btn-sm" onClick={onNewNote}>
            <PlusIcon size={14} />
            <span>Create First Note</span>
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* Accessible List Alternative */
        <div className="card" id="graph-accessible-list" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Accessible Relationship Index</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {graphData.nodes.map(node => {
              const explicitConnected = filteredEdges
                .filter(e => (e.types || [e.type]).includes('explicit') && (e.source === node.id || e.target === node.id))
                .map(e => (e.source === node.id ? e.target : e.source));

              const mentionConnected = filteredEdges
                .filter(e => (e.types || [e.type]).includes('content-mention') && (e.source === node.id || e.target === node.id))
                .map(e => (e.source === node.id ? e.target : e.source));

              const sharedTagConnected = filteredEdges
                .filter(e => (e.types || [e.type]).some(t => t === 'shared-tag' || t === 'shared-resource') && (e.source === node.id || e.target === node.id))
                .map(e => ({
                  id: e.source === node.id ? e.target : e.source,
                  tags: e.sharedTags || []
                }));

              return (
                <div key={node.id} style={{
                  padding: 16,
                  backgroundColor: 'var(--color-surface-raised)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>{node.title}</strong>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          handleSelectNode(node);
                          setViewMode('graph');
                        }}
                      >
                        View Node Details
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => onOpenNote(node.id, 'graph')}>
                        Edit Note →
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    Tags: {node.tags && node.tags.length > 0 ? node.tags.map(t => `#${t}`).join(', ') : 'None'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Active Explicit links: {explicitConnected.length} | Content mentions: {mentionConnected.length} | Shared tag connections: {sharedTagConnected.length}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SVG Interactive Network Graph & Note Detail Panel */
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedNode ? 'minmax(0, 1.4fr) minmax(320px, 380px)' : '1fr',
          gap: 20,
          alignItems: 'start'
        }}>
          {/* Interactive SVG Canvas */}
          <div
            ref={containerRef}
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-sidebar)',
              position: 'relative',
              height: 540,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg
              id="knowledge-graph-svg"
              width="100%"
              height="100%"
              viewBox={`0 0 ${width} ${height}`}
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease',
                cursor: 'grab'
              }}
            >
              {/* Edges with luminous distinct colors for obsidian vault aesthetic */}
              <g id="graph-edges-group">
                {filteredEdges.map(edge => {
                  const s = nodePositions[edge.source];
                  const t = nodePositions[edge.target];
                  if (!s || !t) return null;

                  const isConnectedToSelected = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
                  const isDimmed = selectedNode && !isConnectedToSelected;

                  // Determine primary active styling
                  const activeReasonTypes = (edge.types || [edge.type]).filter(t => activeTypes.has(t));
                  let effectiveType = edge.type;
                  if (activeReasonTypes.includes('explicit')) {
                    effectiveType = 'explicit';
                  } else if (activeReasonTypes.includes('content-mention')) {
                    effectiveType = 'content-mention';
                  } else if (activeReasonTypes.some(t => t === 'shared-tag' || t === 'shared-resource')) {
                    effectiveType = 'shared-tag';
                  }

                  let strokeColor = '#A78BFA';
                  let strokeWidth = 2.5;
                  let strokeDasharray = 'none';

                  if (effectiveType === 'explicit') {
                    strokeColor = isConnectedToSelected ? '#E9D5FF' : '#A78BFA';
                    strokeWidth = isConnectedToSelected ? 3.5 : 2.5;
                    strokeDasharray = 'none';
                  } else if (effectiveType === 'content-mention') {
                    strokeColor = isConnectedToSelected ? '#FEF08A' : '#FCD34D';
                    strokeWidth = isConnectedToSelected ? 3.0 : 2.0;
                    strokeDasharray = '3 3';
                  } else if (effectiveType === 'shared-tag') {
                    strokeColor = isConnectedToSelected ? '#FFFFFF' : '#93C5FD';
                    strokeWidth = isConnectedToSelected ? 3.0 : 2.0;
                    strokeDasharray = '6 4';
                  } else if (effectiveType === 'shared-resource') {
                    strokeColor = isConnectedToSelected ? '#A7F3D0' : '#34D399';
                    strokeWidth = isConnectedToSelected ? 3.0 : 2.0;
                    strokeDasharray = '8 3';
                  }

                  return (
                    <line
                      key={edge.id}
                      id={`svg-edge-${edge.id}`}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      opacity={isDimmed ? 0.18 : (isConnectedToSelected ? 1 : 0.85)}
                      style={{ transition: 'stroke-width 0.2s ease, opacity 0.2s ease' }}
                    >
                      <title>{edge.label}</title>
                    </line>
                  );
                })}
              </g>

              {/* Nodes */}
              <g id="graph-nodes-group">
                {graphData.nodes.map(node => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;

                  const currentActiveDegree = activeDegreeMap[node.id] || 0;
                  const isSelected = selectedNode?.id === node.id;
                  const isConnected = selectedNode && (
                    filteredEdges.some(e =>
                      (e.source === selectedNode.id && e.target === node.id) ||
                      (e.target === selectedNode.id && e.source === node.id)
                    )
                  );
                  const isDimmed = selectedNode && !isSelected && !isConnected;
                  const nodeRadius = 18 + Math.min(currentActiveDegree * 3, 16);

                  return (
                    <g
                      key={node.id}
                      id={`graph-node-${node.id}`}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => handleSelectNode(node)}
                      style={{ cursor: 'pointer', opacity: isDimmed ? 0.35 : 1, transition: 'opacity 0.2s ease' }}
                    >
                      <title>{`${node.title} — ${currentActiveDegree} active connection${currentActiveDegree === 1 ? '' : 's'}`}</title>
                      <circle
                        r={nodeRadius}
                        fill={isSelected ? 'var(--color-primary)' : 'var(--color-surface-raised)'}
                        stroke={isSelected ? '#FFFFFF' : (isConnected ? 'var(--color-primary-hover)' : 'var(--color-primary)')}
                        strokeWidth={isSelected ? 3.5 : 2}
                        filter="drop-shadow(0 2px 8px rgba(0,0,0,0.6))"
                      />
                      <text
                        y={nodeRadius + 15}
                        textAnchor="middle"
                        fill="var(--color-text)"
                        fontSize="12"
                        fontWeight={isSelected ? '700' : '500'}
                        paintOrder="stroke"
                        stroke="var(--color-sidebar)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {node.title.length > 20 ? node.title.slice(0, 18) + '...' : node.title}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Full Note Detail Panel */}
          {selectedNode && (
            <div
              className="card"
              id="graph-node-detail-panel"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxHeight: 540,
                overflowY: 'auto',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                border: '1px solid var(--color-primary)'
              }}
            >
              {/* Panel Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <h3 style={{ fontSize: 18, color: 'var(--color-text)', wordBreak: 'break-word', margin: 0 }}>
                  {selectedNode.title}
                </h3>
                <button
                  id="close-node-details-btn"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedNode(null)}
                  style={{ padding: 4, height: 26, minHeight: 26, color: 'var(--color-text-muted)' }}
                  title="Close Details"
                  aria-label="Close note details"
                >
                  <CloseIcon size={16} />
                </button>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  id="graph-edit-note-btn"
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenNote(selectedNode.id, 'graph')}
                  style={{ flex: 1 }}
                >
                  <NotesIcon size={14} />
                  <span>Edit Note</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedNode(null)}
                >
                  Close
                </button>
              </div>

              {/* Resource URL (if present) */}
              {selectedNode.resourceUrl && (
                <div>
                  <a
                    href={selectedNode.resourceUrl.startsWith('http') ? selectedNode.resourceUrl : `https://${selectedNode.resourceUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="resource-link-chip"
                    title={selectedNode.resourceUrl}
                  >
                    <ExternalLinkIcon size={12} />
                    <span>{selectedNode.resourceUrl.replace(/^https?:\/\//, '').slice(0, 36)}</span>
                  </a>
                </div>
              )}

              {/* Tags Section */}
              {selectedNode.tags && selectedNode.tags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Tags:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedNode.tags.map(t => (
                      <span key={t} className="tag-badge">#{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Note Content */}
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  Note Content:
                </div>
                <div style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--color-text)',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  maxHeight: 160,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {selectedNode.content ? selectedNode.content : <em style={{ color: 'var(--color-text-muted)' }}>This note is empty.</em>}
                </div>
              </div>

              {/* Dynamic Related Notes Section */}
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Active Relationships & Connections:
                </div>

                {/* Explicit Links (solid violet indicator) */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-hover)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 3, backgroundColor: '#A78BFA', display: 'inline-block', borderRadius: 2 }} />
                    <span>Explicit Note Links ({explicitRelatedNotes.length})</span>
                  </div>
                  {explicitRelatedNotes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 16 }}>
                      {showExplicit ? 'No direct note links' : 'Explicit links filtered out'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 16 }}>
                      {explicitRelatedNotes.map(({ node: targetNote, label }) => (
                        <button
                          key={targetNote.id}
                          id={`related-explicit-note-${targetNote.id}`}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectNode(targetNote)}
                          title={label || `Direct link to "${targetNote.title}"`}
                          style={{ fontSize: 12, borderColor: '#A78BFA', color: '#A78BFA', height: 26, minHeight: 26 }}
                        >
                          ✓ {targetNote.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Content Mentions (dotted amber indicator) */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 2, borderTop: '2px dotted #FCD34D', display: 'inline-block' }} />
                    <span>Content Mentions ({contentMentionRelatedNotes.length})</span>
                  </div>
                  {contentMentionRelatedNotes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 16 }}>
                      {showContentMentions ? 'No content mentions' : 'Content mentions filtered out'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16 }}>
                      {contentMentionRelatedNotes.map(({ node: targetNote, label }) => (
                        <button
                          key={targetNote.id}
                          id={`related-mention-note-${targetNote.id}`}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSelectNode(targetNote)}
                          title={label}
                          style={{
                            fontSize: 12,
                            border: '1px dotted #FCD34D',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            textAlign: 'left',
                            height: 'auto',
                            padding: '4px 8px',
                            color: 'var(--color-text)'
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{targetNote.title}</span>
                          <span style={{ fontSize: 11, color: '#FCD34D' }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shared-Tag Connections (dashed sky indicator) */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#93C5FD', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 2, borderTop: '2px dashed #93C5FD', display: 'inline-block' }} />
                    <span>Shared-Tag Connections ({sharedTagRelatedNotes.length})</span>
                  </div>
                  {sharedTagRelatedNotes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', paddingLeft: 16 }}>
                      {showSharedTags ? 'No shared tag connections' : 'Shared tags filtered out'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16 }}>
                      {sharedTagRelatedNotes.map(({ node: targetNote, sharedTags, label }) => (
                        <button
                          key={targetNote.id}
                          id={`related-shared-tag-note-${targetNote.id}`}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleSelectNode(targetNote)}
                          title={label}
                          style={{
                            fontSize: 12,
                            border: '1px dashed #93C5FD',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            textAlign: 'left',
                            height: 'auto',
                            padding: '4px 8px'
                          }}
                        >
                          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{targetNote.title}</span>
                          <span style={{ fontSize: 11, color: '#93C5FD' }}>
                            {sharedTags.length > 0 ? `#${sharedTags.join(', #')}` : label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Timestamps */}
              {selectedNode.updatedAt && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 'auto' }}>
                  Last Modified: {new Date(selectedNode.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Explanatory footer rule */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Relationships are formed dynamically by explicit note links, content title references, [[wikilinks]], and shared tags.
      </div>
    </div>
  );
}
