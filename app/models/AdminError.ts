import mongoose from 'mongoose';

const AdminErrorSchema = new mongoose.Schema({
  merchantId: { type: String, required: true },
  attemptedTask: { type: String, required: true },
  errorMessage: { type: String, required: true },
  errorStack: { type: String, default: null },
  timestamp: { type: Date },
});

const AdminError = mongoose.models.AdminError || mongoose.model('AdminError', AdminErrorSchema);

export default AdminError;
