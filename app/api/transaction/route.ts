import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Transaction from '../../models/Transaction';

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const { buyerId, buyerPrivyId, merchantId, productName, discountType, discountAmount, welcomeDiscount, productPrice, paymentType, tipAmount, salesTax, status, transactionHash } = await req.json();
    const privyId = req.headers.get('x-user-id');

    if (!privyId) {
      return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
    }

    if (buyerPrivyId !== privyId) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 403 });
    }

    console.log('status in transaction:', status);


    const transaction = new Transaction({
      merchant: merchantId,
      buyer: buyerId,
      product: {
        name: productName,
        price: productPrice,
      },
      discount: {
        type: discountType,
        amount: discountAmount,
        welcome: welcomeDiscount,
      },
      payment: {
        paymentType: paymentType,
        tipAmount: tipAmount,
        salesTax: salesTax,
        transactionHash: transactionHash,
        status: status,
      }
    });

    await transaction.save();

    return NextResponse.json({transaction, message: 'Transaction saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error saving transaction:', error);
    return NextResponse.json({ error: 'Error saving transaction' }, { status: 500 });
  }
}
