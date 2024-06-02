'use client'

import React from 'react';

const AddMerchantsPage: React.FC = () => {
  const addMerchant = async (merchantId: string, walletAddress: string) => {
    const response = await fetch('/api/merchant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ merchantId, walletAddress }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add merchant: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Merchant added:', data);
  };

  const addMerchants = async () => {
    const merchants = [
      { merchantId: 'merchant_001', walletAddress: '0x1234567890abcdef1234567890abcdef12345678' },
      { merchantId: 'merchant_002', walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12' },
      { merchantId: 'merchant_003', walletAddress: '0x7890abcdef1234567890abcdef1234567890abcd' },
    ];

    for (const merchant of merchants) {
      try {
        await addMerchant(merchant.merchantId, merchant.walletAddress);
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div>
      <h1>Add Merchants</h1>
      <button onClick={addMerchants}>Add Test Merchants</button>
    </div>
  );
};

export default AddMerchantsPage;
