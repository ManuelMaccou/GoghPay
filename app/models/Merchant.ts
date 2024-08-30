import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const BrandingSchema = new mongoose.Schema({
  primary_color: { type: String, default: "#FFFFFF", required: true },
  seconday_color: { type: String, default: "#000000", required: true },
  logo: { type: String, required: true },
});

const taxSchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  name: { type: String, required: true },
  default: { type: Boolean, required: true },
}, { timestamps: true });

const RewardsTierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  discount: { type: Number, required: true }, // Can be dollars or percent off
  milestone: { type: Number, required: true },  // Milestone can be dollars or visits
}, { timestamps: true });

const RewardsSchema = new mongoose.Schema({
  discount_type: {
    type: String,
    enum: ['dollar', 'percent'],
    default: 'percent',
    required: true,
  },
  milestone_type: {
    type: String,
    enum: ['dollars_spent', 'number_of_visits'],
    default: 'dollars_spent',
    required: true,
  },
  tiers: { type: [RewardsTierSchema]},
}, { timestamps: true });

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
  rewards: { type: RewardsSchema },
  branding: { type: BrandingSchema }

}, { timestamps: true });

const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);

export default Merchant;