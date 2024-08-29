import mongoose, { Schema } from 'mongoose';

const UserRewardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  totalSpent: { type: Number, default: 0 }, 
  visitsCount: { type: Number, default: 0 },
  lastVisit: { type: Date },
  currentTier: { type: String },
});

export const UserReward = mongoose.model('UserRewardState', UserRewardSchema);
