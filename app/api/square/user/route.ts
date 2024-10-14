import { NextRequest, NextResponse } from 'next/server';
import { createSquareClient } from '@/app/lib/square';
import { v4 as uuidv4 } from 'uuid';
import Merchant from '@/app/models/Merchant';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import * as Sentry from '@sentry/nextjs';
import { Customer } from 'square';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email') ? decodeURIComponent(searchParams.get('email')!) : null;
  const phone = searchParams.get('phone') ? decodeURIComponent(searchParams.get('phone')!) : null;
  const merchantId = searchParams.get('merchantId');
  const privyId = searchParams.get('privyId');

  if (!phone && !email) {
    return new NextResponse('Missing contact info', { status: 400 });
  }

  if (!merchantId) {
    return new NextResponse('Missing merchantId', { status: 400 });
  }

  if (!privyId) {
    return new NextResponse('Missing privyId for auth', { status: 400 });
  }

  const userIdFromToken = request.headers.get('x-user-id');

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);
  
  try {
    const client = createSquareClient(decryptedAccessToken);
  
    let response;
    let customers: Customer[] = [];
  
    // First, try to search by phone if provided
    if (phone) {
      response = await client.customersApi.searchCustomers({
        query: {
          filter: {
            phoneNumber: {
              exact: phone,
            },
          },
        },
      });
  
      // Check if the response and the customers array exists
      if (response?.result?.customers && response.result.customers.length > 0) {
        customers = response.result.customers;
      }
    }
  
    // If no customers were found by phone, and email is provided, search by email
    if (customers.length === 0 && email) {
      response = await client.customersApi.searchCustomers({
        query: {
          filter: {
            emailAddress: {
              exact: email,
            },
          },
        },
      });
  
      // Check if we found any customers with the email
      if (response?.result?.customers && response.result.customers.length > 0) {
        customers = response.result.customers;
      }
    }
  
    // Handle errors from Square API
    if (response?.result?.errors) {
      console.error('Error searching customers:', response.result.errors);
      return new NextResponse(JSON.stringify({ error: response.result.errors }), { status: 500 });
    }
  
    // If customers were found, return the sanitized result
    if (customers.length > 0) {
      const sanitizedCustomers = customers.map(({ version, ...rest }) => rest);
      return new NextResponse(JSON.stringify({ customers: sanitizedCustomers }), { status: 200 });
    } else {
      // If no customers were found, return 204 status
      return new NextResponse(null, { status: 204 });
    }
  
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error with Square API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
  
}

export async function POST(req: NextRequest) {

  console.log("creating new square user");

  const { email, phone, merchantId, goghUserId, privyId, note } = await req.json();
  const idempotencyKey = uuidv4();

  if (!merchantId) {
    return new NextResponse('Missing merchantId for auth', { status: 400 });
  }

  if (!privyId) {
    return new NextResponse('Missing privyId for auth', { status: 400 });
  }

  const userIdFromToken = req.headers.get('x-user-id');

  if (!userIdFromToken || userIdFromToken !== privyId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return new NextResponse('Merchant not found in db', { status: 404 });
  }

  const decryptedAccessToken = decrypt(merchant.square.access_token);

  try {
    const client = createSquareClient(decryptedAccessToken);

    const response = await client.customersApi.createCustomer({
      idempotencyKey: idempotencyKey,
      emailAddress: email,
      phoneNumber: phone,
      referenceId: goghUserId,
      note,
    });

    if (response.result.errors) {
      console.error('Error searching customers:', response.result.errors);
      return new NextResponse(JSON.stringify({ error: response.result.errors }), { status: 500 });
    }

    const newSquareCustomer = response.result.customer;

    if (newSquareCustomer) {

      const { version, ...sanitizedCustomer } = newSquareCustomer;
      
      return new NextResponse(JSON.stringify({ newSquareCustomer: sanitizedCustomer }), { status: 200 });
    } else {
      return new NextResponse('There was an error checking in and we are looking into it.', { status: 404 });
    }

  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}