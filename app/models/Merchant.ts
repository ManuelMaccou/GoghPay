import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const taxSchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  name: { type: String, required: true },
  default: { type: Boolean, required: true },
});

const LoyaltyTierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  discount: { type: Number, required: true }, // Can be dollars or percent off
  milestone: { type: Number, required: true },  // Milestone can be dollars or visits
});

const LoyaltySchema = new mongoose.Schema({
  discount_type: {
    type: String,
    enum: ['dollar', 'percent'],
    required: true,
  },
  milestone_type: {
    type: String,
    enum: ['dollars_spent', 'number_of_visits'],
    required: true,
  },
  tiers: { type: [LoyaltyTierSchema], required: true },  // Array of LoyaltyTier
});

const merchantSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  merchantId: { type: String, required: true },
  walletAddress: { type: String, required: true },
  storeImage: { type: String },
  privyId: { type: String },
  admin: { type: Boolean },
  stripeConnectedAccountId: { type: String },
  taxes: { type: [taxSchema] },
  promo: { type: Boolean },
  shopify: {
    shopName: { type: String, required: true },
    accessToken: { type: String, required: true },
  },
  square_merchant_id: { type: String },
  square_location_id: { type: String },
  square_location_name: { type: String },
  square_access_token: { type: String },
  square_refresh_token: { type: String },
  square_token_expires_at: { type: Date },
  loyalty: { type: LoyaltySchema },

}, { timestamps: true });

const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);

export default Merchant;