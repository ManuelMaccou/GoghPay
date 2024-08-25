import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const transactionInfo = JSON.parse(body);

    let resultString = '';

    const clientTransactionId = 'client_transaction_id';
    const transactionId = 'transaction_id';
    const errorField = 'error_code';

    if (errorField in transactionInfo) {
      resultString = `Error: ${transactionInfo[errorField]}<br>`;
    } else {
      resultString += `Client Transaction ID: ${transactionInfo[clientTransactionId]}<br>`;
      resultString += `Transaction ID: ${transactionInfo[transactionId]}<br>`;
    }

    return NextResponse.json({ result: resultString }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
