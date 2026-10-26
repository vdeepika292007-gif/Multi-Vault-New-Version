const assert = require('assert');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

async function runE2EWorkflowTests() {
  console.log('--- Starting Multi Vault Usability & E2E Workflow Test ---');
  await connectDB();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  async function req(endpoint, options = {}) {
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

  try {
    // 1. Register test user
    const email = `workflow_${Date.now()}@multivault.test`;
    console.log(`1. Authenticating test user: ${email}...`);
    const regRes = await req('/auth/register', {
      method: 'POST',
      body: { name: 'Workflow Tester', email, password: 'password123' }
    });
    assert.strictEqual(regRes.status, 201, 'User registration failed');
    const token = regRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log('   ✓ User authenticated.');

    // 2. Initial dashboard state
    console.log('2. Checking initial dashboard metrics...');
    const initialDash = await req('/dashboard', { headers: authHeaders });
    assert.strictEqual(initialDash.status, 200);
    assert.strictEqual(initialDash.data.noteCount, 0, 'Initial note count should be 0');
    assert.strictEqual(initialDash.data.tagCount, 0, 'Initial tag count should be 0');
    assert.strictEqual(initialDash.data.journalCount, 0, 'Initial journal count should be 0');
    assert.strictEqual(initialDash.data.hasTodayJournal, false);
    console.log('   ✓ Initial dashboard counts verified.');

    // 3. Create a note with title, content, resourceUrl, and multiple tags
    console.log('3. Creating note with title, content, resourceUrl, and tags...');
    const createNoteRes = await req('/notes', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Obsidian Usability & Navigation Guide',
        content: 'Comprehensive reference for save-and-exit workflows and tag chips.',
        resourceUrl: 'https://obsidian.md/help',
        tags: ['Architecture', 'Vault', 'Usability']
      }
    });
    assert.strictEqual(createNoteRes.status, 201, 'Note creation failed');
    assert.strictEqual(createNoteRes.data.note.title, 'Obsidian Usability & Navigation Guide');
    assert.strictEqual(createNoteRes.data.note.resourceUrl, 'https://obsidian.md/help');
    assert.deepStrictEqual(
      createNoteRes.data.note.tags.sort(),
      ['architecture', 'usability', 'vault'].sort(),
      'Tags must be normalized lowercase without duplicates'
    );
    const note1Id = String(createNoteRes.data.note._id || createNoteRes.data.note.id);
    console.log('   ✓ Note successfully created with resourceUrl and normalized tags.');

    // 4. Verify note and tags in All Notes view
    console.log('4. Verifying note appears in All Notes with tag filtering...');
    const allNotes = await req('/notes', { headers: authHeaders });
    assert.strictEqual(allNotes.status, 200);
    assert.strictEqual(allNotes.data.notes.length, 1);
    assert.strictEqual(allNotes.data.notes[0].resourceUrl, 'https://obsidian.md/help');

    const filterByTag = await req('/notes?tag=usability', { headers: authHeaders });
    assert.strictEqual(filterByTag.data.notes.length, 1);
    console.log('   ✓ Note and tags correctly queried and filtered.');

    // 5. Test error validation when saving fails (content preserved)
    console.log('5. Testing save error validation on empty title...');
    const failedSave = await req(`/notes/${note1Id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: { title: '   ' }
    });
    assert.strictEqual(failedSave.status, 400, 'Empty title must return 400');
    assert.ok(failedSave.data.error, 'Error message must be returned');

    // Confirm original note remains intact
    const verifyIntact = await req(`/notes/${note1Id}`, { headers: authHeaders });
    assert.strictEqual(verifyIntact.data.note.title, 'Obsidian Usability & Navigation Guide');
    console.log('   ✓ Failed save validation confirmed; existing data preserved.');

    // 6. Edit the note, change tags and resourceUrl, and save again
    console.log('6. Editing note with modified tags and resourceUrl...');
    const updateRes = await req(`/notes/${note1Id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: {
        title: 'Obsidian Usability & Navigation Guide (Updated)',
        content: 'Updated content with new tags.',
        resourceUrl: 'https://help.obsidian.md',
        tags: ['vault', 'workflow', 'navigation']
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.note.title, 'Obsidian Usability & Navigation Guide (Updated)');
    assert.strictEqual(updateRes.data.note.resourceUrl, 'https://help.obsidian.md');
    assert.deepStrictEqual(
      updateRes.data.note.tags.sort(),
      ['navigation', 'vault', 'workflow'].sort()
    );
    console.log('   ✓ Note updated and saved successfully.');

    // 7. Check tags aggregation
    console.log('7. Checking updated tags overview...');
    const tagsRes = await req('/tags', { headers: authHeaders });
    assert.strictEqual(tagsRes.status, 200);
    const tagNames = tagsRes.data.tags.map(t => t.tag);
    assert.ok(tagNames.includes('navigation'));
    assert.ok(tagNames.includes('vault'));
    assert.ok(tagNames.includes('workflow'));
    assert.ok(!tagNames.includes('architecture'), 'Old removed tag with 0 notes should not linger');
    console.log('   ✓ Tags aggregation accurately reflects changes.');

    // 8. Create and save Daily Journal entry linked to note
    console.log('8. Creating Daily Journal entry with linked note...');
    const today = new Date().toISOString().slice(0, 10);
    const journalRes = await req(`/journal/${today}`, {
      method: 'PUT',
      headers: authHeaders,
      body: {
        content: 'Verified save and exit navigation, resourceUrl, and tag chips.',
        linkedNoteIds: [note1Id]
      }
    });
    assert.strictEqual(journalRes.status, 200);
    assert.strictEqual(journalRes.data.entry.entryDate, today);
    assert.ok(journalRes.data.entry.content.includes('save and exit navigation'));
    assert.ok(Array.isArray(journalRes.data.entry.linkedNoteIds));
    assert.strictEqual(journalRes.data.entry.linkedNoteIds[0], note1Id);
    console.log('   ✓ Journal entry saved with linked note connection.');

    // 9. Verify persistence by reading back journal entry
    console.log('9. Verifying journal entry persistence...');
    const getJournal = await req(`/journal?date=${today}`, { headers: authHeaders });
    assert.strictEqual(getJournal.status, 200);
    assert.strictEqual(getJournal.data.entry.entryDate, today);
    assert.strictEqual(getJournal.data.entry.linkedNoteIds[0], note1Id);
    console.log('   ✓ Journal entry persistence verified.');

    // 10. Verify updated dashboard metrics
    console.log('10. Verifying dashboard metrics after note & journal updates...');
    const updatedDash = await req('/dashboard', { headers: authHeaders });
    assert.strictEqual(updatedDash.status, 200);
    assert.strictEqual(updatedDash.data.noteCount, 1, 'Note count must be 1');
    assert.strictEqual(updatedDash.data.tagCount, 3, 'Tag count must be 3');
    assert.strictEqual(updatedDash.data.journalCount, 1, 'Journal count must be 1');
    assert.strictEqual(updatedDash.data.hasTodayJournal, true, 'hasTodayJournal must be true');
    assert.strictEqual(updatedDash.data.recentNotes.length, 1);
    console.log('   ✓ Dashboard metrics accurately updated without stale state.');

    // 11. Verify Knowledge Graph still functions with real notes and links
    console.log('11. Verifying Knowledge Graph integrity...');
    // Create a 2nd note with shared tag 'vault' to create an edge
    const note2Res = await req('/notes', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'Vault Index',
        content: 'Index note for vault topics.',
        tags: ['vault'],
        linkedNoteIds: [note1Id]
      }
    });
    assert.strictEqual(note2Res.status, 201);

    const graphRes = await req('/graph', { headers: authHeaders });
    assert.strictEqual(graphRes.status, 200);
    assert.strictEqual(graphRes.data.nodes.length, 2);
    assert.ok(graphRes.data.edges.length >= 1, 'Graph should compute real relationship edges');
    assert.ok(graphRes.data.connectionRules.length >= 2, 'Connection rules must be intact');
    console.log('   ✓ Knowledge Graph structure and relationships intact.');

    console.log('\n==========================================================');
    console.log('  ALL WORKFLOW AND USABILITY TESTS PASSED! (11/11)        ');
    console.log('==========================================================');
  } finally {
    server.close();
  }
}

runE2EWorkflowTests().catch(err => {
  console.error('\n❌ E2E Workflow Test Failed:', err);
  process.exit(1);
});
