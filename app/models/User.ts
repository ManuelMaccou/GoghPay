import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  privyId: { type: String, required: true },
  walletAddress: { type: String },
  name: { type: String },
  email: { type: String },

});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;