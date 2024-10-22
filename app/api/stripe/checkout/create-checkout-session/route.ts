import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/app/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { stripeConnectedAccountId, merchantId, merchantObject, product, price, finalPrice, walletAddress, redirectURL } = await req.json();

    console.log("Received price:", finalPrice);

    if (typeof finalPrice !== 'number' || isNaN(finalPrice)) {
      console.error('Received price is not a valid number:', finalPrice);
    }

    const priceInCents = finalPrice * 100;
    const merchantWalletAddress = walletAddress;

    let applicationFee;

    if (merchantObject.promo) {
      applicationFee = Math.round(priceInCents * .01);
    } else {
      applicationFee = Math.round(priceInCents * 0.029 + 30);
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: product,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success/crypto?session_id={CHECKOUT_SESSION_ID}&merchantId=${merchantId}&merchantWalletAddress=${merchantWalletAddress}&productName=${product}&price=${finalPrice}`,
      cancel_url: redirectURL,
    },
    {
      stripeAccount: stripeConnectedAccountId,
    }
  );
    if (session.url) {
      console.log("session url:", session.url)
      return NextResponse.json({ url:session.url }, { status: 200 });
      
    } else {
      console.error('Session URL is null');
      return NextResponse.json({ error: 'Session URL is null' }, { status: 500 });    }
  } catch (error) {
    console.error('Failed to create Stripe checkout session', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
