import mongoose from 'mongoose';
import Merchant from '../models/Merchant';
import User from '../models/User';
import Transaction from '../models/Transaction';
import Transfer from '../models/Transfer';
import Subscription from '../models/Subscription';
import AdminError from '../models/AdminError';

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error('env variable not defined');
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Connected to MongoDB');

      // Ensure models are registered
      mongoose.model('Merchant', Merchant.schema);
      mongoose.model('User', User.schema);
      mongoose.model('Transfer', Transfer.schema);
      mongoose.model('Transaction', Transaction.schema);
      mongoose.model('Subscription', Subscription.schema);
      mongoose.model('AdminError', AdminError.schema);

      return mongoose;
    }).catch((error) => {
      console.error('Error connecting to MongoDB', error);
      throw error;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
