import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENV;
const SQUARE_AUTH_URL = `https://connect.${SQUARE_ENV}.com/oauth2/authorize`;

export async function GET(request: NextRequest) {
  const csrfToken = crypto.randomBytes(16).toString('hex');
  const state = csrfToken;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/callback`;

  const authorizationUrl = `${SQUARE_AUTH_URL}?response_type=code&client_id=${SQUARE_CLIENT_ID}&state=${state}&redirect_uri=${redirectUri}`;

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set('csrfToken', csrfToken, { httpOnly: true, secure: true, sameSite: 'strict' });

  return response;
}

