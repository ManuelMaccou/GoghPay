import Merchant from '@/app/models/Merchant';
import connectToDatabase from '@/app/utils/mongodb';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { merchantId, customerEmail } = await req.json();

  if (!merchantId) {
    return NextResponse.json(
      { error: 'MerchantId required.' },
      { status: 400 }
    );
  }

  if (!customerEmail) {
    return NextResponse.json(
      { error: 'customer email required.' },
      { status: 400 }
    );
  }

  const merchant = await Merchant.findOne({ _id: merchantId });
  if (!merchant) {
    console.log("merchant not found");
    return NextResponse.json(
      { error: `Merchant not found with ID ${merchantId}.` },
      { status: 404 }
    );
  }

  const shop = merchant.shopify?.shopName
  if (!shop) {
    console.log("shop not found");
    return NextResponse.json(
      { error: `shop not found with merchant ID ${merchantId}.` },
      { status: 404 }
    );
  }

  const accessToken = merchant.shopify?.access_token
  if (!accessToken) {
    console.log("accessToken not found");
    return NextResponse.json(
      { error: `accessToken not found with merchant ID ${merchantId}.` },
      { status: 404 }
    );
  }

  await connectToDatabase();

  try {
    const response = await fetch(`https://${shop}.myshopify.com/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          query SearchCustomerByEmail {
            customers(first: 1, query: "email:${customerEmail}") {
              nodes {
                id
                firstName
                lastName
                email
                amountSpent {
                  amount
                  currencyCode
                }
              }
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch user from Shopify API.' },
      { status: 500 }
    );
  }
}
