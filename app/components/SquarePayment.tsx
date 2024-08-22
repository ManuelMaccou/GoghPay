'use client';

import React from 'react';

interface SquarePaymentProps {
  amount: number;
  currency: string;
  callbackUrl: string;
  clientId: string;
  notes?: string;
}

const SquarePayment: React.FC<SquarePaymentProps> = ({
  amount,
  currency,
  callbackUrl,
  clientId,
  notes = "Transaction notes",
}) => {
  
  const handlePayment = () => {
    const dataParameter = {
      amount_money: {
        amount: amount.toString(),
        currency_code: currency,
      },
      callback_url: callbackUrl,
      client_id: clientId,
      version: "1.3",
      notes,
      options: {
        supported_tender_types: ["CREDIT_CARD", "CASH", "OTHER", "SQUARE_GIFT_CARD", "CARD_ON_FILE"],
      },
    };

    const url = `square-commerce-v1://payment/create?data=${encodeURIComponent(
      JSON.stringify(dataParameter)
    )}`;

    console.log("url:", url);

    // Redirect to Square Point of Sale app
    window.location.href = url;
  };

  const handlePayment2 = () => {
    // Test with a simple URL first
    window.location.href = 'https://www.google.com';
  };

  return (
    <>
      <div>
        <button onClick={handlePayment}>Pay with Square</button>
      </div>
      <div>
        <button onClick={handlePayment2}>Test</button>
      </div>
    </>
  );
};

export default SquarePayment;
