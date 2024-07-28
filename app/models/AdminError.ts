import mongoose from 'mongoose';

const AdminErrorSchema = new mongoose.Schema({
  merchantId: { type: String },
  attemptedTask: { type: String },
  errorMessage: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const AdminError = mongoose.models.AdminError || mongoose.model('AdminError', AdminErrorSchema);

export default AdminError;

