import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize the PrivyClient with the app ID and secret
const privy = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_SECRET!);

export async function middleware(req: NextRequest) {
  const { pathname } = new URL(req.url);

  // Get the mobile-only setting from the environment variable
  const mobileOnly = process.env.NEXT_PUBLIC_MOBILE_ONLY === 'true';

  // Check if the request is coming from a mobile device for non-auth routes if mobile-only restriction is enabled
  if (mobileOnly && pathname !== '/mobile-only' && !pathname.startsWith('/api/')) {
    const userAgent = req.headers.get('user-agent') || '';
    const isMobile = /Mobi|Android/i.test(userAgent);

    // If the request is not from a mobile device, redirect to the mobile-only page
    if (!isMobile) {
      return NextResponse.redirect(new URL('/mobile-only', req.url));
    }
  }

  // Apply authentication logic for specific API routes
  if (pathname.startsWith('/api/merchant/verifyMerchantStatus') || pathname.startsWith('/api/user/update') || pathname.startsWith('/api/transfer')) {
    try {
      // Extract the Authorization header from the request
      const authHeader = req.headers.get('authorization');

      // If there is no Authorization header or it doesn't start with 'Bearer ', return an unauthorized response.
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

  // For other routes, proceed as usual
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/merchant/verifyMerchantStatus/:path*', 
    '/api/user/update', 
    '/api/transfer',
    '/:path*'  // Apply middleware to all routes for the mobile check
  ]
};
