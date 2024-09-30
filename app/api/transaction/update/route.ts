import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '@/app/models/Transaction';

export async function POST(req: NextRequest) {
  try {
    const { privyId, squarePaymentId, clientTransactionId, transactionId, status } = await req.json();
    const userIdFromToken = req.headers.get('x-user-id');
    const serverAuthentication = req.headers.get('authorization');

    if (serverAuthentication === process.env.SERVER_AUTH) {
      console.log("Request authenticated from the server.");
    } else {
      // Perform Privy authentication if not server-authenticated
      if (!privyId) {
        return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
      }
    
      if (!userIdFromToken || userIdFromToken !== privyId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
    }

    await connectToDatabase();

    // Find the user by privyId and update the specified fields
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { _id: transactionId },
      { $set: {
        'payment.squarePaymentId': squarePaymentId,
        'payment.offineTransactionId': clientTransactionId,
        'payment.status': status,
      } },
      { new: true }
    );

    if (!updatedTransaction) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({updatedTransaction, message: "Transaction updated successfully" }, { status: 200 });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
