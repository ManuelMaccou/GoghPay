import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import Transaction from '@/app/models/Transaction';
import * as Sentry from '@sentry/nextjs';
import { createHmac, timingSafeEqual } from 'crypto';
import connectToDatabase from '@/app/utils/mongodb';

export const config = {
  api: {
    bodyParser: false,
  },
};

const NOTIFICATION_URL = process.env.SQUARE_NOTIFICATION_URL;
const SIGNATURE_KEY = process.env.TERMINAL_CHECKOUT_WEBHOOK_SIG_KEY!;

function isFromSquare(signature: string | undefined, body: string): boolean {
  if (!signature) {
    return false;
  }

  const hmac = createHmac('sha256', SIGNATURE_KEY)
    .update(NOTIFICATION_URL + body)
    .digest('base64');

  const bufferSignature = Buffer.from(signature, 'base64');
  const bufferHmac = Buffer.from(hmac, 'base64');

  try {
    return timingSafeEqual(bufferSignature, bufferHmac);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  await connectToDatabase();
  try {
    // Use the `headers()` function to get the headers
    const headersList = await nextHeaders();
    const signature = headersList.get('x-square-hmacsha256-signature');

    if (!signature) {
      console.error('Signature header is missing or empty.');
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
    }

    const rawBody = await request.text();
    console.log('Raw request body:', rawBody);
    console.log('Request headers:', JSON.stringify([...headersList.entries()], null, 2));

    if (!isFromSquare(signature, rawBody)) {
      console.error('Invalid signature. Request did not come from Square.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

    //const referenceId = body?.data?.object?.checkout?.reference_id;
    const referenceId = "67241a2d8c50a3e0502bea73";
    const status = body?.data?.object?.checkout?.status;

    if (!referenceId || !status) {
      return NextResponse.json({ error: 'Invalid webhook payload: Missing reference ID or status' }, { status: 400 });
    }

    console.log('Received webhook:', JSON.stringify(body, null, 2));

    const transaction = await Transaction.findOne({ referenceId });

    if (!transaction) {
      console.error(`Transaction with reference ID ${referenceId} not found.`);
      return NextResponse.json({ error: `Transaction with reference ID ${referenceId} not found` }, { status: 404 });
    }

    transaction.status = status;
    await transaction.save();

    return NextResponse.json({ message: `Transaction with reference ID ${referenceId} updated successfully`, updatedStatus: status }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error processing webhook:', error);

    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
