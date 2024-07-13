import { NextApiResponse } from 'next';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET!)

export async function POST(req: NextRequest, res: NextApiResponse) {
  try {
    const account = await stripe.accounts.create({
      business_profile: {
        name: 'Direct Stripe Dash Their Fee'
      },
      controller: {
        stripe_dashboard: {
          type: 'full',
        },
        losses: {
          payments: 'stripe'
        }
      }
    });

    return new Response(JSON.stringify({account: account.id }), { status: 200 });

  } catch (error) {
    console.error('Failed to create Stripe account', error);
    return new Response(JSON.stringify({ error: 'Failed to create Stripe account' }), { status: 500 });
  }
}

