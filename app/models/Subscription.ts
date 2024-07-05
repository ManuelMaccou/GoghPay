import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', index: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  subscribedOn: { type: Date, default: Date.now },
  subscriberStatus: { type: String, required: true } // active, unsubscribed, denied
}, { timestamps: true });

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
