// app/api/auth/square/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/app/lib/ironSession';
import { generateCsrfToken } from '@/app/lib/csrf';

const SQUARE_CLIENT_ID = process.env.SQUARE_CLIENT_ID;
const SQUARE_REDIRECT_URI = process.env.SQUARE_REDIRECT_URI;
const SQUARE_AUTH_URL = 'https://connect.squareup.com/oauth2/authorize';

export async function GET(request: NextRequest) {
  const csrfToken = generateCsrfToken();
  request.session.csrfToken = csrfToken;
  await request.session.save();

  const authUrl = `${SQUARE_AUTH_URL}?client_id=${SQUARE_CLIENT_ID}&response_type=code&redirect_uri=${SQUARE_REDIRECT_URI}&state=${csrfToken}`;

  return NextResponse.json({ authUrl });
}

export const handler = withSession(GET);
