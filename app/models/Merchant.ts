import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const taxSchema = new mongoose.Schema({
  rate: { type: Number, required: true },
  name: { type: String, required: true },
  default: { type: Boolean, required: true },
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
  square_merchant_id: { type: String },
  square_location_id: { type: String },
  square_location_name: { type: String },
  square_access_token: { type: String },
  square_refresh_token: { type: String },
  square_token_expires_at: { type: Date },

}, { timestamps: true });

const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);

export default Merchant;