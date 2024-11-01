import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import * as Sentry from '@sentry/nextjs';
import { v4 as uuidv4 } from 'uuid';
import JSONBig from 'json-bigint';

export async function POST(request: NextRequest) {
  const { finalPrice, goghTransactionId, merchantId, privyId }: { finalPrice: string; goghTransactionId: string, merchantId: string, privyId: string; } = await request.json();
  const idempotencyKey = uuidv4();

  if (!finalPrice) {
    return new NextResponse('Missing saleData', { status: 400 });
  }

  if (!privyId) {
    return new NextResponse('Missing privyId for auth', { status: 400 });
  }

  const userIdFromToken = request.headers.get('x-user-id');

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found. Please log in again.', { status: 404 });
  }

  if (!merchant.square?.terminal_device_id) {
    return new NextResponse('Square terminal not connected. Please reconnect in settings.', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);
  
  try {
    const client = createSquareClient(decryptedAccessToken);

    const parsedFinalPrice = parseInt(finalPrice, 10);
    if (isNaN(parsedFinalPrice)) {
      return new NextResponse('Invalid finalPrice value', { status: 400 });
    }

    const response = await client.terminalApi.createTerminalCheckout({
      idempotencyKey: idempotencyKey,
      checkout: {
        amountMoney: {
          amount: BigInt(parsedFinalPrice),
          currency: 'USD'
        },
        referenceId: goghTransactionId,
        deviceOptions: {
          deviceId: merchant.square.terminal_device_id,
          skipReceiptScreen: false,
        }
      }
    });
  
    // Handle errors from Square API
    if (response?.result?.errors) {
      console.error('Error sending payment to Terminal:', response.result.errors);
      return new NextResponse(
        JSON.stringify({ error: response.result.errors }),
        { status: 502 }
      );
    }

    if (response.result.checkout) {
      if (response.result.checkout.status === 'PENDING') {
        const sanitizedResponse = JSONBig.stringify(response.result.checkout);

        console.log('Terminal device response:', response.result.checkout);
        return new NextResponse(
          JSON.stringify({ checkout: sanitizedResponse }),
          { status: 200 }
        );
      }
      
      
    } else {
      return new NextResponse('There was an error processing the terminal payment', { status: 404 });
    }
  
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error with Square API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
