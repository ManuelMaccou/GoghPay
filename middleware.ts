import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize the PrivyClient with the app ID and secret
const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.NEXT_PUBLIC_PRIVY_SECRET!);

export async function middleware(req: NextRequest) {
  console.log("entering middleware")
  try {
    // Extract the Authorization header from the request
    const authHeader = req.headers.get('authorization');
    
    // If there is no Authorization header or it doesn't start with 'Bearer ', return an unauthorized response
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: "No authentication token provided." }, { status: 401 });
    }

    // Extract the token from the Authorization header
    const token = authHeader.split(' ')[1];

    // Verify the token using the Privy client
    const verifiedClaims = await privy.verifyAuthToken(token);

    // Clone the request headers and set a new header with the user ID
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', verifiedClaims.userId);

    console.log("middleware request headers:", requestHeaders)

    // Proceed with the request, adding the modified headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // Log the error to the console for debugging purposes
    console.error("Authentication error:", error);

    // Return an unauthorized response with an appropriate message
    return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/merchant/:verifyMerchantStatus*', '/api/transaction']
};

