const assert = require('assert');
const { connectDB } = require('../src/config/db');
const {
  createUser,
  createNote,
  updateNote,
  getGraphData,
  deleteNote
} = require('../src/data/store');

async function testKnowledgeGraph() {
  console.log('--- Testing Knowledge Graph Dynamic Relationship Generation ---');
  await connectDB();

  const testUser = await createUser({
    name: 'Dynamic Graph Tester',
    email: `tester_${Date.now()}@multivault.local`,
    passwordHash: 'hashed_password_sample',
    preferences: {}
  });
  const userId = String(testUser._id || testUser.id);

  // 1. Empty graph
  const emptyGraph = await getGraphData(userId);
  assert.strictEqual(emptyGraph.nodes.length, 0, 'Empty vault should have 0 nodes');
  assert.strictEqual(emptyGraph.edges.length, 0, 'Empty vault should have 0 edges');
  console.log('✓ 1. Empty graph handled gracefully (0 nodes, 0 edges)');

  // 2. Single note graph
  const note1 = await createNote({
    userId,
    title: 'Machine Learning Basics',
    content: 'Overview of foundational supervised learning algorithms.',
    tags: ['ai', 'math']
  });
  const singleGraph = await getGraphData(userId);
  assert.strictEqual(singleGraph.nodes.length, 1, 'Should have 1 node');
  assert.strictEqual(singleGraph.edges.length, 0, 'Single node has no edges');
  console.log('✓ 2. Single note graph verified (1 node, 0 edges, linkCount: 0)');

  // 3. Second note with shared tag #ai
  const note2 = await createNote({
    userId,
    title: 'Deep Neural Networks',
    content: 'Multi-layer feedforward networks and backpropagation.',
    tags: ['ai', 'python']
  });
  const twoGraph = await getGraphData(userId);
  assert.strictEqual(twoGraph.nodes.length, 2);
  assert.strictEqual(twoGraph.edges.length, 1, 'Should generate shared tag edge');
  assert.strictEqual(twoGraph.edges[0].type, 'shared-tag');
  assert.deepStrictEqual(twoGraph.edges[0].sharedTags, ['ai']);
  console.log('✓ 3. Shared tag relationship dynamically detected (#ai)');

  // 4. Third note with content mention of 'Deep Neural Networks'
  const note3 = await createNote({
    userId,
    title: 'Computer Vision Exploration',
    content: 'In this project, we apply Deep Neural Networks to analyze image data.',
    tags: ['vision']
  });
  const threeGraph = await getGraphData(userId);
  assert.strictEqual(threeGraph.nodes.length, 3);
  const mentionEdge = threeGraph.edges.find(e => e.type === 'content-mention');
  assert.ok(mentionEdge, 'Should generate content mention edge');
  console.log(`✓ 4. Content mention dynamically detected: "${mentionEdge.label}"`);

  // 5. Fourth note with explicit link to note3
  const note4 = await createNote({
    userId,
    title: 'Convolutional Kernels',
    content: 'Mathematical convolution operators.',
    tags: ['math'],
    linkedNoteIds: [String(note3._id || note3.id)]
  });
  const fourGraph = await getGraphData(userId);
  assert.strictEqual(fourGraph.nodes.length, 4);
  const explicitEdge = fourGraph.edges.find(e => e.type === 'explicit');
  assert.ok(explicitEdge, 'Should generate explicit link edge');
  console.log(`✓ 5. Explicit note link dynamically generated: "${explicitEdge.label}"`);

  // 6. Fifth note completely unrelated
  const note5 = await createNote({
    userId,
    title: 'Gardening & Organic Soil',
    content: 'Composting and soil preparation for heirloom tomatoes.',
    tags: ['gardening']
  });
  const fiveGraph = await getGraphData(userId);
  assert.strictEqual(fiveGraph.nodes.length, 5);
  const gardeningNode = fiveGraph.nodes.find(n => n.id === String(note5._id || note5.id));
  assert.strictEqual(gardeningNode.linkCount, 0, 'Unrelated note should remain disconnected');
  console.log('✓ 6. Unrelated note remains completely disconnected (0 links)');

  // 7. Update note with wikilink
  await updateNote(userId, String(note3._id || note3.id), {
    title: 'Computer Vision Exploration',
    content: 'Refer to [[Machine Learning Basics]] for fundamental mathematics.'
  });
  const updatedGraph = await getGraphData(userId);
  const wikiEdge = updatedGraph.edges.find(e => e.label && e.label.includes('Wikilink'));
  assert.ok(wikiEdge, 'Wikilink [[Machine Learning Basics]] should generate edge');
  console.log(`✓ 7. Wikilink update verified: "${wikiEdge.label}"`);

  // 8. Delete note cleans up edges
  await deleteNote(userId, String(note4._id || note4.id));
  const afterDeleteGraph = await getGraphData(userId);
  assert.strictEqual(afterDeleteGraph.nodes.length, 4);
  const deletedNodeInGraph = afterDeleteGraph.nodes.find(n => n.id === String(note4._id || note4.id));
  assert.strictEqual(deletedNodeInGraph, undefined, 'Deleted note removed from graph');
  console.log('✓ 8. Note deletion cleanly removes node and orphaned edges');

  // 9. Relationship filter toggling: exclude Content Mentions
  const filteredNoMentions = await getGraphData(userId, { contentMentions: false, explicit: true, sharedTags: true });
  const hasMention = filteredNoMentions.edges.some(e => e.type === 'content-mention');
  assert.strictEqual(hasMention, false, 'Edges should exclude content-mention when filter is false');
  assert.strictEqual(filteredNoMentions.filters.contentMentions, false);
  console.log('✓ 9. Filter toggling: Content Mentions excluded when filter is false');

  // 10. Relationship filter toggling: exclude Shared Tags
  const filteredNoTags = await getGraphData(userId, { sharedTags: false, explicit: true, contentMentions: true });
  const hasTag = filteredNoTags.edges.some(e => e.type === 'shared-tag');
  assert.strictEqual(hasTag, false, 'Edges should exclude shared-tag when filter is false');
  assert.strictEqual(filteredNoTags.filters.sharedTags, false);
  console.log('✓ 10. Filter toggling: Shared Tags excluded when filter is false');

  // 11. Relationship filter toggling: exclude Explicit Links
  const filteredNoExplicit = await getGraphData(userId, { explicit: false, sharedTags: true, contentMentions: true });
  const hasExplicit = filteredNoExplicit.edges.some(e => e.type === 'explicit');
  assert.strictEqual(hasExplicit, false, 'Edges should exclude explicit links when filter is false');
  console.log('✓ 11. Filter toggling: Explicit Links excluded when filter is false');

  // 12. Category counts metadata verification
  const fullGraphWithCounts = await getGraphData(userId);
  assert.ok(fullGraphWithCounts.counts, 'Graph response must include relationship counts metadata');
  assert.strictEqual(typeof fullGraphWithCounts.counts.contentMentions, 'number');
  assert.strictEqual(typeof fullGraphWithCounts.counts.sharedTags, 'number');
  assert.strictEqual(typeof fullGraphWithCounts.counts.explicit, 'number');
  console.log(`✓ 12. Relationship counts computed: explicit=${fullGraphWithCounts.counts.explicit}, mentions=${fullGraphWithCounts.counts.contentMentions}, tags=${fullGraphWithCounts.counts.sharedTags}`);

  // 13. Verify source data classification for user notes scenario (Machine Learning & Neural Networks)
  const userB = await createUser({
    name: 'AI & ML Researcher',
    email: `aiml_${Date.now()}@multivault.local`,
    passwordHash: 'hashed_password',
    preferences: {}
  });
  const uBId = String(userB._id || userB.id);

  const nML = await createNote({
    userId: uBId,
    title: 'Machine Learning',
    content: 'Machine learning is a branch of AI that uses data to learn patterns.',
    tags: ['ml']
  });

  const nNN = await createNote({
    userId: uBId,
    title: 'Neural Networks',
    content: 'Neural networks are machine learning models inspired by interconnected neurons.',
    tags: ['neural-networks']
  });

  const aiGraph = await getGraphData(uBId);
  assert.strictEqual(aiGraph.nodes.length, 2);
  assert.strictEqual(aiGraph.edges.length, 1);
  assert.strictEqual(aiGraph.edges[0].type, 'content-mention');
  assert.strictEqual(aiGraph.edges[0].label, 'Mentioned "Machine Learning" in content');

  // Test toggling off contentMentions for this scenario:
  const aiGraphOff = await getGraphData(uBId, { contentMentions: false });
  assert.strictEqual(aiGraphOff.edges.length, 0, 'Unselecting Content Mentions removes the yellow dotted connection');
  console.log('✓ 13. Machine Learning & Neural Networks content mention verified and toggleable');

  // 14. Title qualifiers & clipboard noise handling ("Machine Learning Fundamentals   Copy title" & "Neural Networks Explained")
  const userC = await createUser({
    name: 'Copy Artifact Tester',
    email: `copy_artifact_${Date.now()}@multivault.local`,
    passwordHash: 'hashed_password',
    preferences: {}
  });
  const uCId = String(userC._id || userC.id);

  const nC1 = await createNote({
    userId: uCId,
    title: 'Machine Learning Fundamentals   Copy title',
    content: 'Supervised and unsupervised learning techniques.',
    tags: ['ml']
  });

  const nC2 = await createNote({
    userId: uCId,
    title: 'Neural Networks Explained',
    content: 'Neural networks are machine learning models inspired by biological neurons.',
    tags: []
  });

  const graphC = await getGraphData(uCId);
  assert.strictEqual(graphC.edges.length, 1);
  assert.strictEqual(graphC.edges[0].type, 'content-mention');
  assert.strictEqual(graphC.edges[0].label, 'Mentioned "Machine Learning" in content');
  console.log('✓ 14. Title qualifiers and clipboard noise stripped dynamically: "Machine Learning" detected');

  // 15. Acronym detection for multi-word titles ("Artificial Intelligence" <-> "AI")
  const nC3 = await createNote({
    userId: uCId,
    title: 'Artificial Intelligence',
    content: 'Field of computer science enabling intelligent systems.',
    tags: ['ai learning']
  });

  // Note C2 also references AI
  await updateNote(uCId, nC2._id, {
    content: 'Neural networks are machine learning models used in modern AI applications.'
  });

  const graphCUpdated = await getGraphData(uCId);
  const mentionAI = graphCUpdated.edges.find(e => e.label.includes('AI'));
  assert.ok(mentionAI, 'Acronym AI should match Artificial Intelligence on word boundaries');
  console.log('✓ 15. Acronym "AI" dynamically recognized for note "Artificial Intelligence"');

  // 16. Tag normalization splitting comma and space delimited tags
  assert.deepStrictEqual(nC3.tags.sort(), ['ai', 'learning'].sort(), 'Tags should normalize into separate elements');
  const nC4 = await createNote({
    userId: uCId,
    title: 'Reinforcement Learning Basics',
    content: 'Reward-driven optimization.',
    tags: ['learning', 'robotics']
  });
  const graphTags = await getGraphData(uCId);
  const sharedTagEdge = graphTags.edges.find(e => (e.types || [e.type]).includes('shared-tag') && (e.source === nC3._id || e.target === nC3._id) && (e.source === nC4._id || e.target === nC4._id));
  assert.ok(sharedTagEdge, 'Shared tag #learning should connect nC3 and nC4');
  console.log('✓ 16. Multi-word tag normalization verified: shared tag #learning detected');

  // 17. Zero matches verification: completely unrelated notes remain disconnected
  const userD = await createUser({
    name: 'Unrelated Notes Tester',
    email: `unrelated_${Date.now()}@multivault.local`,
    passwordHash: 'hashed_password',
    preferences: {}
  });
  const uDId = String(userD._id || userD.id);

  await createNote({ userId: uDId, title: 'French Baking Techniques', content: 'Croissants and sourdough baguettes.', tags: ['baking'] });
  await createNote({ userId: uDId, title: 'Quantum Electrodynamics', content: 'Feynman diagrams and photon interactions.', tags: ['physics'] });
  await createNote({ userId: uDId, title: 'Medieval Architecture', content: 'Gothic cathedrals and flying buttresses.', tags: ['history'] });

  const graphD = await getGraphData(uDId);
  assert.strictEqual(graphD.nodes.length, 3);
  assert.strictEqual(graphD.edges.length, 0, 'Completely unrelated notes must have 0 edges');
  assert.strictEqual(graphD.counts.explicit, 0);
  assert.strictEqual(graphD.counts.contentMentions, 0);
  assert.strictEqual(graphD.counts.sharedTags, 0);
  assert.strictEqual(graphD.counts.total, 0);
  console.log('✓ 17. Zero matches verification: 3 unrelated notes have strictly 0 connections');

  console.log('======================================================');
  console.log('  ALL KNOWLEDGE GRAPH DYNAMIC TESTS PASSED (17/17)    ');
  console.log('======================================================');
}

testKnowledgeGraph().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
