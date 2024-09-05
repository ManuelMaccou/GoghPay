import { useEffect, useState } from 'react';
import { Payments } from '@square/web-sdk';
import { Merchant, PaymentType, RewardsCustomer } from '@/app/types/types';
import { decrypt } from '@/app/lib/encrypt-decrypt';
import { Button, Flex } from '@radix-ui/themes';
import { getAccessToken } from '@privy-io/react-auth';

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
  merchant: Merchant;
  formData: FormData;
}

export const Checkout: React.FC<CheckoutProps> = ({ merchant, formData }) => {
  const [paymentForm, setPaymentForm] = useState<any>(null);

if (!formData) return null
  const applicationId = decrypt(formData.sellerMerchant?.square?.access_token);
  const locationId = formData.sellerMerchant?.square?.location_id;
  const merchantId = formData.sellerMerchant?._id;
  const privyId = formData.sellerMerchant?.privyId;
  const customerId = formData.customer?.userInfo.squareCustomerId;

  let priceInCents: number;
  const priceNum = parseFloat(formData.price || "0");
  if (formData.tax) {
    priceInCents = (priceNum + (((1/formData.tax) * priceNum)) *100) * 100
  } else {
    priceInCents = formData.price * 100
  }

  async function initializeCard(payments) {
    const card = await payments.card();
    await card.attach('#card-container');

    return card;
  }

  // Save transaction before sending payment to Square
  await saveTransaction({
    merchantId: formData.sellerMerchant?._id,
    buyerId: formData.customer?.userInfo._id,
    buyerPrivyId: formData.customer?.userInfo.privyId,
    productName: formData.product,
    productPrice: formData.price,
    salesTax: formData.tax,
    paymentType: 'ManualEntry'
  });

  let transactionId: string | undefined;

  async function saveTransaction(transactionData: any) {
    const accessToken = await getAccessToken();
    try {
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 

        },
        body: JSON.stringify(transactionData),
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

  async function createPayment(token) {
    const accessToken = await getAccessToken();
    const body = JSON.stringify({
      privyId,
      merchantId,
      locationId,
      sourceId: token,
      customerId,
      price: priceInCents,
      transactionId,
    });

    const paymentResponse = await fetch('/api/square/payment/creditCard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, 
      },
      body,
    });

    if (paymentResponse.ok) {
      return paymentResponse.json();
    }

    const errorBody = await paymentResponse.text();
    throw new Error(errorBody);
  }

  async function tokenize(paymentMethod) {
    const tokenResult = await paymentMethod.tokenize();
    if (tokenResult.status === 'OK') {
      return tokenResult.token;
    } else {
      let errorMessage = `Tokenization failed with status: ${tokenResult.status}`;
      if (tokenResult.errors) {
        errorMessage += ` and errors: ${JSON.stringify(
          tokenResult.errors,
        )}`;
      }

      throw new Error(errorMessage);
    }
  }

  useEffect(() => {
    if (formData.paymentMethod === 'Square') {
      initializeSquare();
    }
  }, [formData.paymentMethod, applicationId, locationId]);

  const initializeSquare = async () => {
    if (!window.Square || !applicationId || !locationId) {
      throw new Error('Square.js failed to load properly');
    }

    let payments;

    try {
      payments = window.Square.payments(applicationId, locationId);
      const card = await payments.card();
      await card.attach('#card-container');
      setPaymentForm(card);
    } catch (error) {
      console.error('Failed to initialize Square payment form:', error);
    }
  };

  const handleCheckout = async (formData: FormData) => {
    const paymentMethod = formData.paymentMethod
    try {
      switch (paymentMethod) {
        case 'Venmo':
          handleVenmoPayment();
          break;
        case 'Zelle':
          handleZellePayment();
          break;
        case 'Cash':
          await handleCashPayment(formData);
          break;
        case 'ManualEntry':
          await handleCreditCardPayment(formData);
          break;
        case 'Square':
          await handleSquarePayment(formData);
          break;
        default:
          console.warn('Unknown payment method:', paymentMethod);
          break;
      }
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  };
  
  const handleVenmoPayment = () => {
    const venmoQrCode = formData.sellerMerchant?.paymentMethods.venmoQrCodeImage;
    if (venmoQrCode) {
      displayQRCode(venmoQrCode);
    } else {
      console.error('No Venmo QR code available.');
    }
  };

  const handleZellePayment = () => {
    const zelleQrCode = formData.sellerMerchant?.paymentMethods.zelleQrCodeImage;
    if (zelleQrCode) {
      displayQRCode(zelleQrCode);
    } else {
      console.error('No Zelle QR code available.');
    }
  };
  
  const handleCashPayment = async (formData: FormData) => {
    console.log('Handling cash payment with form data:', formData);
  };

  const handleCreditCardPayment = async (formData: FormData) => {
    console.log('Processing credit card payment with form data:', formData);
   
  };

  const handleSquarePayment = async (formData: FormData) => {
    console.log('Handling Square payment with form data:', formData);

    const handlePayment = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!paymentForm) return;

      try {
        const result = await paymentForm.tokenize();
        if (result.status === 'OK') {
          await processSquarePayment(result.token);
        } else {
          console.error('Error tokenizing card:', result.errors);
        }
      } catch (error) {
        console.error('Error during payment:', error);
      }
    };

    const processSquarePayment = async (nonce: string) => {
      // Send nonce to server for processing
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nonce, amount: formData.price }),
      });
  
      const result = await response.json();
      if (result.success) {
        console.log('Payment successful:', result);
      } else {
        console.error('Payment failed:', result.error);
      }
    };

    return (
      <form onSubmit={handlePayment}>
        <Flex id="card-container"></Flex>
        <Button type="submit" disabled={!paymentForm}>
          Charge
        </Button>
      </form>
    );
  };

  const displayQRCode = (qrCodeUrl: string) => {
    window.open(qrCodeUrl, '_blank');
  };

  useEffect(() => {
    async function initializeSquare() {
      if (!window.Square || !applicationId || !locationId) return;

      try {
        const payments = Payments(applicationId, locationId);
        const card = await payments.card();
        await card.attach('#card-container');

        setPaymentForm(card);
      } catch (error) {
        console.error('Failed to initialize Square payment form:', error);
      }
    }

    initializeSquare();
  }, [applicationId, locationId]);


  return (


  )
}