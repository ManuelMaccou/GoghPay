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
    const [isFetchingMerchant, setIsFetchingMerchant] = useState<boolean>(false);
    const [isMerchantFetched, setIsMerchantFetched] = useState<boolean>(false);

    useEffect(() => {
    const fetchMerchantData = async () => {
        if (!user) return;

        setIsFetchingMerchant(true);
        try {
            const response = await fetch(`/api/merchant/privyId/${user.id}`);
            const data = await response.json();
            setMerchant(data);
            setIsMerchantFetched(true);
        } catch (error) {
            console.error('Error fetching merchant data:', error);
        } finally {
            setIsFetchingMerchant(false);
        }
    };

    // Fetch merchant data only if it's not already in state
    if (user && !isMerchantFetched) {
        fetchMerchantData();
    }
    }, [user, isMerchantFetched]);

    return (
        <MerchantContext.Provider value={{ merchant, setMerchant, isFetchingMerchant, setIsFetchingMerchant }}>
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
