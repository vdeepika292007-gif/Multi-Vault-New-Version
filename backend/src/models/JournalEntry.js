const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    entryDate: {
      type: String,
      required: [true, 'Entry date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD']
    },
    content: {
      type: String,
      default: ''
    },
    linkedNoteIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Mandatory compound unique index enforcing one journal entry per user per date
journalEntrySchema.index({ userId: 1, entryDate: 1 }, { unique: true });

const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', journalEntrySchema);
module.exports = JournalEntry;
