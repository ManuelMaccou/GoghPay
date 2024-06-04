import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '../../models/Transaction';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const { buyerId,buyerPrivyId, merchantId, productName, productPrice, transactionHash } = await req.json();
    const privyId = req.headers.get('x-user-id');

    if (!privyId) {
      return NextResponse.json({ error: 'User ID not provided during auth middleware' }, { status: 401 });
    }

     // Check if the provided buyerId matches the privyId from the headers
     if (buyerPrivyId !== privyId) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 403 });
    }


    const transaction = new Transaction({
      merchant: merchantId,
      buyer: buyerId,
      productName,
      productPrice,
      transactionHash,
    });

    await transaction.save();

    return NextResponse.json({ message: 'Transaction saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving transaction:', error);
    return NextResponse.json({ error: 'Error saving transaction' }, { status: 500 });
  }
}
