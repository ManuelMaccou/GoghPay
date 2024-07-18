import { NextRequest, NextResponse } from 'next/server';
import fetch, { RequestInit } from 'node-fetch';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return new NextResponse(JSON.stringify({ error: 'Address parameter is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const fetchURL = process.env.NEXT_PUBLIC_ALCHEMY_URL!;
  const usdcContactAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS;

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "jsonrpc": "2.0",
      "method": "alchemy_getTokenBalances",
      "params": [address, [usdcContactAddress]],
      "id": 42
    }),
    redirect: 'follow'
  };

  try {
    const response = await fetch(fetchURL, requestOptions);
    const data = await response.json();
    if (!data.result) {
      throw new Error('Invalid response from the Alchemy API');
    }

    const decimals = 6;
    const balances = data.result.tokenBalances;
    const balanceInHex = balances[0].tokenBalance;
    const decimalValue = BigInt(balanceInHex);
    const readableBalance = Number(decimalValue) / (10 ** decimals); // Convert balance to a decimal value
    const formattedBalance = readableBalance.toFixed(2); // Format the balance to 2 decimal places

    return new NextResponse(JSON.stringify({
      balance: formattedBalance
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
