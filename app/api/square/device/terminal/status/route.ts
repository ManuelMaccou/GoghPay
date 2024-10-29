import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');


  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found. Please log in again.', { status: 404 });
  }

  if (!merchant.square) {
    return new NextResponse('Square not connected. Please reconnect in settings.', { status: 404 });
  }

  if (!merchant.square.terminal_device_id) {
    return new NextResponse('Terminal not connected', { status: 400 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);
  
  try {
    const client = createSquareClient(decryptedAccessToken);
    const response = await client.devicesApi.getDeviceCode(merchant.square.terminal_device_id);
  
    // Handle errors from Square API
    if (response?.result?.errors) {
      console.error('Error retrieving device code from Square:', response.result.errors);
      return new NextResponse(
        JSON.stringify({ error: response.result.errors }),
        { status: 502 }
      );
    }

    if (response.result.deviceCode) {
      console.log('Terminal device response:', response.result.deviceCode);
      const deviceStatus = response.result.deviceCode.status;
      return new NextResponse(
        JSON.stringify({ deviceStatus }),
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
