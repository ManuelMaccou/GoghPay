import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const transactionSchema = new mongoose.Schema({
  merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productName: { type: String, required: true },
  productPrice: { type: String, required: true },
  transactionHash: { type: String },
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

export default Transaction;
