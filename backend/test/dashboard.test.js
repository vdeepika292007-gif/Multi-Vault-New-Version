const assert = require('assert');
const http = require('http');
const store = require('../src/data/store');
const { app } = require('../src/server');

// Helper to make HTTP requests against express app
function createTestClient(server) {
  const port = server.address().port;
  return function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: `/api${path}`,
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve({ status: res.statusCode, data: parsed });
            } catch (err) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  };
}

async function runDashboardTests() {
  console.log('--- Testing Multi Vault Dashboard Metrics & Data Consistency ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const request = createTestClient(server);

  try {
    const timestamp = Date.now();

    // 1. Register User with 3 Notes (simulating user's exact workspace vault)
    const userEmail = `dashboard_tester_${timestamp}@multivault.local`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Dashboard Tester',
        email: userEmail,
        password: 'Password123!'
      }
    });
    assert.strictEqual(regRes.status, 201, 'User registration should succeed');
    const token = regRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Initial dashboard check: empty vault
    const initialDash = await request('/dashboard', { headers: authHeaders });
    assert.strictEqual(initialDash.status, 200);
    assert.strictEqual(initialDash.data.noteCount, 0, 'Initial noteCount should be 0');
    assert.strictEqual(initialDash.data.tagCount, 0, 'Initial tagCount should be 0');
    assert.strictEqual(initialDash.data.journalCount, 0, 'Initial journalCount should be 0');
    assert.strictEqual(initialDash.data.hasTodayJournal, false, 'hasTodayJournal should be false initially');
    assert.strictEqual(initialDash.data.recentNotes.length, 0, 'recentNotes should be empty initially');
    console.log('✓ 1. Initial empty dashboard verified (all counts 0, recentNotes empty)');

    // 3. Create Note 1: "Artificial Intelligence" with tags #learning, #ai
    const note1Res = await request('/notes', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Artificial Intelligence',
        content: 'AI enables machines to learn and problem-solve.',
        tags: ['#learning', 'ai']
      }
    });
    assert.strictEqual(note1Res.status, 201);

    // 4. Create Note 2: "Machine Learning" with tag #ml
    const note2Res = await request('/notes', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Machine Learning',
        content: 'Machine learning uses data to learn patterns.',
        tags: ['ml']
      }
    });
    assert.strictEqual(note2Res.status, 201);

    // 5. Create Note 3: "Neural Networks" with tag #neural-networks
    const note3Res = await request('/notes', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Neural Networks',
        content: 'Neural networks are machine learning models inspired by interconnected neurons.',
        tags: ['neural-networks']
      }
    });
    assert.strictEqual(note3Res.status, 201);
    console.log('✓ 2. Created 3 notes (Artificial Intelligence, Machine Learning, Neural Networks)');

    // 6. Check Dashboard after creating 3 notes
    const dashAfterNotes = await request('/dashboard', { headers: authHeaders });
    assert.strictEqual(dashAfterNotes.status, 200);
    assert.strictEqual(dashAfterNotes.data.noteCount, 3, 'Total notes should be 3');
    assert.strictEqual(dashAfterNotes.data.tagCount, 4, 'Active tags should be 4 (learning, ai, ml, neural-networks)');
    assert.strictEqual(dashAfterNotes.data.journalCount, 0, 'Journal count should be 0');
    assert.strictEqual(dashAfterNotes.data.hasTodayJournal, false);
    assert.strictEqual(dashAfterNotes.data.recentNotes.length, 3, 'recentNotes should contain all 3 notes');
    assert.strictEqual(dashAfterNotes.data.recentNotes[0].title, 'Neural Networks', 'Most recent note should be first');
    console.log('✓ 3. Dashboard counts verified for 3 notes: noteCount=3, tagCount=4, journalCount=0');

    // 7. Verify Data Consistency between Dashboard, Notes API, and Tags API
    const notesRes = await request('/notes', { headers: authHeaders });
    const tagsRes = await request('/tags', { headers: authHeaders });
    assert.strictEqual(dashAfterNotes.data.noteCount, notesRes.data.total, 'Dashboard noteCount must match Notes API total');
    assert.strictEqual(dashAfterNotes.data.tagCount, tagsRes.data.tags.length, 'Dashboard tagCount must match Tags API unique tags');
    console.log('✓ 4. Authoritative consistency confirmed: Dashboard metrics exactly match /api/notes and /api/tags');

    // 8. Add a Daily Journal entry
    const todayStr = new Date().toISOString().slice(0, 10);
    const journalRes = await request(`/journal/${todayStr}`, {
      method: 'PUT',
      headers: authHeaders,
      body: {
        content: 'Today I investigated machine learning concepts and neural networks architecture.',
        linkedNoteIds: [note2Res.data.note._id, note3Res.data.note._id]
      }
    });
    assert.strictEqual(journalRes.status, 200, 'Journal entry save should succeed');

    // 9. Check Dashboard after Daily Journal creation
    const dashAfterJournal = await request('/dashboard', { headers: authHeaders });
    assert.strictEqual(dashAfterJournal.status, 200);
    assert.strictEqual(dashAfterJournal.data.noteCount, 3);
    assert.strictEqual(dashAfterJournal.data.tagCount, 4);
    assert.strictEqual(dashAfterJournal.data.journalCount, 1, 'Journal count should be 1');
    assert.strictEqual(dashAfterJournal.data.hasTodayJournal, true, 'hasTodayJournal should be true for today');
    console.log('✓ 5. Dashboard updated with journal entry: journalCount=1, hasTodayJournal=true');

    // 10. Update/Edit a note (change title and add new tag)
    await request(`/notes/${note1Res.data.note._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: {
        title: 'Artificial Intelligence & Deep Learning',
        tags: ['learning', 'ai', 'deep-learning']
      }
    });

    const dashAfterEdit = await request('/dashboard', { headers: authHeaders });
    assert.strictEqual(dashAfterEdit.data.noteCount, 3, 'Note count should remain 3 after edit');
    assert.strictEqual(dashAfterEdit.data.tagCount, 5, 'Active tags should increase to 5 after adding tag');
    assert.strictEqual(dashAfterEdit.data.recentNotes[0].title, 'Artificial Intelligence & Deep Learning', 'Updated note should be top of recent notes');
    console.log('✓ 6. Dashboard dynamically reflects note edits: tagCount updated to 5, recentNotes reordered');

    // 11. Delete a note
    await request(`/notes/${note3Res.data.note._id}`, {
      method: 'DELETE',
      headers: authHeaders
    });

    const dashAfterDelete = await request('/dashboard', { headers: authHeaders });
    assert.strictEqual(dashAfterDelete.data.noteCount, 2, 'Note count should drop to 2 after deletion');
    assert.strictEqual(dashAfterDelete.data.tagCount, 4, 'Tag count should reflect remaining unique tags');
    assert.strictEqual(dashAfterDelete.data.recentNotes.length, 2);
    console.log('✓ 7. Dashboard dynamically updates after note deletion: noteCount=2, tagCount=4');

    // 12. User Isolation Check: User B sees only User B data
    const userBEmail = `dashboard_user_b_${timestamp}@multivault.local`;
    const regB = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'User B',
        email: userBEmail,
        password: 'Password123!'
      }
    });
    const tokenB = regB.data.token;
    const dashB = await request('/dashboard', { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.strictEqual(dashB.data.noteCount, 0, 'User B must not see User A notes');
    assert.strictEqual(dashB.data.tagCount, 0, 'User B must not see User A tags');
    assert.strictEqual(dashB.data.journalCount, 0, 'User B must not see User A journal');
    console.log('✓ 8. User isolation verified: User B dashboard has 0 notes, 0 tags, 0 journal entries');

    console.log('\n======================================================');
    console.log('  ALL DASHBOARD CONSISTENCY TESTS PASSED (8/8)        ');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runDashboardTests().catch(err => {
  console.error('\n❌ Dashboard test failed:', err);
  process.exit(1);
});
