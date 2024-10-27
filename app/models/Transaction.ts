import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const paymentTypes = ['Venmo', 'Zelle', 'Square', 'ManualEntry', 'Cash', 'sponsored crypto', 'crypto', 'mobile pay'];
const transactionStatus = ['COMPLETE', 'COMPLETE_OFFLINE', 'PENDING'];

const transactionSchema = new Schema({
  type: { type: String },
  merchant: { type: Schema.Types.ObjectId, ref: 'Merchant' },
  buyer: { type: Schema.Types.ObjectId, ref: 'User' },
  product: {
    name: { type: String, default: '' },
    price: { type: Number },
  },
  discount: {
    type: { type: String },
    amount: { type: Number },
    welcome: { type: Number },
  },
  payment: {
    paymentType: { type: String, enum: paymentTypes, required: true },
    tipAmount: { type: Number },
    salesTax: { type: Number },
    transactionHash: { type: String },
    status: { type: String, enum: transactionStatus },
    offineTransactionId: { type: String },
    squarePaymentId: { type: String },
  }
}, { timestamps: true });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

export default Transaction;
