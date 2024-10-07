import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const paymentTypes = ['Venmo', 'Zelle', 'Square', 'ManualEntry', 'Cash'];

const PaymentMethodSchema = new mongoose.Schema({
  types: [{ type: String, enum: paymentTypes, required: true }],
  venmoQrCodeImage: { type: String },
  zelleQrCodeImage: { type: String },
}, { timestamps: true });

const SquareSchema = new mongoose.Schema({
  merchant_id: { type: String },
  location_id: { type: String },
  location_name: { type: String },
  access_token: { type: String },
  refresh_token: { type: String },
  token_expires_at: { type: Date },
}, { timestamps: true });

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
  welcome_reward: { type: Number }, // Has to fit the discount_type
  tiers: { type: [RewardsTierSchema]},
}, { timestamps: true });

const merchantSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  merchantId: { type: String, required: true },
  walletAddress: { type: String },
  storeImage: { type: String },
  privyId: { type: String },
  admin: { type: Boolean },
  onboardingStep: { type: Number },
  stripeConnectedAccountId: { type: String },
  taxes: { type: [taxSchema] },
  promo: { type: Boolean },
  shopify: {
    shopName: { type: String },
    accessToken: { type: String },
  },
  square: { type: SquareSchema },
  paymentMethods: { type: PaymentMethodSchema },
  rewards: { type: RewardsSchema },
  branding: { type: BrandingSchema },
  code: { type: String },

}, { timestamps: true });

merchantSchema.index({ code: 1 });

const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);

export default Merchant;