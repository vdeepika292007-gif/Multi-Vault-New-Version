const assert = require('assert');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

async function runTests() {
  console.log('--- Starting Multi Vault Backend Automated Test Suite ---');
  await connectDB();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  let userAToken = '';
  let userBToken = '';
  let noteAId = '';

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health...');
    const health = await request('/health');
    assert.strictEqual(health.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.data.status, 'ok');
    console.log('   ✓ Health check passed.');

    // 2. Register User A
    console.log('2. Testing POST /api/auth/register (User A)...');
    const emailA = `test_a_${Date.now()}@multivault.local`;
    const regA = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Alice Vault', email: emailA, password: 'password123' }
    });
    assert.strictEqual(regA.status, 201, 'User A registration should return 201');
    assert.ok(regA.data.token, 'Should return JWT token');
    userAToken = regA.data.token;
    console.log('   ✓ User A registration passed.');

    // 3. Prevent duplicate email registration
    console.log('3. Testing duplicate email prevention...');
    const regDup = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Alice Clone', email: emailA, password: 'password123' }
    });
    assert.strictEqual(regDup.status, 409, 'Duplicate email must return 409 Conflict');
    console.log('   ✓ Duplicate email prevention passed.');

    // 4. Login User A
    console.log('4. Testing POST /api/auth/login...');
    const loginA = await request('/auth/login', {
      method: 'POST',
      body: { email: emailA, password: 'password123' }
    });
    assert.strictEqual(loginA.status, 200, 'Login should return 200');
    assert.ok(loginA.data.token, 'Login should return JWT');
    console.log('   ✓ User A login passed.');

    // 5. Authenticated Profile GET /api/auth/me
    console.log('5. Testing GET /api/auth/me...');
    const meA = await request('/auth/me', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(meA.status, 200);
    assert.strictEqual(meA.data.user.email, emailA);
    console.log('   ✓ GET /api/auth/me passed.');

    // 6. Reject unauthenticated access
    console.log('6. Testing unauthenticated rejection (401)...');
    const unauth = await request('/notes');
    assert.strictEqual(unauth.status, 401, 'Accessing /notes without token must return 401');
    console.log('   ✓ Unauthenticated rejection passed.');

    // 7. Register User B for isolation testing
    console.log('7. Registering User B for user data isolation tests...');
    const emailB = `test_b_${Date.now()}@multivault.local`;
    const regB = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Bob Vault', email: emailB, password: 'password456' }
    });
    assert.strictEqual(regB.status, 201);
    userBToken = regB.data.token;
    console.log('   ✓ User B registered.');

    // 8. Note Creation for User A
    console.log('8. Testing POST /api/notes (User A note with tags & resourceUrl)...');
    const createNoteA = await request('/notes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Architecture Overview',
        content: 'This note covers the Multi Vault design and structure.',
        resourceUrl: 'https://obsidian.md',
        tags: ['Architecture', 'Vault', 'React']
      }
    });
    assert.strictEqual(createNoteA.status, 201);
    assert.strictEqual(createNoteA.data.note.title, 'Architecture Overview');
    assert.strictEqual(createNoteA.data.note.resourceUrl, 'https://obsidian.md');
    noteAId = String(createNoteA.data.note._id || createNoteA.data.note.id);
    console.log('   ✓ Note created for User A.');

    // 9. Enforce User Data Isolation: User B cannot view User A's note
    console.log("9. Testing User Data Isolation (User B cannot access User A's note)...");
    const isolationGet = await request(`/notes/${noteAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(isolationGet.status, 404, "User B must receive 404 for User A's note");

    const isolationNotes = await request('/notes', {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(isolationNotes.data.notes.length, 0, "User B's notes list must be empty");
    console.log('   ✓ User data isolation verified.');

    // 10. Note Search & Tag Filter for User A
    console.log('10. Testing Note Search & Tag filtering...');
    const searchRes = await request('/notes?search=Architecture', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(searchRes.data.notes.length, 1);

    const tagRes = await request('/notes?tag=vault', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(tagRes.data.notes.length, 1);
    console.log('   ✓ Note search and tag filter passed.');

    // 11. Tags Aggregation
    console.log('11. Testing GET /api/tags...');
    const tagsRes = await request('/tags', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(tagsRes.status, 200);
    assert.ok(tagsRes.data.tags.some(t => t.tag === 'architecture'));
    console.log('   ✓ Tags aggregation passed.');

    // 12. Daily Journal: Unique per date per user & Upsert
    console.log('12. Testing Daily Journal PUT & GET /api/journal/:date...');
    const today = new Date().toISOString().slice(0, 10);
    const journalPut1 = await request(`/journal/${today}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { content: 'Productive day setting up Multi Vault.' }
    });
    assert.strictEqual(journalPut1.status, 200);
    assert.strictEqual(journalPut1.data.entry.entryDate, today);

    // Update same date (upsert) with linked note
    const journalPut2 = await request(`/journal/${today}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { content: 'Productive day setting up Multi Vault. Added comprehensive tests.', linkedNoteIds: [noteAId] }
    });
    assert.strictEqual(journalPut2.status, 200);
    assert.ok(Array.isArray(journalPut2.data.entry.linkedNoteIds));
    assert.strictEqual(journalPut2.data.entry.linkedNoteIds[0], noteAId);

    const journalGet = await request(`/journal?date=${today}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(journalGet.status, 200);
    assert.ok(journalGet.data.entry.content.includes('comprehensive tests'));
    console.log('   ✓ Daily Journal unique per user per date verified.');

    // 13. Dashboard real metrics
    console.log('13. Testing GET /api/dashboard...');
    const dashRes = await request('/dashboard', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.data.noteCount, 1);
    assert.strictEqual(dashRes.data.journalCount, 1);
    assert.strictEqual(dashRes.data.hasTodayJournal, true);
    console.log('   ✓ Dashboard real metrics verified.');

    // 14. Knowledge Graph
    console.log('14. Testing GET /api/graph...');
    // Create a 2nd note with shared tag to verify graph edge
    await request('/notes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Design System Notes',
        content: 'Exploration of the Obsidian Vault palette and typography.',
        tags: ['Architecture', 'Design']
      }
    });

    const graphRes = await request('/graph', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(graphRes.status, 200);
    assert.strictEqual(graphRes.data.nodes.length, 2);
    assert.ok(graphRes.data.edges.length >= 1, 'Graph should compute shared tag edge between notes');
    console.log('   ✓ Knowledge graph nodes & edges verified.');

    // 15. Settings GET & PATCH
    console.log('15. Testing GET & PATCH /api/settings...');
    const settingsGet = await request('/settings', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(settingsGet.status, 200);

    const settingsPatch = await request('/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { theme: 'violet', defaultSort: 'title_asc' }
    });
    assert.strictEqual(settingsPatch.status, 200);
    assert.strictEqual(settingsPatch.data.settings.theme, 'violet');
    assert.strictEqual(settingsPatch.data.settings.defaultSort, 'title_asc');
    console.log('   ✓ Settings API verified.');

    console.log('\n======================================================');
    console.log('  ALL BACKEND TESTS PASSED SUCCESSFULLY! (15/15)      ');
    console.log('======================================================');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
