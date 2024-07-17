import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const transactionSchema = new Schema({
  type: { type: String },
  merchant: { type: Schema.Types.ObjectId, ref: 'Merchant' },
  buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  tipAmount: { type: Number },
  paymentType: { type: String, required: true }, // 'sponsored crypto', 'crypto', 'mobile pay'
  transactionHash: { type: String },
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

export default Transaction;
