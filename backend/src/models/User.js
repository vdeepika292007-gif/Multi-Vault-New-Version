const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required']
    },
    preferences: {
      theme: {
        type: String,
        enum: ['dark', 'obsidian', 'violet'],
        default: 'obsidian'
      },
      defaultSort: {
        type: String,
        enum: ['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc'],
        default: 'updatedAt_desc'
      },
      graphShowSharedTags: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Never return passwordHash in queries by default
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;
