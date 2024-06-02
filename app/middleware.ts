import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.NEXT_PUBLIC_PRIVY_SECRET!);

export async function middleware(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: "No authentication token provided." }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const verifiedClaims = await privy.verifyAuthToken(token);

    req.headers.set('user', verifiedClaims.userId);
    return NextResponse.next();
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/user*', '/api/merchant*']
};
