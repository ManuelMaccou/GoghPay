import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import { Client, Environment } from 'square';
import { v4 as uuidv4 } from 'uuid';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const merchantId = searchParams.get('merchantId');

  if (!email) {
    return new NextResponse('Missing email', { status: 400 });
  }

  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square_access_token);
  
  try {
    const client = createSquareClient(decryptedAccessToken);
    
    const response = await client.customersApi.searchCustomers({
      query: {
        filter: {
          emailAddress: {
            exact: email
          }
        }
      }
    });

    if (response.result.errors) {
      console.error('Error searching customers:', response.result.errors);
      return new NextResponse(JSON.stringify({ error: response.result.errors }), { status: 500 });
    }

    const customers = response.result.customers;

    if (customers && customers.length > 0) {
      return new NextResponse(JSON.stringify({ customers }), { status: 200 });
    } else {
      return new NextResponse('No customers found', { status: 404 });
    }

  } catch (error) {
    console.error('Error with Square API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const { email, merchantId, goghUserId } = await req.json();
  const idempotencyKey = uuidv4();

  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square_access_token);

  try {
    const client = createSquareClient(decryptedAccessToken);

    const response = await client.customersApi.createCustomer({
      idempotencyKey: idempotencyKey,
      emailAddress: email,
      referenceId: goghUserId
    });

    if (response.result.errors) {
      console.error('Error searching customers:', response.result.errors);
      return new NextResponse(JSON.stringify({ error: response.result.errors }), { status: 500 });
    }

    const newSquareCustomer = response.result.customer;

    if (newSquareCustomer) {
      return new NextResponse(JSON.stringify({ newSquareCustomer }), { status: 200 });
    } else {
      return new NextResponse('Error creating customer', { status: 404 });
    }

  } catch (error) {
    console.error('Error with Square API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}