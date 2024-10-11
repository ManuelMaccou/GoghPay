"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Merchant } from '../types/types';

interface MerchantContextType {
  merchant: Merchant | null;
  setMerchant: (merchant: Merchant | null) => void;
  isFetchingMerchant: boolean;
  setIsFetchingMerchant: (isFetchingMerchant: boolean) => void;
}

// Create the context
const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

// Provide the context to the app
export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = usePrivy();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isFetchingMerchant, setIsFetchingMerchant] = useState<boolean>(true);
  const [isMerchantFetched, setIsMerchantFetched] = useState<boolean>(false);

  useEffect(() => {
    const fetchMerchantData = async () => {
      if (!user || isMerchantFetched) return;

      setIsFetchingMerchant(true);
      try {
        const response = await fetch(`/api/merchant/privyId/${user.id}`);
        if (!response.ok) {
            setMerchant(null);
            return
        } else {
            const data = await response.json();
            setMerchant(data || null); // Set merchant to `null` if no data is returned
            setIsMerchantFetched(true);
        }
      } catch (error) {
        console.error('Error fetching merchant data:', error);
        setMerchant(null); // Explicitly set merchant to `null` on error
      } finally {
        setIsFetchingMerchant(false); // Ensure fetching state is updated
      }
    };

    if (user && !isMerchantFetched) {
      fetchMerchantData();
    }
  }, [user, isMerchantFetched]);

  useEffect(() => {
    if (!user) {
      setMerchant(null); // Reset merchant state on logout or user change
      setIsMerchantFetched(false); // Allow refetching when the user logs back in
    }
  }, [user]);

  return (
    <MerchantContext.Provider
      value={{ merchant, setMerchant, isFetchingMerchant, setIsFetchingMerchant }}
    >
      {children}
    </MerchantContext.Provider>
  );
};

// Custom hook to use the Merchant context
export const useMerchant = () => {
  const context = useContext(MerchantContext);
  if (!context) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
};
