import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming request body (assuming JSON body)
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

    // Return the response
    return NextResponse.json({ result: resultString }, { status: 200 });

  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
