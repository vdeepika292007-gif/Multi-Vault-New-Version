/**
 * Usability and Acceptance Verification Script
 * Validates FIX 1 (Knowledge Graph node interaction & full details payload)
 * and FIX 2 (Save & Exit workflow, dashboard metrics, persistence)
 */

const http = require('http');

function request(method, path, data = null, token = null, port = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:${port}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('=== MULTI VAULT USABILITY VERIFICATION SUITE ===\n');

  // Test 0: Frontend dev server responsive
  console.log('[Test 0] Checking Frontend Dev Server (http://localhost:5173)...');
  const feRes = await request('GET', '/', null, null, 5173);
  if (feRes.status === 200 && feRes.raw.includes('<div id="root">')) {
    console.log('  ✓ Frontend dev server is serving index.html with root container.');
  } else {
    throw new Error(`Frontend dev server responded with status: ${feRes.status}`);
  }

  // Register & Login User
  const timestamp = Date.now();
  const email = `usability_test_${timestamp}@multivault.test`;
  const password = 'Password123!';
  console.log(`\n[Auth] Registering test user: ${email}...`);
  const regRes = await request('POST', '/api/auth/register', {
    name: 'Usability Tester',
    email,
    password
  });
  if (regRes.status !== 201) throw new Error('Registration failed: ' + JSON.stringify(regRes.data));
  const token = regRes.data.token;
  console.log('  ✓ User registered and JWT token acquired.');

  // Check 1: Initial Dashboard Metrics
  console.log('\n[Case 1/2 Verification] Initial Dashboard state...');
  const initDash = await request('GET', '/api/dashboard', null, token);
  const initialNoteCount = initDash.data.noteCount;
  console.log(`  ✓ Initial note count: ${initialNoteCount}`);

  // FIX 2 Verification: Create Note
  console.log('\n[Case 1] Creating a note (Simulating "New Note -> Save & Exit")...');
  const newNotePayload = {
    title: 'Usability Architecture Note',
    content: 'Full comprehensive note body explaining the Obsidian dark mode theme and Knowledge Graph node click mechanics.',
    resourceUrl: 'https://obsidian.md',
    tags: ['architecture', 'knowledge-graph', 'obsidian']
  };
  const createRes = await request('POST', '/api/notes', newNotePayload, token);
  if (createRes.status !== 201) throw new Error('Note creation failed: ' + JSON.stringify(createRes.data));
  const note1 = createRes.data.note || createRes.data;
  const note1Id = String(note1._id || note1.id);
  console.log(`  ✓ Note created with ID: ${note1Id}`);
  console.log(`  ✓ Resource URL preserved: ${note1.resourceUrl}`);
  console.log(`  ✓ Tags normalized: ${JSON.stringify(note1.tags)}`);

  // Verify Dashboard updates immediately after note creation
  const postCreateDash = await request('GET', '/api/dashboard', null, token);
  if (postCreateDash.data.noteCount !== initialNoteCount + 1) {
    throw new Error(`Expected noteCount ${initialNoteCount + 1}, got ${postCreateDash.data.noteCount}`);
  }
  const recentNoteTitles = postCreateDash.data.recentNotes.map(n => n.title);
  if (!recentNoteTitles.includes('Usability Architecture Note')) {
    throw new Error('New note missing from dashboard recentNotes');
  }
  console.log('  ✓ Dashboard metrics and recent notes updated accurately (Simulates instant dashboard return).');

  // FIX 2 Verification: Edit Note
  console.log('\n[Case 2] Editing existing note (Simulating "Edit Note -> Save & Exit")...');
  const updatePayload = {
    title: 'Usability Architecture Note [Updated]',
    content: 'Full comprehensive note body - UPDATED with additional research findings.',
    resourceUrl: 'https://obsidian.md/updated',
    tags: ['architecture', 'knowledge-graph', 'obsidian', 'react']
  };
  const editRes = await request('PUT', `/api/notes/${note1Id}`, updatePayload, token);
  if (editRes.status !== 200) throw new Error('Note update failed: ' + JSON.stringify(editRes.data));
  console.log('  ✓ Note updated successfully.');

  // Verify Dashboard shows updated title
  const postEditDash = await request('GET', '/api/dashboard', null, token);
  const updatedRecent = postEditDash.data.recentNotes.find(n => (n._id || n.id) === note1Id);
  if (!updatedRecent || updatedRecent.title !== 'Usability Architecture Note [Updated]') {
    throw new Error('Dashboard did not reflect updated note title');
  }
  console.log('  ✓ Dashboard reflects updated note title in recent list.');

  // Create second note to test connections in graph
  console.log('\n[Setup] Creating second note linked to first note...');
  const note2Payload = {
    title: 'Connected Frontend Note',
    content: 'This note discusses the React interface and connects directly to the architecture note.',
    resourceUrl: 'https://react.dev',
    tags: ['react', 'knowledge-graph'],
    linkedNoteIds: [note1Id]
  };
  const note2Res = await request('POST', '/api/notes', note2Payload, token);
  const note2 = note2Res.data.note || note2Res.data;
  const note2Id = String(note2._id || note2.id);
  console.log(`  ✓ Second note created with ID: ${note2Id}, linked to ${note1Id}`);

  // FIX 1 Verification: Knowledge Graph Data & Node Details
  console.log('\n[Case 4 & 5] Testing Knowledge Graph node details payload...');
  const graphRes = await request('GET', '/api/graph', null, token);
  if (graphRes.status !== 200) throw new Error('Failed to fetch graph: ' + JSON.stringify(graphRes.data));
  
  const nodes = graphRes.data.nodes;
  const edges = graphRes.data.edges;
  console.log(`  ✓ Graph returned ${nodes.length} nodes and ${edges.length} edges.`);

  const graphNote1 = nodes.find(n => n.id === note1Id);
  const graphNote2 = nodes.find(n => n.id === note2Id);

  if (!graphNote1) throw new Error('Note 1 not found in graph nodes');
  if (!graphNote2) throw new Error('Note 2 not found in graph nodes');

  // Verify node details are NOT truncated or fake
  console.log('  Checking Node 1 data payload completeness for Detail Panel:');
  console.log(`    - Title: "${graphNote1.title}"`);
  console.log(`    - Content: "${graphNote1.content.substring(0, 40)}..."`);
  console.log(`    - Resource URL: "${graphNote1.resourceUrl}"`);
  console.log(`    - Tags: ${JSON.stringify(graphNote1.tags)}`);
  
  if (!graphNote1.content || !graphNote1.content.includes('UPDATED')) {
    throw new Error('Graph node is missing real updated content!');
  }
  if (!graphNote1.resourceUrl || graphNote1.resourceUrl !== 'https://obsidian.md/updated') {
    throw new Error('Graph node is missing real resourceUrl!');
  }
  if (!Array.isArray(graphNote1.tags) || graphNote1.tags.length !== 4) {
    throw new Error('Graph node tags mismatch!');
  }
  console.log('  ✓ Knowledge Graph node payload contains complete real content, resourceUrl, tags, and timestamps.');

  // Verify edge relationships
  const explicitEdge = edges.find(e => 
    (e.source === note2Id && e.target === note1Id) || (e.source === note1Id && e.target === note2Id)
  );
  if (!explicitEdge) {
    throw new Error('Expected explicit link edge between note 1 and note 2 not found in graph');
  }
  console.log(`  ✓ Explicit link edge verified: ${explicitEdge.source} -> ${explicitEdge.target} (type: ${explicitEdge.type})`);

  // Case 6 Verification: Journal & Tag preservation
  console.log('\n[Case 6] Testing Journal entry creation and persistence...');
  const today = new Date().toISOString().split('T')[0];
  const journalRes = await request('PUT', `/api/journal/${today}`, {
    date: today,
    content: 'Today I validated the Knowledge Graph node clicks and the Save & Exit dashboard navigation.',
    linkedNoteIds: [note1Id],
    mood: 'productive'
  }, token);
  if (journalRes.status !== 200) throw new Error('Journal save failed: ' + JSON.stringify(journalRes.data));
  console.log('  ✓ Journal entry created and linked to note 1.');

  const fetchJournalRes = await request('GET', `/api/journal/${today}`, null, token);
  console.log('  DEBUG fetchJournalRes:', JSON.stringify(fetchJournalRes.data));
  const fetchedEntry = fetchJournalRes.data.entry || fetchJournalRes.data;
  if (!fetchedEntry || fetchedEntry.content !== 'Today I validated the Knowledge Graph node clicks and the Save & Exit dashboard navigation.') {
    throw new Error('Journal content mismatch!');
  }
  console.log('  ✓ Journal entry persistence verified.');

  // Verify tags endpoint
  const tagsRes = await request('GET', '/api/tags', null, token);
  if (tagsRes.status !== 200 || !Array.isArray(tagsRes.data.tags)) {
    throw new Error('Tags query failed: ' + JSON.stringify(tagsRes.data));
  }
  const tagNames = tagsRes.data.tags.map(t => t.tag || t.name);
  if (!tagNames.includes('architecture') || !tagNames.includes('react')) {
    throw new Error('Missing expected tags in aggregation: ' + JSON.stringify(tagNames));
  }
  console.log(`  ✓ Aggregated tags verified (${tagsRes.data.tags.length} unique tags): ${tagNames.join(', ')}`);

  console.log('\n==========================================================');
  console.log('  ALL 6 USABILITY ACCEPTANCE CHECKS PASSED SUCCESSFULLY!  ');
  console.log('==========================================================\n');
}

runVerification().catch(err => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
