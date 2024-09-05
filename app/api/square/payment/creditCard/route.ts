import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import { v4 as uuidv4 } from 'uuid';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';

export async function POST(req: NextRequest) {

  console.log("Processing payment with token");

  const { privyId, merchantId, locationId, sourceId, customerId, price, transactionId } = await req.json();
  const idempotencyKey = uuidv4();

  if (!merchantId) {
    return new NextResponse('Missing merchantId for auth', { status: 400 });
  }

  if (!privyId) {
    return new NextResponse('Missing privyId for auth', { status: 400 });
  }

  const userIdFromToken = req.headers.get('x-user-id');

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found in db', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);

  try {
    const client = createSquareClient(decryptedAccessToken);

    const response = await client.paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: idempotencyKey,
      amountMoney: {
        amount: price,
        currency: 'USD'
      },
      autocomplete: true,
      customerId: customerId,
      locationId: locationId,
      referenceId: transactionId, // transaction._id
      note: 'Gogh initiated credit card payment'
    });

    if (response.result.errors) {
      console.error('Error creating credit card payment:', response.result.errors);
      return new NextResponse(JSON.stringify({ error: response.result.errors }), { status: 500 });
    }

    const creditCardPaymentResponse = response.result.payment;

    if (creditCardPaymentResponse) {
      
      return new NextResponse(JSON.stringify({ creditCardPaymentResponse }), { status: 200 });
    } else {
      return new NextResponse('Error creating credit card payment:', { status: 404 });
    }

  } catch (error) {
    console.error('Error creating credit card payment:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}