'use client'

import { useEffect, useRef, useState } from 'react';
import { Payments } from '@square/web-sdk';
import { Merchant, PaymentType, RewardsCustomer } from '@/app/types/types';
import { getAccessToken } from '@privy-io/react-auth';
import { Spinner } from '@radix-ui/themes';

interface FormData {
  product: string;
  price: string;
  tax: number;
  merchant: string;
  customer: RewardsCustomer | null;
  sellerMerchant: Merchant | null;
  paymentMethod: PaymentType;
}

interface CheckoutProps {
  formData: FormData;
  onPaymentSuccess: (result: any) => void;
  onPaymentFailure: (error: any) => void;
}

export const CreditCardCheckout: React.FC<CheckoutProps> = ({
  formData,
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const [card, setCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const applicationId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = formData.sellerMerchant?.square?.location_id;
  const merchantId = formData.sellerMerchant?._id;
  const privyId = formData.sellerMerchant?.privyId;
  const customerId = formData.customer?.userInfo.squareCustomerId;

  const isSquareInitialized = useRef(false);
  
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const paymentFormRef = useRef<HTMLFormElement | null>(null);

  const isScriptLoaded = useRef(false);
  const isCardInitialized = useRef(false);

  let priceInCents: number;
  const priceNum = parseFloat(formData.price || "0");
  if (formData.tax) {
    priceInCents = (priceNum + (((formData.tax/100) * priceNum)) *100) * 100
  } else {
    priceInCents = priceNum * 100
  }

  useEffect(() => {
    if (!applicationId || !locationId) {
      setError('Missing Square credentials');
      setIsLoading(false);
      return;
    }

    const initializeSquare = async () => {
      if (isCardInitialized.current) {
        // If card is already initialized, skip re-initialization
        return;
      }

      console.log('initializeSquare is running')

      try {
        if (!window.Square && !isSquareInitialized.current) {
          const script = document.createElement('script');
          script.src = process.env.NEXT_PUBLIC_WEB_SDK_DOMAIN!;
          script.onload = async () => {
            console.log('Square.js loaded');
            await setupSquare();
          };
          script.onerror = () => {
            console.error('Square.js failed to load properly');
            setError('Failed to load Square.js');
            setIsLoading(false);
          };
          document.body.appendChild(script);
        } else if (window.Square && !isSquareInitialized.current) {
          await setupSquare();
        }
      } catch (err) {
        console.error('Failed to initialize Square payment form:', err);
        setError('Failed to initialize Square payment form');
        setIsLoading(false);
      }
    };

    const setupSquare = async () => {
      if (isCardInitialized.current) return;

      console.log('setupSquare is running')

      try {
        if (isSquareInitialized.current) {
          console.log('Square is already initialized, skipping setup');
          return;
        }

        if (!window.Square) {
          throw new Error('Square.js is not available after script load');
        }

        const payments = window.Square.payments(applicationId, locationId);
        const cardPayment = await payments.card();

        if (cardContainerRef.current) {
          console.log('Attaching card to card-container');
          await cardPayment.attach(cardContainerRef.current);
          setCard(cardPayment);
          console.log('Card attached successfully');
          isSquareInitialized.current = true;
          isCardInitialized.current = true;
        } else {
          throw new Error('Card container element not found');
        }
      } catch (err) {
        console.error('Failed to initialize card:', err);
        setError('Failed to initialize card');
      } finally {
        setIsLoading(false);
      }
    };

    if (applicationId && locationId) {
      initializeSquare();
    }

    return () => {
      if (isSquareInitialized.current && card) {
        console.log('Cleaning up Square payment form');
        card.destroy();
        isSquareInitialized.current = false;
        isCardInitialized.current = false;
      }
    };
  }, [applicationId, locationId, card]); 

  const handlePaymentMethodSubmission = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!card) return;

    try {
      await saveTransaction();

      const tokenResult = await card.tokenize();

      if (tokenResult.status === 'OK') {
        const paymentResults = await createPayment(tokenResult.token);
        onPaymentSuccess(paymentResults);

      } else {
        throw new Error(`Tokenization failed with status: ${tokenResult.status}`);
      }
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred during payment';
      console.error('Payment failed:', errorMessage);
      setError(errorMessage);
      onPaymentFailure(err);
    }
  };

  // Save transaction before sending payment to Square
  let transactionId: string | undefined;
  const saveTransaction = async () => {
    const accessToken = await getAccessToken();
    try {
      const priceNum = parseFloat(formData.price);
      const calculatedSalesTax = parseFloat(((formData.tax/100) * priceNum).toFixed(2));
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 

        },
        body: JSON.stringify({
          merchantId: formData.sellerMerchant?._id,
          buyerId: formData.customer?.userInfo._id,
          buyerPrivyId: formData.customer?.userInfo.privyId,
          productName: formData.product,
          productPrice: formData.price,
          salesTax: calculatedSalesTax,
          paymentType: 'ManualEntry',
          status: 'PENDING'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }

      const data = await response.json();
      transactionId = data._id;
      console.log('save cc transaction response:', data)
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  }


  const createPayment = async (token: string) => {
    const accessToken = await getAccessToken();
    const response = await fetch('/api/square/payment/creditCard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, 
      },
      body: JSON.stringify({
        privyId,
        merchantId,
        locationId,
        sourceId: token,
        customerId,
        price: priceInCents,
        transactionId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody);
    }

    return await response.json();
  };

 return (
    <div>

        <form id="payment-form" ref={paymentFormRef} onSubmit={handlePaymentMethodSubmission}>
          <div id="card-container" ref={cardContainerRef}></div>
          <button id="card-button" type="submit">
            Charge ${formData.price}
          </button>
        </form>

      {error && <p className="error">{error}</p>}
      <div id="payment-status-container"></div>
    </div>
  );
};