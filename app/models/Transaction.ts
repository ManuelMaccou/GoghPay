import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const paymentTypes = ['Venmo', 'Zelle', 'Square', 'ManualEntry', 'Cash', 'sponsored crypto', 'crypto', 'mobile pay'];
const transactionStatus = ['COMPLETE', 'PENDING'];

const transactionSchema = new Schema({
  type: { type: String },
  merchant: { type: Schema.Types.ObjectId, ref: 'Merchant' },
  buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productName: { type: String, required: true },
  productPrice: { type: Number, required: true },
  tipAmount: { type: Number },
  salesTax: { type: Number },
  paymentType: { type: String, enum: paymentTypes, required: true },
  status: { type: String, enum: transactionStatus },
  transactionHash: { type: String },
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

export default Transaction;
