import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  privyId: { type: String },
  walletAddress: { type: String },
  name: { type: String },
  email: { type: String },
  merchant: { type: Boolean },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;