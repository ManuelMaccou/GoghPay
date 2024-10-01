import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers'
import { SaleFormData } from '@/app/types/types';
import { ApiError } from '@/app/utils/ApiError';
import * as Sentry from '@sentry/nextjs';

interface SquareTransactionResponse {
  transaction_id: string;
  client_transaction_id: string;
  status: string;
  error_code?: string;
  state: string;
}

interface TransactionDetails {
  transactionId: string;
  clientTransactionId: string;
  error: string| undefined;
  saleFormData: SaleFormData | null;
  goghTransactionId: string;
}

const parseTransactionDetailsFromQuery = (searchParams: URLSearchParams) => {
  try {
    const dataParam = searchParams.get("data");

    if (!dataParam) {
      console.error("No data parameter found in the URL.");
      Sentry.captureMessage('No data parameter found in Square iOS response. ')
      return null;
    }

    const data = decodeURI(dataParam);
    console.log("Raw data: " + data);

    const squareTransactionResponse: SquareTransactionResponse = JSON.parse(data);
    console.log("Transaction Info: ", squareTransactionResponse);

    const transactionId = squareTransactionResponse.transaction_id;
    const clientTransactionId = squareTransactionResponse.client_transaction_id;
    const error = squareTransactionResponse.error_code;

    let saleDataCookieName = "";
    let goghTransactionId = "";
    let saleFormData: SaleFormData | null = null;

    if (squareTransactionResponse.state) {
      const parsedState = JSON.parse(squareTransactionResponse.state);

      if (parsedState.cookieName) {
        saleDataCookieName = parsedState.cookieName;
      } else {
        console.error("Cookie name was not included in iOS callback data");
        Sentry.captureMessage("Cookie name was not included in iOS callback data");
      }

       // Get stored cookie with sale data
      const cookieStore = cookies();

      if (saleDataCookieName) {
        const saleFormDataCookie = cookieStore.get(saleDataCookieName);
      
        if (saleFormDataCookie) {
          saleFormData = JSON.parse(saleFormDataCookie.value);
          console.log('saleFormData from cookie:', saleFormData);
        } else {
          console.error("Sale data cookie was not retrieved from storage.");
          Sentry.captureMessage("Sale data cookie was not retrieved from storage.");
        }
      } else {
        console.error("Cookie name was invalid or not retrieved.");
        Sentry.captureMessage("Cookie name was invalid or not retrieved.");
      }

      if (!saleFormData) {
        console.error("Sale data not captured from stored cookie");
        Sentry.captureMessage("Cookie name was invalid or not retrieved.");
      }

      goghTransactionId = parsedState.goghTransactionId;
    }

    return {
      transactionId,
      clientTransactionId,
      error,
      saleFormData,
      goghTransactionId,
    };
  } catch (err) {
    Sentry.captureException(err)
    console.error('Error parsing transaction details:', err);
    return null;
  }
};

const fetchSquarePaymentId = async (
  transactionId: string,
  merchantId: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/orders?transactionId=${transactionId}&merchantId=${merchantId}`
    );

    const data = await response.json();
    
    if (response.ok) {
      return data.paymentId;
     
    } else {
        console.error(data.message || 'Failed to fetch payment details from Square.');
        Sentry.captureMessage(data.message || 'Failed to fetch payment details from Square.');
      }
      return null;
  } catch (err) {
    console.error('Error fetching payment details:', err);
    Sentry.captureException(err)
    return null
  }
};

const updateTransactionDetails = async (squarePaymentId: string | null, transactionDetails: TransactionDetails, statusToSave: string) => {
  try {

    const accessToken = process.env.SERVER_AUTH

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/transaction/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transactionId: transactionDetails.goghTransactionId,
        clientTransactionId: transactionDetails.clientTransactionId,
        status: statusToSave,
        squarePaymentId,
      }),
    });
    const responseData = await response.json();

    if (!response.ok) {
      const apiError = new ApiError(
        `API Error11: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
        response.status,
        responseData
      );
      Sentry.captureException(apiError);
      console.error('Transaction update failed:', apiError);
      return false
    } else {
      return true
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    return false
  }
}

const updateRewards = async (transactionDetails: TransactionDetails, priceAfterDiscount: number): Promise<{ success: boolean; customerUpgraded?: boolean }> => {
  console.log('updating rewards with data:', transactionDetails);

  const accessToken = process.env.SERVER_AUTH

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/rewards/userRewards/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        purchaseData: transactionDetails.saleFormData,
        priceAfterDiscount,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const apiError = new ApiError(
        `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
        response.status,
        responseData
      );
      Sentry.captureException(apiError);
      console.error(apiError);
      return { success: false };
    } else {
      return { success: true, customerUpgraded: responseData.customerUpgraded };
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    return { success: false };
  }
}

const fetchAndUpdatePaymentDetails = async (
  transactionDetails:TransactionDetails,
  statusToSave: string,
  priceAfterDiscount: number,
  finalSquarePaymentResults: { 
    squarePaymentIdCaptured: boolean | 'NA', 
    successfulResponseFromSquare: boolean,
    transactionUpdatedWithSquareData: boolean,
    rewardsUpdatedInGogh: boolean,
    customerUpgraded: boolean,
    rawData: TransactionDetails | null 
  }
): Promise<{
  squarePaymentIdCaptured: boolean | 'NA',
  successfulResponseFromSquare: boolean,
  transactionUpdatedWithSquareData: boolean,
  rewardsUpdatedInGogh: boolean,
  customerUpgraded: boolean,
  rawData: TransactionDetails | null
}> => {

  try {
    console.log('fetchAndUpdatePaymentDetails is running');
    let squarePaymentId: string | null = null;

    if (transactionDetails.transactionId && transactionDetails.saleFormData?.sellerMerchant) {
      const fetchedSquarePaymentId = await fetchSquarePaymentId(
        transactionDetails.transactionId,
        transactionDetails.saleFormData?.sellerMerchant?._id,
      );

      console.log('fetchedSquarePaymentId:', fetchedSquarePaymentId)

      if (fetchedSquarePaymentId) {
        squarePaymentId = fetchedSquarePaymentId;
        finalSquarePaymentResults.squarePaymentIdCaptured = true;
      } else {
        finalSquarePaymentResults.squarePaymentIdCaptured = false;
      }
    } else {
      finalSquarePaymentResults.squarePaymentIdCaptured = 'NA';
    }

    if (transactionDetails.goghTransactionId) {
      const transactionUpdateSuccess = await updateTransactionDetails(
        squarePaymentId,
        transactionDetails,
        statusToSave
      );
      finalSquarePaymentResults.transactionUpdatedWithSquareData = transactionUpdateSuccess;
    } else {
      console.error('Gogh transaction ID is missing')
      finalSquarePaymentResults.transactionUpdatedWithSquareData = false;
    }
    
    if (transactionDetails.saleFormData?.customer?.userInfo._id) {
      const rewardsUpdateResponse = await updateRewards(transactionDetails, priceAfterDiscount)
      finalSquarePaymentResults.rewardsUpdatedInGogh = rewardsUpdateResponse.success;

      if (rewardsUpdateResponse.customerUpgraded) {
        finalSquarePaymentResults.customerUpgraded = rewardsUpdateResponse.customerUpgraded;
      }

    } else {
      finalSquarePaymentResults.rewardsUpdatedInGogh = false;
    }

  } catch (error) {
    Sentry.captureException(error);
    console.error('Error updating payment details:', error);
  } finally {
    Sentry.captureException(finalSquarePaymentResults);
    return finalSquarePaymentResults;
  }
}


const handleSquareCallback = async (
  req: NextRequest,
  method: string
) => {

  let finalSquarePaymentResults: {
    squarePaymentIdCaptured: boolean | 'NA',
    successfulResponseFromSquare: boolean,
    transactionUpdatedWithSquareData: boolean,
    rewardsUpdatedInGogh: boolean,
    customerUpgraded: boolean,
    rawData: TransactionDetails | null
  } = {
    squarePaymentIdCaptured: false,
    successfulResponseFromSquare: false,
    transactionUpdatedWithSquareData: false,
    rewardsUpdatedInGogh: false,
    customerUpgraded: false,
    rawData: null
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const transactionDetails = parseTransactionDetailsFromQuery(searchParams);

    if (!transactionDetails) {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    const priceNum = parseFloat(transactionDetails.saleFormData?.price || '0')
    let rewardsDiscountAmount: number = 0;
    let welcomeDiscountAmount: number = 0;
    let priceAfterDiscount: number = priceNum;

    if (transactionDetails.saleFormData?.sellerMerchant?.rewards?.welcome_reward && transactionDetails.saleFormData?.customer?.purchaseCount === 1) {
      welcomeDiscountAmount = transactionDetails.saleFormData?.sellerMerchant?.rewards?.welcome_reward
    }

    if (transactionDetails.saleFormData?.customer && transactionDetails.saleFormData?.customer.currentDiscount?.amount) {
      rewardsDiscountAmount = transactionDetails.saleFormData?.customer.currentDiscount?.amount
    }

    const totalDiscountAmount = Math.max(rewardsDiscountAmount, welcomeDiscountAmount);

    if (transactionDetails.saleFormData?.customer && transactionDetails.saleFormData?.customer?.currentDiscount?.type === 'percent') {
      if (totalDiscountAmount > 100) {
        priceAfterDiscount = 0

      } else {
        priceAfterDiscount = priceNum - ((totalDiscountAmount/100) * priceNum)
      }

    } else if (transactionDetails.saleFormData?.customer && transactionDetails.saleFormData?.customer.currentDiscount?.type === 'dollar') {
      priceAfterDiscount = priceNum - totalDiscountAmount
      if (priceAfterDiscount < 0) {
        priceAfterDiscount = 0
      }
    }

    const {
      transactionId,
      clientTransactionId,
      error,
      saleFormData,
      goghTransactionId,
    } = transactionDetails;

    let redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sell?status=`;
    let status = "error";
    let statusToSave = "PENDING";
    let message = "Unknown error occurred.";

    if (!transactionId && clientTransactionId) {
      statusToSave = "COMPLETE_OFFLINE";
      finalSquarePaymentResults.successfulResponseFromSquare = true
    } else if (transactionId && clientTransactionId) {
      statusToSave = "COMPLETE";
      finalSquarePaymentResults.successfulResponseFromSquare = true
    } else if (transactionId && !clientTransactionId) {
      statusToSave = "COMPLETE";
      finalSquarePaymentResults.successfulResponseFromSquare = true
    } else {
      statusToSave = "ERROR";
      finalSquarePaymentResults.successfulResponseFromSquare = false

    }

    if (error) {
      if (error === 'Error: payment_canceled') {
        message = 'Payment canceled'
        status = 'canceled'
      } else {
        message = `Error: ${error}`;
        Sentry.captureException(error)
      }

      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;

    } else if (transactionId || clientTransactionId) {
      status = "success";
      message = `Payment successful.`;

      await fetchAndUpdatePaymentDetails(transactionDetails, statusToSave, priceAfterDiscount, finalSquarePaymentResults)

      redirectUrl += `${status}&rewardsUpdated=${encodeURIComponent(finalSquarePaymentResults.rewardsUpdatedInGogh)}&customerUpgraded=${finalSquarePaymentResults.customerUpgraded}`;
    } else {
      console.log("No valid transaction ID provided from Square.");
      message = 'Bad response from Square. Please try again.'
      redirectUrl += `${status}&message=${encodeURIComponent(message)}`;
    }

    console.log("Redirecting to URL:", redirectUrl);

    // Redirect to /sell with appropriate query parameters
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    Sentry.captureException(error)
    console.error('Error processing Square POS callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleSquareCallback(req, 'POST');
}

export async function GET(req: NextRequest) {
  return handleSquareCallback(req, 'GET');
}