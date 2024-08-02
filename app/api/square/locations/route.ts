import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';

export async function GET(request: NextRequest) {
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

    const decryptedAccessToken = decrypt(merchant.square_access_token);
    const client = new Client({
      accessToken: decryptedAccessToken,
      environment: process.env.NEXT_PUBLIC_SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
    });
    const response = await client.locationsApi.listLocations();
    console.log(response.result);
    return new NextResponse(JSON.stringify(response.result), { status: 200 });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}