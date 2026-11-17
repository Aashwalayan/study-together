import mongoose from 'mongoose';

// One document per pair of users, whichever way the request went. pairKey is
// the two ids sorted and joined, and its unique index makes duplicates (A asks
// B while B asks A) impossible even if two requests arrive at the same time.
const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pairKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  },
  { timestamps: true }
);

export const pairKeyOf = (a, b) => [String(a), String(b)].sort().join(':');

export default mongoose.model('Friendship', friendshipSchema);