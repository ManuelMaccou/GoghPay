import { NextRequest, NextResponse } from 'next/server';

const parseTransactionDetailsFromQuery = (searchParams: URLSearchParams) => {
  try {
    const dataParam = searchParams.get("data");

    if (!dataParam) {
      console.error("No data parameter found in the URL.");
      return null;
    }

    const data = decodeURI(dataParam);
    console.log("Raw data: " + data);

    const transactionInfo = JSON.parse(data);
    console.log("Transaction Info: ", transactionInfo);

    const transactionId = transactionInfo.transaction_id;
    const clientTransactionId = transactionInfo.client_transaction_id;
    const status = transactionInfo.status;
    const error = transactionInfo.error_code;

    let merchantId = "";
    let goghTransactionId = "";
    let rewardsCustomer = "";

    if (transactionInfo.state) {
      const parsedState = JSON.parse(transactionInfo.state);

      merchantId = parsedState.merchantId;
      goghTransactionId = parsedState.goghTransactionId;
      rewardsCustomer = parsedState.rewardsCustomer;

      console.log("Merchant ID: ", merchantId);
      console.log("Gogh Transaction ID: ", goghTransactionId);
      console.log("Rewards Customer: ", rewardsCustomer);
    }

    return {
      transactionId,
      clientTransactionId,
      status,
      error,
      merchantId,
      goghTransactionId,
      rewardsCustomer,
    };
  } catch (err) {
    console.error('Error parsing transaction details:', err);
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const transactionDetails = parseTransactionDetailsFromQuery(searchParams);

    if (!transactionDetails) {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    const {
      transactionId,
      clientTransactionId,
      error,
      merchantId,
      goghTransactionId,
      rewardsCustomer,
    } = transactionDetails;

    // Initial redirect URL and status
    let redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sell?status=`;
    let status = "error";
    let statusToSave = "PENDING";
    let message = "Unknown error occurred.";

    if (!transactionId && clientTransactionId) {
      statusToSave = "COMPLETE_OFFLINE";
    } else if (transactionId && clientTransactionId) {
      statusToSave = "COMPLETE";
    } else if (transactionId && !clientTransactionId) {
      statusToSave = "COMPLETE";
    } else {
      statusToSave = "PENDING";
    }

    if (error) {
      message = `Error: ${error}`;
      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;
    } else if (transactionId || clientTransactionId) {
      // Successful transaction case
      status = "success";
      message = `Payment successful.`;

      redirectUrl += `${status}&statusToSave=${encodeURIComponent(statusToSave)}&clientTransactionId=${encodeURIComponent(clientTransactionId || '')}&serverTransactionId=${encodeURIComponent(transactionId || '')}&merchantId=${encodeURIComponent(merchantId)}&goghTransactionId=${encodeURIComponent(goghTransactionId)}&rewardsCustomer=${encodeURIComponent(rewardsCustomer)}`;
    } else {
      console.log("No valid transaction ID provided from Square.");
      redirectUrl += status;
    }

    console.log("Redirecting to URL:", redirectUrl);

    // Redirect to /sell with appropriate query parameters
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const transactionDetails = parseTransactionDetailsFromQuery(searchParams);

    if (!transactionDetails) {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    const {
      transactionId,
      clientTransactionId,
      error,
      merchantId,
      goghTransactionId,
      rewardsCustomer,
    } = transactionDetails;

    // Initial redirect URL and status
    let redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sell?status=`;
    let status = "error";
    let statusToSave = "PENDING";
    let message = "Unknown error occurred.";

    if (!transactionId && clientTransactionId) {
      statusToSave = "COMPLETE_OFFLINE";
    } else if (transactionId && clientTransactionId) {
      statusToSave = "COMPLETE";
    } else if (transactionId && !clientTransactionId) {
      statusToSave = "COMPLETE";
    } else {
      statusToSave = "PENDING";
    }

    if (error) {
      message = `Error: ${error}`;
      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;
    } else if (transactionId || clientTransactionId) {
      // Successful transaction case
      status = "success";
      message = `Payment successful.`;

      redirectUrl += `${status}&statusToSave=${encodeURIComponent(statusToSave)}&clientTransactionId=${encodeURIComponent(clientTransactionId || '')}&serverTransactionId=${encodeURIComponent(transactionId || '')}&merchantId=${encodeURIComponent(merchantId)}&goghTransactionId=${encodeURIComponent(goghTransactionId)}&rewardsCustomer=${encodeURIComponent(rewardsCustomer)}`;
    } else {
      console.log("No valid transaction ID provided from Square.");
      redirectUrl += status;
    }

    console.log("Redirecting to URL:", redirectUrl);

    // Redirect to /sell with appropriate query parameters
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}