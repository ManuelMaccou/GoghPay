import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET;
  const url = 'https://api.stripe.com/v1/crypto/onramp_sessions';

  const { searchParams } = new URL(request.url);
  const purchaseAmount = searchParams.get('amount');
  const address = searchParams.get('address');
  console.log("purchase amount:", purchaseAmount)

  const formData = new URLSearchParams();
  if (address) {
    formData.append('wallet_address', address);
  }
  formData.append('source_currency', 'usd');
  formData.append('destination_currency', 'usdc');
  formData.append('destination_network', 'base');
  if (purchaseAmount) {
    formData.append('destination_amount', purchaseAmount);
  }
  formData.append('destination_currencies[]', 'usdc');
  formData.append('destination_networks[]', 'base');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(secret + ':').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();
    console.log('stripe response:', data);

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred while creating the onramp session' }, { status: 500 });
  }
}
