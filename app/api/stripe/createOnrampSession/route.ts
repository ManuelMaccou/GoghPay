import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = 'sk_test_51PUxbS2LxM74f3GjpDNRYyFWNUXcG2AJzvjTzyv9mVPq7gx2h2kEqjacRGNKsEQXhy1KYYNmvaggsHhV58223mHA00jMUPINPx';
  const url = 'https://api.stripe.com/v1/crypto/onramp_sessions';

  const purchaseAmount = await request.json();
  console.log("purchase amount:", purchaseAmount)

  const formData = new URLSearchParams();
  formData.append('wallet_address', '0x4A6737Da9668D09aCE702c3ff5e0dA33a84d28F7');
  formData.append('source_currency', 'usd');
  formData.append('destination_currency', 'usdc');
  formData.append('destination_network', 'base');
  formData.append('destination_amount', purchaseAmount);
  formData.append('destination_currencies[]', 'usdc');
  formData.append('destination_networks[]', 'base');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
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
