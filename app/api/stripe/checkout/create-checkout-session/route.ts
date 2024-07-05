import { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation'
import { stripe } from '@/app/lib/stripe';
import { Merchant } from '@/app/types/types';

export async function POST(req: NextRequest, res: NextApiResponse) {
  try {
    const { stripeConnectedAccountId, merchantId, merchantObject, product, price, walletAddress, redirectURL } = await req.json();

    console.log("Received price:", price);

    if (typeof price !== 'number' || isNaN(price)) {
      console.error('Received price is not a valid number:', price);
    }

    const priceInCents = 100 * 100;
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
      payment_intent_data: {
        description: `${merchantObject.name}: ${product}`,
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: 'acct_1PW1xk2MUQAQ5FGs',
        },
      },
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&merchantId=${merchantId}&merchantWalletAddress=${merchantWalletAddress}&price=${price}`,
      cancel_url: redirectURL,
    }
  );
    if (session.url) {
      console.log("session url:", session.url)
      return NextResponse.json({ url:session.url }, { status: 200 });
      
    } else {
      console.error('Session URL is null');
      return new Response(JSON.stringify({ error: 'Session URL is null' }), { status: 500 });
    }
  } catch (error) {
    console.error('Failed to create Stripe checkout session', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), { status: 500 });
  }
}
