import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');

  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
  }

  try {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return new NextResponse('Merchant not found', { status: 404 });
    }

    const decryptedAccessToken = decrypt(merchant.square.access_token);
    const client = new Client({
      accessToken: decryptedAccessToken,
      environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
      httpClientOptions: {
        timeout: 5000, // 5 seconds
        retryConfig: {
          maxNumberOfRetries: 3,
          maximumRetryWaitTime: 20000, // 20 seconds
        }
      }
    });

    const squareAppSecret = process.env.SQUARE_APP_SECRET;
    const response = await client.oAuthApi.revokeToken(
      {
        clientId: process.env.NEXT_PUBLIC_SQUARE_APP_ID,
        accessToken: decryptedAccessToken,
        revokeOnlyAccessToken: false,
      },
      `Client ${squareAppSecret}`
    );

    console.log("revoke access response",response.result);
    return new NextResponse(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error revoking Square access:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
