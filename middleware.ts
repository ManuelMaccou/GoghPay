import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import * as Sentry from '@sentry/nextjs';

// Initialize the PrivyClient with the app ID and secret.
const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_SECRET!);

export async function middleware(req: NextRequest) {
    try {
      // Extract the Authorization header from the request
      const authHeader = req.headers.get('authorization');
      const serverAuth = `Bearer ${process.env.SERVER_AUTH}`;

      // If there is no Authorization header or it doesn't start with 'Bearer ', return an unauthorized response.
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("No authentication token provided or invalid format:", { authHeader });
        Sentry.captureException(new Error(`No authentication token provided or invalid format. Auth Header: ${authHeader}`));
        return NextResponse.json({ message: "No authentication token provided." }, { status: 401 });
      }

      if (authHeader === serverAuth) {
        console.log("Server-side authorization detected, bypassing Privy authentication.");
        return NextResponse.next();
      }

      // Extract the token from the Authorization header
      const token = authHeader.split(' ')[1];

      // Verify the token using the Privy client
      const verifiedClaims = await privy.verifyAuthToken(token);

      // Clone the request headers and set a new header with the user ID
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', verifiedClaims.userId);

      // Proceed with the request, adding the modified headers
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error("Authentication error:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error,
      });

      // Return an unauthorized response with an appropriate message
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
    }
  }

export const config = {
  matcher: [
    '/api/merchant/verifyMerchantStatus/:path*',
    '/api/user/update',
    '/api/transfer',
    '/api/transaction',
    '/api/transaction/update',
    '/api/merchant/update',
    '/api/rewards/milestone',
    '/api/rewards/userRewards/:path*',
    '/api/square/user',
    '/api/rewards/userRewards/customers',
    '/api/rewards/userRewards/update',
    '/api/square/payment/creditCard',
    '/api/comms/text/',
    '/api/user/import-privy-user',
  ]
};

