import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Public handle used to find and add friends. Sparse, so accounts created
    // before usernames existed (which have none) don't collide with each other.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
    // What they are currently studying, shown next to their name in rooms
    subject: { type: String, trim: true, maxlength: 60, default: '' },
    bio: { type: String, trim: true, maxlength: 160, default: '' },

    // Email verification. Only a SHA-256 hash of the token is stored, so a
    // database leak cannot be used to verify accounts.
    emailVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, index: true, sparse: true },
    verifyTokenExpires: { type: Date },
    verifySentAt: { type: Date },
  },
  { timestamps: true }
);

// Abandoned or mistyped sign-ups clean themselves up after 7 days, which also
// frees the email address. Verified accounts are never touched.
userSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { emailVerified: false } }
);

export default mongoose.model('User', userSchema);