
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/ironSession';

const SQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENV;
const SQUARE_OBTAIN_TOKEN_URL = `https://connect.${SQUARE_ENV}.com/oauth2/token`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const session = await getSession(request); 

  if (state !== session.csrfToken) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 403 });
  }

  if (error) {
    if (error === 'access_denied') {
      return NextResponse.json({ message: 'Authorization request was denied by the seller.' });
    } else {
      return NextResponse.json({ error: error, error_description: errorDescription }, { status: 400 });
    }
  }

  try {
    const response = await fetch(SQUARE_OBTAIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Square-Version': '2021-05-13',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SQUARE_CLIENT_ID,
        client_secret: SQUARE_APP_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: 'Failed to obtain access token', details: errorData }, { status: 500 });
    }

    const data = await response.json();

    session.accessToken = data.access_token;
    session.refreshToken = data.refresh_token;
    await session.save();

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: 'An unexpected error occurred', details: err.message }, { status: 500 });
  }
}
