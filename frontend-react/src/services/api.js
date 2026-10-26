const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('multivault_token') || '';
}

function setToken(token) {
  if (token) {
    localStorage.setItem('multivault_token', token);
  } else {
    localStorage.removeItem('multivault_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = data.code;
    throw err;
  }

  return data;
}

export const api = {
  getToken,
  setToken,

  // Auth
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => {
    setToken('');
    return request('/auth/logout', { method: 'POST' }).catch(() => ({}));
  },
  getMe: () => request('/auth/me'),

  // Notes
  getNotes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.tag) query.set('tag', params.tag);
    if (params.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return request(`/notes${qs ? `?${qs}` : ''}`);
  },
  getNote: (id) => request(`/notes/${id}`),
  createNote: (noteData) =>
    request('/notes', { method: 'POST', body: noteData }),
  updateNote: (id, updates) =>
    request(`/notes/${id}`, { method: 'PATCH', body: updates }),
  deleteNote: (id) =>
    request(`/notes/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => request('/tags'),

  // Daily Journal
  getJournalEntry: (date) => request(`/journal?date=${date}`),
  getJournalHistory: () => request('/journal'),
  saveJournalEntry: (date, content, linkedNoteIds = []) =>
    request(`/journal/${date}`, { method: 'PUT', body: { content, linkedNoteIds } }),

  getGraph: (filters = {}) => {
    const query = new URLSearchParams();
    if (filters.explicit !== undefined) query.set('explicit', String(filters.explicit));
    if (filters.contentMentions !== undefined) query.set('contentMentions', String(filters.contentMentions));
    if (filters.sharedTags !== undefined) query.set('sharedTags', String(filters.sharedTags));
    const qs = query.toString();
    return request(`/graph${qs ? `?${qs}` : ''}`);
  },

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (settings) =>
    request('/settings', { method: 'PATCH', body: settings }),

  // Dashboard
  getDashboard: () => request('/dashboard')
};
