import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', index: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  subscribedOn: { type: Date, default: Date.now },
  active: { type: Boolean, required: true, default: true }
}, { timestamps: true });

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
