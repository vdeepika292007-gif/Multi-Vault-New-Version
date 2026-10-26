const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
      type: String,
      default: ''
    },
    resourceUrl: {
      type: String,
      trim: true,
      default: ''
    },
    tags: {
      type: [String],
      default: []
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

// Compound index for user query performance and sorting
noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });

const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
module.exports = Note;
