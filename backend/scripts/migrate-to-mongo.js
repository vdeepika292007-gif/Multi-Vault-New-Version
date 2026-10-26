/**
 * Multi Vault: Strict Clean-Import JSON-to-MongoDB Data Migration Script
 * 
 * Safety & Integrity Constraints:
 * 1. Clean Initial Import Only: Aborts before any writes if target collections contain any records.
 * 2. Strict Exact-Value Preservation: Never normalizes, lowers, trims, or substitutes default values
 *    for missing fields. Preserves source JSON field presence and values verbatim.
 * 3. Pruned Stale Note References: Retains only valid, resolvable linkedNoteIds that match source notes.
 *    Logs explicit warnings for every missing reference without corrupting or dropping journal entries.
 * 4. Deep Record-Level Verification: Verifies all fields (IDs, timestamps, password hashes,
 *    preferences, content, resource URLs, tags, linkedNoteIds, entryDate, userId) field-by-field.
 * 5. Partial-Failure Recovery: Tracks write progress and provides an explicit manual recovery procedure
 *    without automatically deleting or clearing records on failure.
 * 6. Connection Safety: Always disconnects MongoDB cleanly inside a `finally` block on success or error.
 * 7. Sequential Pre-flight: All validation and target-collection checks finish before the first write.
 * 8. Read-only Source: NEVER modifies, writes to, or deletes multivault_db.json or backup files.
 * 9. Insert-Only: Uses collection.insertMany exclusively. No updates, deletes, drops, or overwrites.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Mongoose Models
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const JournalEntry = require('../src/models/JournalEntry');

// Paths
const JSON_DB_PATH = path.join(__dirname, '..', 'data', 'multivault_db.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multivault';

async function runMigration() {
  console.log('================================================================');
  console.log('    MULTI VAULT: STRICT INITIAL JSON -> MONGODB MIGRATION       ');
  console.log('================================================================\n');

  let connectionOpened = false;
  const writeProgress = {
    usersInserted: 0,
    notesInserted: 0,
    journalsInserted: 0,
    indexesCreated: false
  };

  try {
    // -------------------------------------------------------------
    // STEP 1: LOAD & PARSE SOURCE JSON (READ-ONLY)
    // -------------------------------------------------------------
    console.log('[Step 1/7] Loading source JSON database in read-only mode...');
    if (!fs.existsSync(JSON_DB_PATH)) {
      console.error(`FATAL ERROR: Source file not found: ${JSON_DB_PATH}`);
      process.exitCode = 1;
      return;
    }

    let rawData;
    try {
      const fileContent = fs.readFileSync(JSON_DB_PATH, 'utf8');
      rawData = JSON.parse(fileContent);
    } catch (err) {
      console.error(`FATAL ERROR: Failed to parse ${JSON_DB_PATH}:`, err.message);
      process.exitCode = 1;
      return;
    }

    const users = rawData.users || [];
    const notes = rawData.notes || [];
    const journals = rawData.journal || rawData.journalEntries || [];

    console.log(`  Source JSON file loaded:`);
    console.log(`    - Users:           ${users.length}`);
    console.log(`    - Notes:           ${notes.length}`);
    console.log(`    - Journal Entries: ${journals.length}\n`);

    if (users.length === 0 && notes.length === 0) {
      console.warn('WARNING: Source JSON contains 0 users and 0 notes. Nothing to migrate.');
      return;
    }

    // -------------------------------------------------------------
    // STEP 2: PRE-FLIGHT DATA INTEGRITY & REFERENTIAL CHECKS
    // -------------------------------------------------------------
    console.log('[Step 2/7] Running comprehensive pre-flight integrity & reference validation...');
    const validationErrors = [];
    const missingNoteReferences = [];

    const userIds = new Set();
    const noteIds = new Set();

    // 2a. Validate Users
    users.forEach((u, i) => {
      if (!u._id || !mongoose.Types.ObjectId.isValid(u._id)) {
        validationErrors.push(`User [${i}]: Invalid _id format "${u._id}"`);
      } else {
        userIds.add(String(u._id));
      }
      if (!u.name || typeof u.name !== 'string') {
        validationErrors.push(`User [${i}] (${u.email || u._id}): Name must be a non-empty string`);
      } else if (u.name.length > 100) {
        validationErrors.push(`User [${i}] (${u.email || u._id}): Name exceeds 100 characters (${u.name.length})`);
      }
      if (!u.email || !/^\S+@\S+\.\S+$/.test(u.email)) {
        validationErrors.push(`User [${i}] (${u.name || u._id}): Invalid email format "${u.email}"`);
      }
      if (!u.passwordHash || typeof u.passwordHash !== 'string' || u.passwordHash.length < 8) {
        validationErrors.push(`User [${i}] (${u.email}): Missing or invalid passwordHash`);
      }
      if (u.preferences) {
        if (u.preferences.theme && !['dark', 'obsidian', 'violet'].includes(u.preferences.theme)) {
          validationErrors.push(`User [${i}] (${u.email}): Incompatible theme value "${u.preferences.theme}"`);
        }
        if (u.preferences.defaultSort && !['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc'].includes(u.preferences.defaultSort)) {
          validationErrors.push(`User [${i}] (${u.email}): Incompatible defaultSort value "${u.preferences.defaultSort}"`);
        }
        if (u.preferences.graphShowSharedTags !== undefined && typeof u.preferences.graphShowSharedTags !== 'boolean') {
          validationErrors.push(`User [${i}] (${u.email}): Incompatible graphShowSharedTags value (expected boolean)`);
        }
      }
      if (u.createdAt && isNaN(new Date(u.createdAt).getTime())) {
        validationErrors.push(`User [${i}] (${u.email}): Invalid createdAt date "${u.createdAt}"`);
      }
      if (u.updatedAt && isNaN(new Date(u.updatedAt).getTime())) {
        validationErrors.push(`User [${i}] (${u.email}): Invalid updatedAt date "${u.updatedAt}"`);
      }
    });

    // 2b. Validate Notes
    notes.forEach((n, i) => {
      if (!n._id || !mongoose.Types.ObjectId.isValid(n._id)) {
        validationErrors.push(`Note [${i}]: Invalid _id format "${n._id}"`);
      } else {
        noteIds.add(String(n._id));
      }
      if (!n.userId || !mongoose.Types.ObjectId.isValid(n.userId)) {
        validationErrors.push(`Note [${i}] ("${n.title}"): Invalid userId "${n.userId}"`);
      } else if (!userIds.has(String(n.userId))) {
        validationErrors.push(`Note [${i}] ("${n.title}"): Orphaned note! Referenced userId "${n.userId}" does not exist in source users`);
      }
      if (!n.title || typeof n.title !== 'string') {
        validationErrors.push(`Note [${i}] (${n._id}): Title must be a non-empty string`);
      } else if (n.title.length > 200) {
        validationErrors.push(`Note [${i}] (${n._id}): Title exceeds 200 characters (${n.title.length})`);
      }
      if (n.tags !== undefined && !Array.isArray(n.tags)) {
        validationErrors.push(`Note [${i}] ("${n.title}"): Tags must be an array`);
      }
      if (n.createdAt && isNaN(new Date(n.createdAt).getTime())) {
        validationErrors.push(`Note [${i}] ("${n.title}"): Invalid createdAt date "${n.createdAt}"`);
      }
      if (n.updatedAt && isNaN(new Date(n.updatedAt).getTime())) {
        validationErrors.push(`Note [${i}] ("${n.title}"): Invalid updatedAt date "${n.updatedAt}"`);
      }
    });

    // 2c. Enforce Note LinkedNoteIds Format and Detect Stale Note References
    notes.forEach((n, i) => {
      (n.linkedNoteIds || []).forEach(lid => {
        if (!mongoose.Types.ObjectId.isValid(lid)) {
          validationErrors.push(`Note [${i}] ("${n.title}"): Invalid linkedNoteId format "${lid}"`);
        } else if (!noteIds.has(String(lid))) {
          missingNoteReferences.push({
            type: 'note',
            sourceId: n._id,
            sourceTitle: n.title,
            missingNoteId: String(lid)
          });
        }
      });
    });

    // 2d. Validate Journal Entries & Detect Stale LinkedNoteId References
    journals.forEach((j, i) => {
      if (!j._id || !mongoose.Types.ObjectId.isValid(j._id)) {
        validationErrors.push(`Journal [${i}]: Invalid _id format "${j._id}"`);
      }
      if (!j.userId || !mongoose.Types.ObjectId.isValid(j.userId)) {
        validationErrors.push(`Journal [${i}]: Invalid userId "${j.userId}"`);
      } else if (!userIds.has(String(j.userId))) {
        validationErrors.push(`Journal [${i}]: Orphaned journal entry! Referenced userId "${j.userId}" does not exist in source users`);
      }
      const entryDate = j.entryDate || j.date;
      if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
        validationErrors.push(`Journal [${i}]: Invalid entryDate format "${entryDate}" (expected YYYY-MM-DD)`);
      }
      if (j.createdAt && isNaN(new Date(j.createdAt).getTime())) {
        validationErrors.push(`Journal [${i}] (${entryDate}): Invalid createdAt date "${j.createdAt}"`);
      }
      if (j.updatedAt && isNaN(new Date(j.updatedAt).getTime())) {
        validationErrors.push(`Journal [${i}] (${entryDate}): Invalid updatedAt date "${j.updatedAt}"`);
      }
      (j.linkedNoteIds || []).forEach(lid => {
        if (!mongoose.Types.ObjectId.isValid(lid)) {
          validationErrors.push(`Journal [${i}] (${entryDate}): Invalid linkedNoteId format "${lid}"`);
        } else if (!noteIds.has(String(lid))) {
          missingNoteReferences.push({
            type: 'journal',
            sourceId: j._id,
            entryDate,
            missingNoteId: String(lid)
          });
        }
      });
    });

    if (validationErrors.length > 0) {
      console.error(`\nFATAL PRE-FLIGHT ERROR: Validation failed with ${validationErrors.length} issue(s):`);
      validationErrors.forEach(err => console.error(`  - ${err}`));
      console.error('\nABORTING MIGRATION: No database connection opened for writes. Data left completely untouched.');
      process.exitCode = 1;
      return;
    }

    // Log explicit warnings for confirmed missing note references
    if (missingNoteReferences.length > 0) {
      console.log(`\n  NOTICE: Found ${missingNoteReferences.length} stale linked note reference(s) to notes that do not exist in source:`);
      missingNoteReferences.forEach(ref => {
        if (ref.type === 'journal') {
          console.warn(`    - [WARNING] Journal ID ${ref.sourceId} (Date: ${ref.entryDate}) references missing Note ID: ${ref.missingNoteId} (will be pruned)`);
        } else {
          console.warn(`    - [WARNING] Note ID ${ref.sourceId} ("${ref.sourceTitle}") references missing Note ID: ${ref.missingNoteId} (will be pruned)`);
        }
      });
      console.log(`  All journal entries and valid note references will be 100% preserved; only the missing note IDs will be omitted.\n`);
    } else {
      console.log('  All note links and journal references strictly match source notes.\n');
    }

    console.log(`  Pre-flight validation passed: 100% of IDs, foreign keys, and schemas are valid.\n`);

    // -------------------------------------------------------------
    // STEP 3: CONNECT TO MONGODB (READ-ONLY INSPECTION)
    // -------------------------------------------------------------
    console.log('[Step 3/7] Connecting to local MongoDB...');
    console.log(`  URI: ${MONGODB_URI.replace(/:([^:@]{1,})@/, ':****@')}`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    connectionOpened = true;
    console.log('  Connected to MongoDB database: "multivault"\n');

    // -------------------------------------------------------------
    // STEP 4: TARGET COLLECTION EMPTINESS CHECK (ABORT IF NOT EMPTY)
    // -------------------------------------------------------------
    console.log('[Step 4/7] Checking target MongoDB collection state...');
    const preUsersCount = await User.countDocuments();
    const preNotesCount = await Note.countDocuments();
    const preJournalsCount = await JournalEntry.countDocuments();

    console.log(`  Existing document counts in target database:`);
    console.log(`    - users collection:          ${preUsersCount}`);
    console.log(`    - notes collection:          ${preNotesCount}`);
    console.log(`    - journalentries collection: ${preJournalsCount}`);

    if (preUsersCount > 0 || preNotesCount > 0 || preJournalsCount > 0) {
      console.error('\nFATAL ERROR: Target MongoDB collections are NOT empty!');
      console.error('This migration script is strictly configured for a clean initial import.');
      console.error('To protect against accidental data loss or silent overwriting, migration is ABORTED.');
      console.error('Please ensure target collections are completely empty before running this migration.');
      process.exitCode = 1;
      return;
    }

    console.log('  Emptiness check passed: Target collections are 100% empty and ready for clean import.\n');

    // -------------------------------------------------------------
    // STEP 5: EXECUTE CLEAN INSERT (EXACT VALUES PRESERVED, NO NORMALIZATION)
    // -------------------------------------------------------------
    console.log('[Step 5/7] Inserting records with exact source values preserved...');

    // 5a. Insert Users (Exact values without trimming, lowering, or defaults)
    if (users.length > 0) {
      const userDocs = users.map(u => {
        const doc = {
          _id: new mongoose.Types.ObjectId(u._id),
          name: u.name,
          email: u.email,
          passwordHash: u.passwordHash
        };
        if (u.preferences !== undefined) {
          doc.preferences = {
            theme: u.preferences.theme,
            defaultSort: u.preferences.defaultSort,
            graphShowSharedTags: u.preferences.graphShowSharedTags
          };
        }
        if (u.createdAt !== undefined) doc.createdAt = new Date(u.createdAt);
        if (u.updatedAt !== undefined) doc.updatedAt = new Date(u.updatedAt);
        return doc;
      });
      await User.collection.insertMany(userDocs, { ordered: true });
      writeProgress.usersInserted = userDocs.length;
      console.log(`  [Users] Inserted ${userDocs.length} documents with exact values preserved.`);
    }

    // 5b. Insert Notes (Exact values without trimming, lowering, or replacing missing fields)
    if (notes.length > 0) {
      const noteDocs = notes.map(n => {
        const doc = {
          _id: new mongoose.Types.ObjectId(n._id),
          userId: new mongoose.Types.ObjectId(n.userId),
          title: n.title
        };
        if (n.content !== undefined) doc.content = n.content;
        if (n.resourceUrl !== undefined) doc.resourceUrl = n.resourceUrl;
        if (n.tags !== undefined) doc.tags = [...n.tags];
        if (n.linkedNoteIds !== undefined) {
          doc.linkedNoteIds = n.linkedNoteIds
            .filter(lid => noteIds.has(String(lid)))
            .map(lid => new mongoose.Types.ObjectId(lid));
        }
        if (n.createdAt !== undefined) doc.createdAt = new Date(n.createdAt);
        if (n.updatedAt !== undefined) doc.updatedAt = new Date(n.updatedAt);
        return doc;
      });
      await Note.collection.insertMany(noteDocs, { ordered: true });
      writeProgress.notesInserted = noteDocs.length;
      console.log(`  [Notes] Inserted ${noteDocs.length} documents with exact values preserved.`);
    }

    // 5c. Insert Journal Entries (Preserves all entries; prunes only missing note references)
    if (journals.length > 0) {
      const journalDocs = journals.map(j => {
        const doc = {
          _id: new mongoose.Types.ObjectId(j._id),
          userId: new mongoose.Types.ObjectId(j.userId),
          entryDate: j.entryDate || j.date
        };
        if (j.content !== undefined) doc.content = j.content;
        if (j.linkedNoteIds !== undefined) {
          doc.linkedNoteIds = j.linkedNoteIds
            .filter(lid => noteIds.has(String(lid)))
            .map(lid => new mongoose.Types.ObjectId(lid));
        }
        if (j.createdAt !== undefined) doc.createdAt = new Date(j.createdAt);
        if (j.updatedAt !== undefined) doc.updatedAt = new Date(j.updatedAt);
        return doc;
      });
      await JournalEntry.collection.insertMany(journalDocs, { ordered: true });
      writeProgress.journalsInserted = journalDocs.length;
      console.log(`  [Journal] Inserted ${journalDocs.length} documents with exact values preserved.\n`);
    }

    // -------------------------------------------------------------
    // STEP 6: EXHAUSTIVE RECORD-LEVEL FIELD VERIFICATION
    // -------------------------------------------------------------
    console.log('[Step 6/7] Executing exhaustive record-level verification across all fields...');
    let verifiedUsers = 0;
    let verifiedNotes = 0;
    let verifiedJournals = 0;
    let fieldMismatches = 0;

    // 6a. Deep verify every User against EXACT source values
    for (const u of users) {
      const doc = await User.findById(u._id).lean();
      if (!doc) {
        console.error(`Mismatch: User ${u._id} missing from MongoDB`);
        fieldMismatches++;
        continue;
      }
      const idMatch = doc._id.toString() === u._id;
      const nameMatch = doc.name === u.name;
      const emailMatch = doc.email === u.email; // Exact comparison against original source string
      const passMatch = doc.passwordHash === u.passwordHash;
      const prefsMatch = (u.preferences === undefined)
        ? (doc.preferences === undefined)
        : (doc.preferences?.theme === u.preferences.theme &&
           doc.preferences?.defaultSort === u.preferences.defaultSort &&
           doc.preferences?.graphShowSharedTags === u.preferences.graphShowSharedTags);
      const createdMatch = (u.createdAt === undefined)
        ? (doc.createdAt === undefined)
        : (new Date(doc.createdAt).toISOString() === new Date(u.createdAt).toISOString());
      const updatedMatch = (u.updatedAt === undefined)
        ? (doc.updatedAt === undefined)
        : (new Date(doc.updatedAt).toISOString() === new Date(u.updatedAt).toISOString());

      if (idMatch && nameMatch && emailMatch && passMatch && prefsMatch && createdMatch && updatedMatch) {
        verifiedUsers++;
      } else {
        console.error(`Field discrepancy detected on User ${u._id} (${u.email})`);
        fieldMismatches++;
      }
    }

    // 6b. Deep verify every Note against EXACT source values
    for (const n of notes) {
      const doc = await Note.findById(n._id).lean();
      if (!doc) {
        console.error(`Mismatch: Note ${n._id} missing from MongoDB`);
        fieldMismatches++;
        continue;
      }
      const idMatch = doc._id.toString() === n._id;
      const userMatch = doc.userId.toString() === n.userId;
      const titleMatch = doc.title === n.title;
      const contentMatch = (n.content === undefined)
        ? (doc.content === undefined)
        : (doc.content === n.content);
      const resourceUrlMatch = (n.resourceUrl === undefined)
        ? (doc.resourceUrl === undefined)
        : (doc.resourceUrl === n.resourceUrl);
      const tagsMatch = (n.tags === undefined)
        ? (doc.tags === undefined)
        : (Array.isArray(doc.tags) && doc.tags.length === n.tags.length && doc.tags.every((t, idx) => t === n.tags[idx]));
      
      const expectedLinkedNoteIds = (n.linkedNoteIds === undefined)
        ? undefined
        : n.linkedNoteIds.filter(lid => noteIds.has(String(lid)));
      const linksMatch = (expectedLinkedNoteIds === undefined)
        ? (doc.linkedNoteIds === undefined)
        : (Array.isArray(doc.linkedNoteIds) &&
           doc.linkedNoteIds.length === expectedLinkedNoteIds.length &&
           doc.linkedNoteIds.every((lid, idx) => lid.toString() === expectedLinkedNoteIds[idx]));

      const createdMatch = (n.createdAt === undefined)
        ? (doc.createdAt === undefined)
        : (new Date(doc.createdAt).toISOString() === new Date(n.createdAt).toISOString());
      const updatedMatch = (n.updatedAt === undefined)
        ? (doc.updatedAt === undefined)
        : (new Date(doc.updatedAt).toISOString() === new Date(n.updatedAt).toISOString());

      if (idMatch && userMatch && titleMatch && contentMatch && resourceUrlMatch && tagsMatch && linksMatch && createdMatch && updatedMatch) {
        verifiedNotes++;
      } else {
        console.error(`Field discrepancy detected on Note ${n._id} ("${n.title}")`);
        fieldMismatches++;
      }
    }

    // 6c. Deep verify every Journal Entry against EXACT source values
    for (const j of journals) {
      const doc = await JournalEntry.findById(j._id).lean();
      if (!doc) {
        console.error(`Mismatch: Journal ${j._id} missing from MongoDB`);
        fieldMismatches++;
        continue;
      }
      const idMatch = doc._id.toString() === j._id;
      const userMatch = doc.userId.toString() === j.userId;
      const dateMatch = doc.entryDate === (j.entryDate || j.date);
      const contentMatch = (j.content === undefined)
        ? (doc.content === undefined)
        : (doc.content === j.content);

      const expectedLinkedNoteIds = (j.linkedNoteIds === undefined)
        ? undefined
        : j.linkedNoteIds.filter(lid => noteIds.has(String(lid)));
      const linksMatch = (expectedLinkedNoteIds === undefined)
        ? (doc.linkedNoteIds === undefined)
        : (Array.isArray(doc.linkedNoteIds) &&
           doc.linkedNoteIds.length === expectedLinkedNoteIds.length &&
           doc.linkedNoteIds.every((lid, idx) => lid.toString() === expectedLinkedNoteIds[idx]));

      const createdMatch = (j.createdAt === undefined)
        ? (doc.createdAt === undefined)
        : (new Date(doc.createdAt).toISOString() === new Date(j.createdAt).toISOString());
      const updatedMatch = (j.updatedAt === undefined)
        ? (doc.updatedAt === undefined)
        : (new Date(doc.updatedAt).toISOString() === new Date(j.updatedAt).toISOString());

      if (idMatch && userMatch && dateMatch && contentMatch && linksMatch && createdMatch && updatedMatch) {
        verifiedJournals++;
      } else {
        console.error(`Field discrepancy detected on Journal ${j._id} (${j.entryDate})`);
        fieldMismatches++;
      }
    }

    // -------------------------------------------------------------
    // FINAL VERIFICATION SUMMARY TABLE
    // -------------------------------------------------------------
    const finalUsersCount = await User.countDocuments();
    const finalNotesCount = await Note.countDocuments();
    const finalJournalCount = await JournalEntry.countDocuments();

    console.log('\n================================================================');
    console.log('                 FINAL MIGRATION AUDIT REPORT                   ');
    console.log('================================================================');
    console.log(`  Entity          JSON Source    Verified in Mongo    Total in Mongo`);
    console.log(`  -------------   -----------    -----------------    --------------`);
    console.log(`  Users           ${String(users.length).padEnd(11)}    ${String(`${verifiedUsers}/${users.length}`).padEnd(17)}    ${String(finalUsersCount).padEnd(14)}`);
    console.log(`  Notes           ${String(notes.length).padEnd(11)}    ${String(`${verifiedNotes}/${notes.length}`).padEnd(17)}    ${String(finalNotesCount).padEnd(14)}`);
    console.log(`  Journal Entries ${String(journals.length).padEnd(11)}    ${String(`${verifiedJournals}/${journals.length}`).padEnd(17)}    ${String(finalJournalCount).padEnd(14)}`);
    console.log('================================================================');

    const allVerified = (verifiedUsers === users.length) &&
                        (verifiedNotes === notes.length) &&
                        (verifiedJournals === journals.length) &&
                        (fieldMismatches === 0);

    if (allVerified) {
      // Step 7: Index Synchronization (only after 100% verification passes)
      console.log('\n[Step 7/7] Synchronizing collection indexes on verified data...');
      await User.createIndexes();
      await Note.createIndexes();
      await JournalEntry.createIndexes();
      writeProgress.indexesCreated = true;
      console.log('  Indexes synchronized successfully:');
      console.log('    - users:          email (unique)');
      console.log('    - notes:          { userId, updatedAt }, { userId, tags }');
      console.log('    - journalentries: { userId, entryDate } (unique)');

      console.log('\nSUCCESS: 100% of source records verified in MongoDB with zero mismatches!');
      console.log('All original IDs, passwords, note links, tags, and preferences are intact.');
    } else {
      console.error(`\nFAILURE: Encountered ${fieldMismatches} field discrepancy issue(s). Migration verification FAILED.`);
      console.error('Index creation skipped to preserve database state for inspection.');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('\nFATAL EXCEPTION DURING MIGRATION:', err.message);
    process.exitCode = 1;

    const totalWritten = writeProgress.usersInserted + writeProgress.notesInserted + writeProgress.journalsInserted;
    if (totalWritten > 0) {
      console.error('\n================================================================');
      console.error('                 PARTIAL MIGRATION DETECTED                     ');
      console.error('================================================================');
      console.error('An error occurred after some records were already inserted into MongoDB:');
      console.error(`  - Users inserted:           ${writeProgress.usersInserted}`);
      console.error(`  - Notes inserted:           ${writeProgress.notesInserted}`);
      console.error(`  - Journal entries inserted: ${writeProgress.journalsInserted}`);
      console.error(`  - Indexes synchronized:     ${writeProgress.indexesCreated ? 'YES' : 'NO'}`);
      console.error('\nSAFETY NOTICE:');
      console.error('To protect your data, this script NEVER automatically deletes, drops,');
      console.error('or modifies any records.');
      console.error('\nSAFE RECOVERY PROCEDURE:');
      console.error('1. Review the fatal exception log above to identify the root cause.');
      console.error('2. Inspect the current database state using mongosh (read-only):');
      console.error('     mongosh "mongodb://127.0.0.1:27017/multivault" --eval "db.users.countDocuments(); db.notes.countDocuments(); db.journalentries.countDocuments();"');
      console.error('3. If necessary, create a backup of the partially written data before any action:');
      console.error('     mongodump --uri="mongodb://127.0.0.1:27017/multivault" --out="./backup_partial_migration"');
      console.error('4. Consult with your administrator or review your records.');
      console.error('   Any collection reset must be a deliberate, manually confirmed decision.');
      console.error('5. Only after target collections are deliberately confirmed empty, re-run:');
      console.error('     node scripts/migrate-to-mongo.js');
      console.error('================================================================\n');
    }
  } finally {
    if (connectionOpened && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('\n[Database] Cleanly closed MongoDB connection in finally block.\n');
    }
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
