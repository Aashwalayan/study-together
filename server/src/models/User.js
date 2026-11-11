import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // What they are currently studying, shown next to their name in rooms
    subject: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
