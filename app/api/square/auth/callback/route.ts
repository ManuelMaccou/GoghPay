import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import connectToDatabase from '@/app/utils/mongodb';
import { encrypt } from '@/app/lib/encrypt-decrypt';
import { cookies } from 'next/headers';
import Merchant from '@/app/models/Merchant';

const SQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENV;
const SQUARE_OBTAIN_TOKEN_URL = `https://connect.${SQUARE_ENV}.com/oauth2/token`;

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');  
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const goghMerchantId = searchParams.get('merchantId');

  // Parse the cookies from the request
  const csrfToken = cookies().get('csrfToken');
  console.log('CSRF Token in cookies:', csrfToken?.value);

  if (!csrfToken || state !== csrfToken.value) {
    return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Invalid+state+parameter`);
  }

  if (error) {
    if (error === 'access_denied') {
      return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Authorization+request+was+denied`);
    } else {
      return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=${encodeURIComponent(errorDescription || 'An error occured.')}`);
    }
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Authorization+code+not+found`);
  }

  try {
    const redirectUri = `${baseUrl}/api/square/auth/callback?merchantId=${goghMerchantId}`;
    
    const response = await axios.post('https://connect.squareupsandbox.com/oauth2/token', {
      client_id: SQUARE_CLIENT_ID,
      client_secret: SQUARE_APP_SECRET,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }, {
      headers: {
        'Square-Version': '2024-07-17',
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 200) {
      const errorData = await response.data;
      return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Failed+to+obtain+access+token&details=${encodeURIComponent(JSON.stringify(errorData))}`);
    }

    const data = await response.data;
    const { access_token, refresh_token, expires_at, merchant_id } = data;
    console.log('Authorized merchant with data:', data);

    await connectToDatabase();

    // Update the merchant's information
    const result = await Merchant.updateOne(
      { _id: goghMerchantId },
      {
        $set: {
          square_access_token: encrypt(access_token),
          square_refresh_token: encrypt(refresh_token),
          square_token_expires_at: new Date(expires_at),
          square_merchant_id: merchant_id,
        },
      },
      { upsert: true }
    );

    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Merchant+not+found+and+not+updated`);
    }

    return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=success`);
  } catch (err: any) {
    if (err.response) {
        console.error('API Error:', err.response.data);
        return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=${encodeURIComponent(err.response.data.message)}`);
    } else {
        console.error('Request Failed:', err.message);
        return NextResponse.redirect(`${baseUrl}/account/integrations?merchantId=${goghMerchantId}&status=error&message=Failed+to+fetch+data&details=${encodeURIComponent(err.message)}`);
    }
}
}