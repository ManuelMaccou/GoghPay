import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';

type Params = {
  merchantId: string
}

export async function GET(req: NextRequest, context: { params: Params }) {
  const merchantId = context.params.merchantId
  await connectToDatabase();

  const privyId = req.headers.get('x-user-id');
  if (!privyId) {
    return NextResponse.json({ error: 'User ID not provided during auth middleware' }, { status: 401 });
  }

  const allMerchantTransactions = await Transaction.find({ merchant: merchantId });

  if (!allMerchantTransactions.length) {
    console.log("No transactions returned for merchant ID:", merchantId);
    return NextResponse.json({ message: "No transactions found." }, { status: 404 });
  }
  
  console.log("Transactions found:");
  return NextResponse.json(allMerchantTransactions, { status: 200 });
}