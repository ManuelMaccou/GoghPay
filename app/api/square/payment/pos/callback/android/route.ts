import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming request body
    const body = await req.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    // Define expected parameters from Square POS callback
    const clientTransactionId = "com.squareup.pos.CLIENT_TRANSACTION_ID";
    const transactionId = "com.squareup.pos.SERVER_TRANSACTION_ID";
    const errorField = "com.squareup.pos.ERROR_CODE";

    // Initialize response string
    let resultString = '';

    // Check if there's an error in the response
    if (body[errorField]) {
      resultString = `Error: ${body[errorField]}<br>`;
    } else {
      // Process success response
      if (body[clientTransactionId]) {
        resultString += `Client Transaction ID: ${body[clientTransactionId]}<br>`;
      } else {
        resultString += `Client Transaction ID: NOT PROVIDED<br>`;
      }

      if (body[transactionId]) {
        resultString += `Transaction ID: ${body[transactionId]}<br>`;
      } else {
        resultString += `Transaction ID: NOT PROVIDED<br>`;
      }
    }

    // Redirect to a success page and pass the result in query parameters
    const params = new URLSearchParams({ result: resultString });
    return NextResponse.redirect(`/payment-result?${params.toString()}`, 302);

  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
