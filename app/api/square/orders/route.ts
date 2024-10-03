import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import JSONBig from 'json-bigint';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');
  const transactionId = searchParams.get('transactionId');

  if (!merchantId) {
    return NextResponse.json({ error: 'Missing merchantId' }, { status: 400 });
  }
  if (!transactionId) {
    return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    if (!!merchant.square || !merchant.square.access_token) {
      return NextResponse.json({ error: 'No access token' }, { status: 401 });
    }

    const decryptedAccessToken = decrypt(merchant.square.access_token);
    const client = createSquareClient(decryptedAccessToken);

    // Try to retrieve the order
    const response = await client.ordersApi.retrieveOrder(transactionId);

    // If no order is found (e.g., cash transaction), return a 200 status with a message
    if (!response.result || !response.result.order || !response.result.order.tenders) {
      return NextResponse.json({
        message: `No order found for order_id: ${transactionId}.`
      }, { status: 404 });

    } else {
      const paymentId = response.result.order.tenders[0].id
  
      return NextResponse.json({paymentId}, { status: 200 });
    }
  } catch (error: any) {
    console.error('Error fetching order:', error);

    // Inspect the error before assuming it's a 500 error
    if (error?.response?.status === 404) {
      // Handle 404 case as a valid cash transaction
      return NextResponse.json({
        message: 'No order found, but transactionId is valid (e.g., cash transaction).',
        transactionId,
      }, { status: 200 });
    }

    if (error?.response?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error?.response?.status === 403) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle other status codes accordingly
    if (error?.response?.status >= 500) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // Return the specific error message if any other error occurs
    if (error?.response?.errors) {
      return NextResponse.json({
        error: error.response.errors.map((err: any) => err.detail).join(', '),
      }, { status: error.response.status });
    }

    // Fallback for unexpected errors
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
