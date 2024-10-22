
import { stripe } from '@/app/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  console.log('sessionID in API call:', sessionId);

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const buyerDetails = session.customer_details;
    return NextResponse.json({ buyerDetails }, { status: 200 });
  } catch (error) {
    console.error('Failed to retrieve session:', error);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }

}