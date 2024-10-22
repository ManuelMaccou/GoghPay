import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';
import Merchant from '@/app/models/Merchant';

type Params = {
  buyerId: string;
};

export async function GET(req: NextRequest, context: { params: Promise<Params> }) {
  const buyerId = (await context.params).buyerId;
  await connectToDatabase();

  const totalTransactions = await Transaction.find({ 
    buyer: buyerId,
    'payment.status': { $in: ['COMPLETE', 'COMPLETE_OFFLINE'] }
  }).
  populate('merchant').
  exec();

  console.log('total transactions', totalTransactions);

  if (!totalTransactions.length) {
    return new Response(null, { status: 204 });
  }

  return NextResponse.json({ totalTransactions }, { status: 200 });
}
