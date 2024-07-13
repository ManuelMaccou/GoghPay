import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const transferSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  fromGoghAddress: { type: String, required: true },
  toCoinbaseAddress: { type: String, required: true },
  transactionHash: { type: String },
}, { timestamps: true });

const Transfer = mongoose.models.Transfer || mongoose.model('Transfer', transferSchema);

export default Transfer;
