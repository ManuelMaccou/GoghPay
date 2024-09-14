import mongoose from 'mongoose';

const paymentProviders = ['Zelle', 'Venmo']

const QrCodeImageSchema = new mongoose.Schema({
  paymentProvider: { type: String, enum: paymentProviders, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
}, { timestamps: true });

const QrCodeImage = mongoose.models.QrCodeImage || mongoose.model('QrCodeImage', QrCodeImageSchema);

export default QrCodeImage;