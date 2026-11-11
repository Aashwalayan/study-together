import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    subject: { type: String, trim: true, maxlength: 60, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPrivate: { type: Boolean, default: false },
    // Only set for private rooms; shared with friends to let them in
    inviteCode: { type: String, index: true, sparse: true },
    // Users allowed into a private room (owner is always included)
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxSeats: { type: Number, default: 24, min: 6, max: 48 },
    focusMinutes: { type: Number, default: 25, min: 1, max: 120 },
    breakMinutes: { type: Number, default: 5, min: 1, max: 60 },
  },
  { timestamps: true }
);

export default mongoose.model('Room', roomSchema);
