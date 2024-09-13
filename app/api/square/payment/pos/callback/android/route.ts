import { NextRequest, NextResponse } from 'next/server';

interface Metadata {
  merchantId?: string;
  goghTransactionId?: string;
  rewardsCustomer?: string;
}

const parseTransactionDetailsFromQuery = (searchParams: URLSearchParams) => {
  const clientTransactionId = searchParams.get("com.squareup.pos.CLIENT_TRANSACTION_ID");
  const serverTransactionId = searchParams.get("com.squareup.pos.SERVER_TRANSACTION_ID");
  const errorField = searchParams.get("com.squareup.pos.ERROR_CODE");
  
  // Decode the metadata JSON string if it exists
  const metadataString = searchParams.get('com.squareup.pos.REQUEST_METADATA');
  let metadata: Metadata = {};
  if (metadataString) {
    try {
      // Decode the URL-encoded metadata and parse it as JSON
      metadata = JSON.parse(decodeURIComponent(metadataString));
      console.log('Parsed metadata:', metadata);
    } catch (err) {
      console.error('Error parsing metadata:', err);
    }
  } else {
    console.log('No metadata found in query parameters');
  }

  return { clientTransactionId, serverTransactionId, errorField, metadata };
};

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  try {
    const { clientTransactionId, serverTransactionId, errorField, metadata } = parseTransactionDetailsFromQuery(searchParams);
    const { merchantId = '', goghTransactionId = '', rewardsCustomer = '' } = metadata;

    //let redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sell?status=`;
    let redirectUrl = `https://clear-terms-doubt.loca.lt/sell?status=`;
    let status = "error";
    let statusToSave = 'PENDING'
    let message = "Unknown error occurred.";

    if (!serverTransactionId && clientTransactionId) {
      statusToSave = "COMPLETE_OFFLINE";
    } else if (serverTransactionId && clientTransactionId) {
      statusToSave = "COMPLETE";
    } else if (serverTransactionId && !clientTransactionId) {
      statusToSave = "COMPLETE";
    } else {
      statusToSave = "PENDING";
    }

    if (errorField) {
      message = `Error: ${errorField}`;
      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;
    } else if (serverTransactionId || clientTransactionId) {
      // Success case: Add transaction details
      status = "success";
      message = `Payment successful.`;
      
      redirectUrl += `${status}&statusToSave=${encodeURIComponent(statusToSave)}&clientTransactionId=${encodeURIComponent(clientTransactionId || '')}&serverTransactionId=${encodeURIComponent(serverTransactionId || '')}&merchantId=${encodeURIComponent(merchantId)}&goghTransactionId=${encodeURIComponent(goghTransactionId)}&rewardsCustomer=${encodeURIComponent(rewardsCustomer)}`;
    } else {
      // No valid transaction IDs
      console.log("No valid transaction ID provided from Square.");
      redirectUrl += status;
    }

    console.log("Redirecting to URL:", redirectUrl);

    // Redirect to /sell with the appropriate query params
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  try {
    const { clientTransactionId, serverTransactionId, errorField, metadata } = parseTransactionDetailsFromQuery(searchParams);
    const { merchantId = '', goghTransactionId = '', rewardsCustomer = '' } = metadata;

    //let redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sell?status=`;
    let redirectUrl = `https://clear-terms-doubt.loca.lt/sell?status=`;
    let status = "error";
    let statusToSave = 'PENDING'
    let message = "Unknown error occurred.";

    if (!serverTransactionId && clientTransactionId) {
      statusToSave = "COMPLETE_OFFLINE";
    } else if (serverTransactionId && clientTransactionId) {
      statusToSave = "COMPLETE";
    } else if (serverTransactionId && !clientTransactionId) {
      statusToSave = "COMPLETE";
    } else {
      statusToSave = "PENDING";
    }

    if (errorField) {
      message = `Error: ${errorField}`;
      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;
    } else if (serverTransactionId || clientTransactionId) {
      // Success case: Add transaction details
      status = "success";
      message = `Payment successful.`;
      
      redirectUrl += `${status}&statusToSave=${encodeURIComponent(statusToSave)}&clientTransactionId=${encodeURIComponent(clientTransactionId || '')}&serverTransactionId=${encodeURIComponent(serverTransactionId || '')}&merchantId=${encodeURIComponent(merchantId)}&goghTransactionId=${encodeURIComponent(goghTransactionId)}&rewardsCustomer=${encodeURIComponent(rewardsCustomer)}`;
    } else {
      // No valid transaction IDs
      console.log("No valid transaction ID provided from Square.");
      redirectUrl += status;
    }

    console.log("Redirecting to URL:", redirectUrl);

    // Redirect to /sell with the appropriate query params
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}