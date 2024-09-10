import mongoose, { Schema } from 'mongoose';

const discountType = ['dollar', 'percent'];

const UserRewardSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  totalSpent: { type: Number, default: 0 }, 
  purchaseCount: { type: Number, default: 0 },
  lastVisit: { type: Date },
  currentDiscount: {
    type: { type: String, enum: discountType },
    amount: { type: Number }
  },
  welcomeDiscount: { type: Number, default: 0 }, 
  nextTier: { type: String },
});

// Create indexes
UserRewardSchema.index({ customerId: 1 });
UserRewardSchema.index({ merchantId: 1 });
UserRewardSchema.index({ customerId: 1, merchantId: 1 }, { unique: true }); // Compound index, with a unique constraint if each user-merchant pair should be unique

export const UserReward = mongoose.models.UserReward || mongoose.model('UserReward', UserRewardSchema);
