import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';
import Merchant from '@/app/models/Merchant';

type Params = {
  buyerId: string;
};

export async function GET(req: NextRequest, context: { params: Params }) {
  const buyerId = context.params.buyerId;
  await connectToDatabase();

  const totalTransactions = await Transaction.find({ buyer: buyerId }).
  populate('merchant').
  exec();

  console.log('total transactions', totalTransactions);

  if (!totalTransactions.length) {
    console.log(`No transactions returned for buyer ID: ${buyerId}`);
    return NextResponse.json({ message: "No transactions found." }, { status: 404 });
  }

  console.log("Buyer transactions found:", totalTransactions);
  return NextResponse.json({ totalTransactions }, { status: 200 });
}
