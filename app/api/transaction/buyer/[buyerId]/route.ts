import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';
import Merchant from '@/app/models/Merchant'; // Ensure Merchant is imported if needed for type inference

type Params = {
  buyerId: string;
};

export async function GET(req: NextRequest, context: { params: Params }) {
  const buyerId = context.params.buyerId;
  await connectToDatabase();

  // Use MongoDB's populate method to include merchant details
  const totalTransactions = await Transaction.find({ buyer: buyerId }).populate({
    path: 'merchant',
    select: 'name'
  });

  if (!totalTransactions.length) {
    console.log(`No transactions returned for buyer ID: ${buyerId}`);
    return NextResponse.json({ message: "No transactions found." }, { status: 404 });
  }

  console.log("Buyer transactions found:");
  return NextResponse.json({ totalTransactions }, { status: 200 });
}
