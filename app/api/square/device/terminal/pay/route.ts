import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import * as Sentry from '@sentry/nextjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const { merchantId, privyId } = await request.json();
  const idempotencyKey = uuidv4();

  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
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

  if (!merchant.square) {
    return new NextResponse('Square not connected. Please reconnect in settings.', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);
  
  try {
    const client = createSquareClient(decryptedAccessToken);
    const response = await client.terminalApi.createTerminalCheckout({
      idempotencyKey: idempotencyKey,
      checkout: {
        amountMoney: {
          amount: 10000,
          currency: 'USD'
        },
        referenceId: '232323',
        note: 'hamburger',
        deviceOptions: {
          deviceId: 'R5WNWB5BKNG9R',
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

    if (response.result.checkout.) {
      console.log('Terminal device response:', response.result.deviceCode);
      const { status: deviceStatus, code: loginCode, id: deviceId } = response.result.deviceCode;
      return new NextResponse(
        JSON.stringify({ deviceStatus, loginCode, deviceId }),
        { status: 200 }
      );
    } else {
      return new NextResponse('Device code not found from Square', { status: 404 });
    }
  
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error with Square API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
