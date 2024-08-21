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

    if (!merchant.square_access_token) {
      return new NextResponse('No access token', { status: 401 });
    }

    const decryptedAccessToken = decrypt(merchant.square_access_token);

    const client = new Client({
      accessToken: decryptedAccessToken,
      environment: process.env.NEXT_PUBLIC_SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
    });
    const response = await client.locationsApi.listLocations();

    console.log(response.result);
    return new NextResponse(JSON.stringify(response.result), { status: 200 });
  } catch (error: unknown) {
    console.error('Error fetching locations:', error);

    if (isApiErrorResponse(error)) {
      const { status, errors } = error.response;

      if (status === 401) {
        if (errors.some((err: any) => err.code === 'ACCESS_TOKEN_EXPIRED')) {
          return new NextResponse('Access token expired', { status: 401 });
        } else if (errors.some((err: any) => err.code === 'ACCESS_TOKEN_REVOKED')) {
          return new NextResponse('Access token revoked', { status: 401 });
        } else {
          return new NextResponse('Unauthorized', { status: 401 });
        }
      }

      if (status === 403) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Type guard to check if error is an API error response
function isApiErrorResponse(error: any): error is { response: { status: number; errors: { code: string }[] } } {
  return error && typeof error === 'object' && 'response' in error && 'status' in error.response && Array.isArray(error.response.errors);
}
