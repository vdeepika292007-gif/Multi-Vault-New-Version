const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dbState } = require('../config/db');
const User = require('../models/User');
const Note = require('../models/Note');
const JournalEntry = require('../models/JournalEntry');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'multivault_db.json');

// Helper for embedded storage
function readEmbeddedData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { users: [], notes: [], journal: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading embedded db:', err);
    return { users: [], notes: [], journal: [] };
  }
}

function writeEmbeddedData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing embedded db:', err);
  }
}

function normalizeTag(tag) {
  if (!tag) return '';
  if (typeof tag === 'object' && tag !== null) {
    tag = tag.tag || tag.name || tag.label || tag.value || '';
  }
  if (typeof tag !== 'string') return '';
  return tag.trim().toLowerCase().replace(/^#+/, '');
}

function normalizeTags(tags) {
  if (!tags) return [];
  let rawList = [];
  if (Array.isArray(tags)) {
    rawList = tags;
  } else if (typeof tags === 'string') {
    rawList = tags.split(/[,;\s]+/);
  } else {
    return [];
  }

  const set = new Set();
  rawList.forEach(t => {
    if (!t) return;
    if (typeof t === 'object' && t !== null) {
      t = t.tag || t.name || t.label || t.value || '';
    }
    if (typeof t === 'string') {
      const parts = t.split(/[,;\s]+/);
      parts.forEach(p => {
        const norm = normalizeTag(p);
        if (norm) set.add(norm);
      });
    }
  });
  return Array.from(set);
}

// ---------------- USER OPERATIONS ----------------
async function findUserByEmail(email) {
  const normEmail = (email || '').trim().toLowerCase();
  if (dbState.mode === 'mongodb') {
    return await User.findOne({ email: normEmail });
  }
  const data = readEmbeddedData();
  return data.users.find(u => u.email.toLowerCase() === normEmail) || null;
}

async function findUserById(id) {
  if (dbState.mode === 'mongodb') {
    return await User.findById(id).select('-passwordHash');
  }
  const data = readEmbeddedData();
  const u = data.users.find(u => u._id === id || u.id === id);
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

async function createUser({ name, email, passwordHash, preferences }) {
  const normEmail = (email || '').trim().toLowerCase();
  if (dbState.mode === 'mongodb') {
    const user = new User({
      name: name.trim(),
      email: normEmail,
      passwordHash,
      preferences: preferences || {}
    });
    return await user.save();
  }
  const data = readEmbeddedData();
  if (data.users.some(u => u.email.toLowerCase() === normEmail)) {
    const err = new Error('Email is already registered');
    err.code = 11000;
    throw err;
  }
  const newUser = {
    _id: crypto.randomBytes(12).toString('hex'),
    name: name.trim(),
    email: normEmail,
    passwordHash,
    preferences: {
      theme: 'obsidian',
      defaultSort: 'updatedAt_desc',
      graphShowSharedTags: true,
      ...(preferences || {})
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.users.push(newUser);
  writeEmbeddedData(data);
  const { passwordHash: _, ...safeUser } = newUser;
  return safeUser;
}

async function updateUserPreferences(userId, preferences) {
  if (dbState.mode === 'mongodb') {
    const user = await User.findById(userId);
    if (!user) return null;
    user.preferences = { ...user.preferences, ...preferences };
    await user.save();
    return user.preferences;
  }
  const data = readEmbeddedData();
  const user = data.users.find(u => u._id === userId || u.id === userId);
  if (!user) return null;
  user.preferences = { ...(user.preferences || {}), ...preferences };
  user.updatedAt = new Date().toISOString();
  writeEmbeddedData(data);
  return user.preferences;
}

// ---------------- NOTE OPERATIONS ----------------
async function findNotes(userId, { search = '', tag = '', sort = 'updatedAt_desc' }) {
  const normTag = normalizeTag(tag);
  const searchRegex = search.trim();

  if (dbState.mode === 'mongodb') {
    const query = { userId };
    if (normTag) {
      query.tags = normTag;
    }
    if (searchRegex) {
      query.$or = [
        { title: { $regex: searchRegex, $options: 'i' } },
        { content: { $regex: searchRegex, $options: 'i' } }
      ];
    }
    let sortObj = { updatedAt: -1 };
    if (sort === 'updatedAt_asc') sortObj = { updatedAt: 1 };
    else if (sort === 'title_asc') sortObj = { title: 1 };
    else if (sort === 'title_desc') sortObj = { title: -1 };
    else if (sort === 'createdAt_desc') sortObj = { createdAt: -1 };

    return await Note.find(query).sort(sortObj);
  }

  const data = readEmbeddedData();
  let list = data.notes.filter(n => String(n.userId) === String(userId));

  if (normTag) {
    list = list.filter(n => (n.tags || []).includes(normTag));
  }

  if (searchRegex) {
    const q = searchRegex.toLowerCase();
    list = list.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => {
    if (sort === 'updatedAt_asc') return new Date(a.updatedAt) - new Date(b.updatedAt);
    if (sort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
    if (sort === 'title_desc') return (b.title || '').localeCompare(a.title || '');
    if (sort === 'createdAt_desc') return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return list;
}

async function findNoteById(userId, noteId) {
  if (dbState.mode === 'mongodb') {
    return await Note.findOne({ _id: noteId, userId });
  }
  const data = readEmbeddedData();
  return data.notes.find(n => (n._id === noteId || n.id === noteId) && String(n.userId) === String(userId)) || null;
}

async function createNote({ userId, title, content = '', resourceUrl = '', tags = [], linkedNoteIds = [] }) {
  const cleanTags = normalizeTags(tags);
  const cleanResourceUrl = (resourceUrl || '').trim();
  const cleanLinkedNoteIds = Array.isArray(linkedNoteIds)
    ? linkedNoteIds.map(id => String(id._id || id.id || id)).filter(Boolean)
    : [];

  if (dbState.mode === 'mongodb') {
    const note = new Note({
      userId,
      title: title.trim(),
      content: content || '',
      resourceUrl: cleanResourceUrl,
      tags: cleanTags,
      linkedNoteIds: cleanLinkedNoteIds
    });
    const saved = await note.save();
    // Maintain bidirectional references for target notes
    if (cleanLinkedNoteIds.length > 0) {
      await Note.updateMany(
        { _id: { $in: cleanLinkedNoteIds }, userId },
        { $addToSet: { linkedNoteIds: saved._id } }
      );
    }
    return saved;
  }

  const data = readEmbeddedData();
  const newNoteId = crypto.randomBytes(12).toString('hex');
  const newNote = {
    _id: newNoteId,
    userId: String(userId),
    title: title.trim(),
    content: content || '',
    resourceUrl: cleanResourceUrl,
    tags: cleanTags,
    linkedNoteIds: cleanLinkedNoteIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.notes.push(newNote);

  // Maintain bidirectional references in embedded storage
  if (cleanLinkedNoteIds.length > 0) {
    cleanLinkedNoteIds.forEach(targetId => {
      const target = data.notes.find(n => (n._id === targetId || n.id === targetId) && String(n.userId) === String(userId));
      if (target) {
        target.linkedNoteIds = target.linkedNoteIds || [];
        if (!target.linkedNoteIds.includes(newNoteId)) {
          target.linkedNoteIds.push(newNoteId);
        }
      }
    });
  }

  writeEmbeddedData(data);
  return newNote;
}

async function updateNote(userId, noteId, updates) {
  const cleanUpdates = {};
  if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
  if (updates.content !== undefined) cleanUpdates.content = updates.content;
  if (updates.resourceUrl !== undefined) cleanUpdates.resourceUrl = (updates.resourceUrl || '').trim();
  if (updates.tags !== undefined) cleanUpdates.tags = normalizeTags(updates.tags);
  if (updates.linkedNoteIds !== undefined) {
    cleanUpdates.linkedNoteIds = Array.isArray(updates.linkedNoteIds)
      ? updates.linkedNoteIds.map(id => String(id._id || id.id || id)).filter(Boolean)
      : [];
  }

  if (dbState.mode === 'mongodb') {
    const existing = await Note.findOne({ _id: noteId, userId });
    if (!existing) return null;

    if (cleanUpdates.linkedNoteIds !== undefined) {
      const prevLinked = (existing.linkedNoteIds || []).map(String);
      const newLinked = cleanUpdates.linkedNoteIds;
      const added = newLinked.filter(id => !prevLinked.includes(id));
      const removed = prevLinked.filter(id => !newLinked.includes(id));

      if (added.length > 0) {
        await Note.updateMany(
          { _id: { $in: added }, userId },
          { $addToSet: { linkedNoteIds: noteId } }
        );
      }
      if (removed.length > 0) {
        await Note.updateMany(
          { _id: { $in: removed }, userId },
          { $pull: { linkedNoteIds: noteId } }
        );
      }
    }

    return await Note.findOneAndUpdate(
      { _id: noteId, userId },
      { $set: cleanUpdates },
      { new: true, runValidators: true }
    );
  }

  const data = readEmbeddedData();
  const noteIndex = data.notes.findIndex(n => (n._id === noteId || n.id === noteId) && String(n.userId) === String(userId));
  if (noteIndex === -1) return null;

  if (cleanUpdates.linkedNoteIds !== undefined) {
    const prevLinked = (data.notes[noteIndex].linkedNoteIds || []).map(id => String(id._id || id.id || id));
    const newLinked = cleanUpdates.linkedNoteIds;
    const added = newLinked.filter(id => !prevLinked.includes(id));
    const removed = prevLinked.filter(id => !newLinked.includes(id));

    added.forEach(targetId => {
      const target = data.notes.find(n => (n._id === targetId || n.id === targetId) && String(n.userId) === String(userId));
      if (target) {
        target.linkedNoteIds = target.linkedNoteIds || [];
        if (!target.linkedNoteIds.includes(String(noteId))) {
          target.linkedNoteIds.push(String(noteId));
        }
      }
    });

    removed.forEach(targetId => {
      const target = data.notes.find(n => (n._id === targetId || n.id === targetId) && String(n.userId) === String(userId));
      if (target && target.linkedNoteIds) {
        target.linkedNoteIds = target.linkedNoteIds.filter(id => id !== String(noteId));
      }
    });
  }

  data.notes[noteIndex] = {
    ...data.notes[noteIndex],
    ...cleanUpdates,
    updatedAt: new Date().toISOString()
  };
  writeEmbeddedData(data);
  return data.notes[noteIndex];
}

async function deleteNote(userId, noteId) {
  if (dbState.mode === 'mongodb') {
    await Note.updateMany(
      { userId, linkedNoteIds: noteId },
      { $pull: { linkedNoteIds: noteId } }
    );
    return await Note.findOneAndDelete({ _id: noteId, userId });
  }

  const data = readEmbeddedData();
  const initialLength = data.notes.length;
  data.notes = data.notes.filter(n => !((n._id === noteId || n.id === noteId) && String(n.userId) === String(userId)));
  if (data.notes.length < initialLength) {
    // Clean up references to deleted note in remaining notes
    data.notes.forEach(n => {
      if (n.linkedNoteIds) {
        n.linkedNoteIds = n.linkedNoteIds.filter(id => String(id) !== String(noteId));
      }
    });
    writeEmbeddedData(data);
    return true;
  }
  return false;
}

// ---------------- TAG OPERATIONS ----------------
async function getTags(userId) {
  let notes = [];
  if (dbState.mode === 'mongodb') {
    notes = await Note.find({ userId }).select('tags');
  } else {
    const data = readEmbeddedData();
    notes = data.notes.filter(n => String(n.userId) === String(userId));
  }

  const tagCounts = {};
  notes.forEach(note => {
    (note.tags || []).forEach(tag => {
      const norm = normalizeTag(tag);
      if (norm) {
        tagCounts[norm] = (tagCounts[norm] || 0) + 1;
      }
    });
  });

  return Object.keys(tagCounts)
    .sort()
    .map(tag => ({ tag, count: tagCounts[tag] }));
}

// ---------------- JOURNAL OPERATIONS ----------------
async function getJournalEntry(userId, entryDate) {
  if (dbState.mode === 'mongodb') {
    return await JournalEntry.findOne({ userId, entryDate });
  }
  const data = readEmbeddedData();
  return data.journal.find(j => String(j.userId) === String(userId) && j.entryDate === entryDate) || null;
}

async function getJournalHistory(userId) {
  if (dbState.mode === 'mongodb') {
    return await JournalEntry.find({ userId }).sort({ entryDate: -1 }).limit(30);
  }
  const data = readEmbeddedData();
  const list = data.journal.filter(j => String(j.userId) === String(userId));
  list.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  return list.slice(0, 30);
}

async function upsertJournalEntry(userId, entryDate, content, linkedNoteIds = []) {
  const cleanLinked = Array.isArray(linkedNoteIds) ? linkedNoteIds : [];
  if (dbState.mode === 'mongodb') {
    return await JournalEntry.findOneAndUpdate(
      { userId, entryDate },
      { $set: { content: content || '', linkedNoteIds: cleanLinked } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  const data = readEmbeddedData();
  const index = data.journal.findIndex(j => String(j.userId) === String(userId) && j.entryDate === entryDate);
  const now = new Date().toISOString();

  if (index !== -1) {
    data.journal[index].content = content || '';
    data.journal[index].linkedNoteIds = cleanLinked;
    data.journal[index].updatedAt = now;
    writeEmbeddedData(data);
    return data.journal[index];
  } else {
    const newEntry = {
      _id: crypto.randomBytes(12).toString('hex'),
      userId: String(userId),
      entryDate,
      content: content || '',
      linkedNoteIds: cleanLinked,
      createdAt: now,
      updatedAt: now
    };
    data.journal.push(newEntry);
    writeEmbeddedData(data);
    return newEntry;
  }
}

// ---------------- DASHBOARD METRICS ----------------
async function getDashboardMetrics(userId) {
  let notes = [];
  let journalCount = 0;
  let todayJournal = null;
  const todayStr = new Date().toISOString().slice(0, 10);

  if (dbState.mode === 'mongodb') {
    notes = await Note.find({ userId }).sort({ updatedAt: -1 });
    journalCount = await JournalEntry.countDocuments({ userId });
    todayJournal = await JournalEntry.findOne({ userId, entryDate: todayStr });
  } else {
    const data = readEmbeddedData();
    notes = (data.notes || []).filter(n => String(n.userId) === String(userId));
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const userJournal = (data.journal || []).filter(j => String(j.userId) === String(userId));
    journalCount = userJournal.length;
    todayJournal = userJournal.find(j => j.entryDate === todayStr) || null;
  }

  const tagSet = new Set();
  notes.forEach(n => {
    (n.tags || []).forEach(t => {
      const norm = normalizeTag(t);
      if (norm) tagSet.add(norm);
    });
  });

  return {
    noteCount: notes.length,
    tagCount: tagSet.size,
    journalCount,
    hasTodayJournal: !!todayJournal,
    recentNotes: notes.slice(0, 5).map(n => ({
      _id: n._id || n.id,
      title: n.title,
      tags: n.tags || [],
      updatedAt: n.updatedAt,
      contentSnippet: (n.content || '').slice(0, 120)
    }))
  };
}

// Helpers for dynamic knowledge graph relationship detection
const COMMON_STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'with', 'from', 'this', 'that', 'have', 'what', 'some', 'note', 'notes', 'tags'
]);

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function cleanNoteTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\s*(?:copy\s*(?:title|content|code|note)?|\(?copy\)?)$/i, '')
    .replace(/^[#\s]+/, '')
    .trim();
}

function isMeaningfulTitle(title) {
  if (!title || typeof title !== 'string') return false;
  const clean = cleanNoteTitle(title);
  if (clean.length < 2) return false;
  if (clean.length === 2) {
    // Recognize uppercase acronyms like AI, ML, UI, UX, OS, DB
    return clean === clean.toUpperCase() && !COMMON_STOP_WORDS.has(clean.toLowerCase());
  }
  const words = clean.split(/\s+/);
  if (words.length === 1 && COMMON_STOP_WORDS.has(words[0].toLowerCase())) {
    return false;
  }
  return true;
}

function getTitleCandidates(title) {
  if (!title || typeof title !== 'string') return [];
  const clean = cleanNoteTitle(title);
  if (!clean || !isMeaningfulTitle(clean)) return [];

  const candidates = new Set();
  candidates.add(clean);

  // 1. Strip common qualification suffixes (e.g., "Fundamentals", "Explained", "Basics", "Overview", "Notes")
  const stripped = clean.replace(
    /\s+(?:fundamentals|explained|basics|overview|introduction|guide|notes|tutorial|cheatsheet|handbook|reference|concepts|principles)\b/gi,
    ''
  ).trim();
  if (stripped && isMeaningfulTitle(stripped) && stripped !== clean) {
    candidates.add(stripped);
  }

  // 2. Subtitle prefix before colon or hyphen (e.g. "Topic: Subtitle" -> "Topic")
  const prefix = clean.split(/[:\-–—]/)[0].trim();
  if (prefix && isMeaningfulTitle(prefix) && prefix !== clean) {
    candidates.add(prefix);
  }

  // 3. Recognized uppercase abbreviations for multi-word titles (e.g. "Artificial Intelligence" -> "AI")
  const words = clean.split(/\s+/).filter(w => !COMMON_STOP_WORDS.has(w.toLowerCase()));
  if (words.length >= 2 && words.length <= 3) {
    const acronym = words.map(w => w[0].toUpperCase()).join('');
    if (acronym.length === 2 && ['AI', 'ML', 'DL', 'NN', 'CV', 'NLP', 'RL', 'OS', 'UI', 'UX', 'DB', 'IP', 'QA'].includes(acronym)) {
      candidates.add(acronym);
    }
  }

  return Array.from(candidates);
}

function findContentMention(sourceContent, targetTitle) {
  if (!sourceContent || typeof sourceContent !== 'string') return null;
  const candidates = getTitleCandidates(targetTitle);
  for (const cand of candidates) {
    const isAcronym = cand.length <= 4 && cand === cand.toUpperCase() && !cand.includes(' ');
    const pattern = isAcronym
      ? new RegExp('(^|\\W)' + cand + '($|\\W)')
      : new RegExp('(^|\\W)' + escapeRegex(cand) + '($|\\W)', 'i');
    if (pattern.test(sourceContent)) {
      return cand;
    }
  }
  return null;
}

function extractWikilinks(content) {
  if (!content || typeof content !== 'string') return [];
  const matches = [];
  const wikiRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
  let m;
  while ((m = wikiRegex.exec(content)) !== null) {
    const target = m[1].trim();
    if (target) matches.push(target.toLowerCase());
  }
  return matches;
}

// ---------------- KNOWLEDGE GRAPH ----------------
async function getGraphData(userId, filters = {}) {
  let rawNotes = [];
  if (dbState.mode === 'mongodb') {
    rawNotes = await Note.find({ userId }).select('_id title content resourceUrl tags linkedNoteIds createdAt updatedAt');
  } else {
    const data = readEmbeddedData();
    rawNotes = data.notes.filter(n => String(n.userId) === String(userId));
  }

  // Load user preferences for default graph settings if not explicitly passed
  let userPrefSharedTags = true;
  if (dbState.mode === 'mongodb') {
    try {
      const u = await User.findById(userId).select('preferences');
      if (u?.preferences?.graphShowSharedTags !== undefined) {
        userPrefSharedTags = Boolean(u.preferences.graphShowSharedTags);
      }
    } catch (e) {}
  } else {
    const data = readEmbeddedData();
    const u = data.users.find(u => u._id === userId || u.id === userId);
    if (u?.preferences?.graphShowSharedTags !== undefined) {
      userPrefSharedTags = Boolean(u.preferences.graphShowSharedTags);
    }
  }

  const activeFilters = {
    explicit: filters.explicit !== undefined ? Boolean(filters.explicit) : true,
    contentMentions: filters.contentMentions !== undefined ? Boolean(filters.contentMentions) : true,
    sharedTags: filters.sharedTags !== undefined ? Boolean(filters.sharedTags) : userPrefSharedTags
  };

  // 1. Build standardized nodes array representing user's actual saved notes
  const nodes = rawNotes.map(n => {
    const id = String(n._id || n.id);
    const rawLinked = Array.isArray(n.linkedNoteIds) ? n.linkedNoteIds : [];
    const linkedNoteIds = rawLinked.map(target => String(target._id || target.id || target)).filter(Boolean);
    const tags = normalizeTags(n.tags);

    return {
      id,
      title: n.title ? cleanNoteTitle(n.title) : 'Untitled Note',
      rawTitle: n.title || 'Untitled Note',
      content: n.content || '',
      resourceUrl: n.resourceUrl ? n.resourceUrl.trim() : '',
      tags,
      linkedNoteIds,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      linkCount: 0
    };
  });

  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const allEdges = [];
  const edgeSet = new Set();
  const counts = {
    explicit: 0,
    contentMentions: 0,
    sharedTags: 0,
    total: 0
  };

  // 2. Dynamically evaluate relationships across all unique node pairs (O(N^2) for user vault)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const key = [nodeA.id, nodeB.id].sort().join('--');

      if (edgeSet.has(key)) continue;

      const reasons = [];
      let sharedTags = [];

      // Rule A: Explicit note-to-note reference in linkedNoteIds
      const isExplicit =
        nodeA.linkedNoteIds.includes(nodeB.id) ||
        nodeB.linkedNoteIds.includes(nodeA.id);
      if (isExplicit) {
        reasons.push({ type: 'explicit', label: 'Explicit note link' });
      }

      // Rule B: Obsidian-style [[Wikilinks]] in content
      const aWikis = extractWikilinks(nodeA.content);
      const bWikis = extractWikilinks(nodeB.content);
      const bCandidates = getTitleCandidates(nodeB.rawTitle || nodeB.title).map(c => c.toLowerCase());
      const aCandidates = getTitleCandidates(nodeA.rawTitle || nodeA.title).map(c => c.toLowerCase());
      const isWikiLinked =
        aWikis.some(w => bCandidates.includes(w) || w === nodeB.id.toLowerCase()) ||
        bWikis.some(w => aCandidates.includes(w) || w === nodeA.id.toLowerCase());
      if (isWikiLinked) {
        reasons.push({ type: 'explicit', label: 'Wikilink [[cross-reference]]' });
      }

      // Rule C: Meaningful title mentions on word boundaries in content
      const mentionInA = findContentMention(nodeA.content, nodeB.rawTitle || nodeB.title);
      const mentionInB = findContentMention(nodeB.content, nodeA.rawTitle || nodeA.title);
      if (mentionInA) {
        reasons.push({ type: 'content-mention', label: `Mentioned "${mentionInA}" in content` });
      } else if (mentionInB) {
        reasons.push({ type: 'content-mention', label: `Mentioned "${mentionInB}" in content` });
      }

      // Rule D: Shared normalized tags
      const tagsA = new Set(nodeA.tags || []);
      const commonTags = (nodeB.tags || []).filter(t => tagsA.has(t));
      if (commonTags.length > 0) {
        sharedTags = commonTags;
        reasons.push({
          type: 'shared-tag',
          label: `Shared tags: #${commonTags.join(', #')}`,
          sharedTags: commonTags
        });
      }

      // Rule E: Shared external reference URL
      const urlA = (nodeA.resourceUrl || '').toLowerCase();
      const urlB = (nodeB.resourceUrl || '').toLowerCase();
      if (urlA && urlB && urlA === urlB) {
        reasons.push({
          type: 'shared-resource',
          label: `Shared reference URL: ${nodeA.resourceUrl}`
        });
      }

      // If one or more genuine relationships exist, form an edge
      if (reasons.length > 0) {
        edgeSet.add(key);
        counts.total++;

        const availableTypes = reasons.map(r => r.type);
        if (availableTypes.includes('explicit')) counts.explicit++;
        if (availableTypes.includes('content-mention')) counts.contentMentions++;
        if (availableTypes.some(t => t === 'shared-tag' || t === 'shared-resource')) counts.sharedTags++;

        // Filter active reasons based on activeFilters
        const activeReasons = reasons.filter(r => {
          if (r.type === 'explicit') return activeFilters.explicit;
          if (r.type === 'content-mention') return activeFilters.contentMentions;
          if (r.type === 'shared-tag' || r.type === 'shared-resource') return activeFilters.sharedTags;
          return true;
        });

        // Determine primary type among ACTIVE reasons (or fallback to primary available reason)
        const reasonsToType = activeReasons.length > 0 ? activeReasons : reasons;
        let primaryType = 'shared-tag';
        if (reasonsToType.some(r => r.type === 'explicit')) {
          primaryType = 'explicit';
        } else if (reasonsToType.some(r => r.type === 'content-mention')) {
          primaryType = 'content-mention';
        } else if (reasonsToType.some(r => r.type === 'shared-tag')) {
          primaryType = 'shared-tag';
        } else {
          primaryType = 'shared-resource';
        }

        const primaryReason = reasonsToType.find(r => r.type === primaryType) || reasonsToType[0];
        const isVisible = activeReasons.length > 0;

        const edgeObj = {
          id: `edge-${key}`,
          source: nodeA.id,
          target: nodeB.id,
          type: primaryType,
          types: availableTypes,
          label: primaryReason.label,
          sharedTags,
          allReasons: reasons.map(r => r.label),
          visible: isVisible
        };

        allEdges.push(edgeObj);

        if (isVisible) {
          nodeA.linkCount++;
          nodeB.linkCount++;
        }
      }
    }
  }

  // Only return active/visible edges in edges array to satisfy exclusion of unselected relationship types
  const edges = allEdges.filter(e => e.visible);

  return {
    nodes,
    edges,
    allEdges,
    counts,
    filters: activeFilters,
    connectionRules: [
      {
        type: 'explicit',
        label: 'Explicit Note Link',
        description: 'Direct note reference chosen in the note editor or [[wikilink]] in markdown.'
      },
      {
        type: 'content-mention',
        label: 'Content Reference',
        description: 'Note body references the title of another note.'
      },
      {
        type: 'shared-tag',
        label: 'Shared Tags',
        description: 'Notes categorized under one or more identical #tags.'
      },
      {
        type: 'shared-resource',
        label: 'Shared Resource',
        description: 'Notes citing the exact same external web reference or documentation URL.'
      }
    ]
  };
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPreferences,
  findNotes,
  findNoteById,
  createNote,
  updateNote,
  deleteNote,
  getTags,
  getJournalEntry,
  getJournalHistory,
  upsertJournalEntry,
  getDashboardMetrics,
  getGraphData,
  normalizeTag,
  normalizeTags
};
