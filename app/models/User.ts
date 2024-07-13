import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  privyId: { type: String },
  walletAddress: { type: String },
  smartAccountAddress: { type: String },
  coinbaseAddress: { type: String },
  name: { type: String },
  email: { type: String },
  merchant: { type: Boolean },
  creationType: { type: String }, // stripe, privy
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;