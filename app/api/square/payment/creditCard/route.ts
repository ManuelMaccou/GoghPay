import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import { v4 as uuidv4 } from 'uuid';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import JSONBig from 'json-bigint';
import { serializeError } from '@/app/utils/logAdminError';

export async function POST(req: NextRequest) {

  console.log("Processing payment with token");

  const { privyId, merchantId, locationId, sourceId, customerId, priceInCents, transactionId } = await req.json();
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
        amount: BigInt(Math.round(priceInCents)),
        currency: 'USD'
      },
      autocomplete: true,
      customerId: customerId,
      locationId: locationId,
      referenceId: transactionId, // transaction._id
      note: 'Gogh initiated credit card payment'
    });

    // Check if there are errors in the response
    if (response.result.errors) {
      console.error('Payment failed with errors:', response.result.errors);

      // Extract and return the error details
      const errorDetail = response.result.errors.map((error) => ({
        code: error.code,
        detail: error.detail,
        category: error.category,
      }));

      return new NextResponse(
        JSON.stringify({
          message: 'Payment failed',
          errors: errorDetail,
          status: 'FAILED',
        }),
        { status: 400 }
      );
    }

    // Handle successful payment
    const creditCardPaymentResponse = response.result.payment;

    if (creditCardPaymentResponse?.status === 'COMPLETED') {
      const sanitizedResponse = JSONBig.stringify(creditCardPaymentResponse);
      return new NextResponse(sanitizedResponse, { status: 200 });
    } else {
      // Handle unexpected status
      console.error('Unexpected payment status:', creditCardPaymentResponse?.status);
      return new NextResponse(
        JSON.stringify({
          message: 'Payment status unexpected',
          status: creditCardPaymentResponse?.status || 'Unknown',
        }),
        { status: 500 }
      );
    }

  } catch (error: any) {
    // Check if the error status code is available and return appropriate status
    if (error.statusCode && error.statusCode === 400) {
      console.error('Client error occurred:', error);
      return NextResponse.json(
        { message: 'Client error occurred', details: error.body },
        { status: 400 }
      );
    }

    const serializedError = await serializeError(error);
    // Log and return the error as a server error if no specific status code is found
    console.error('Server error creating credit card payment:', error);
    return NextResponse.json({ message: "Internal Server Error",  error: serializedError }, { status: 500 });
  }
}