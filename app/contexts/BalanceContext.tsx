"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface BalanceContextType {
  balance: number;
  isBalanceLoading: boolean;
  error: string;
  fetchBalance: () => void;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const BalanceProvider: React.FC<{ children: React.ReactNode, walletForPurchase?: string | null }> = ({ children, walletForPurchase }) => {
  const [balance, setBalance] = useState<number>(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchBalance = useCallback(async () => {
    console.log("running balance context");
    if (!walletForPurchase) return;

    setIsBalanceLoading(true);
    try {
      const response = await fetch(`/api/crypto/get-usdc-balance?address=${walletForPurchase}`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || 'Failed to fetch balance');
      
      setBalance(parseFloat(data.balance));
      console.log('balance from context:', data.balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setError('Failed to check balance');
    } finally {
      setIsBalanceLoading(false);
    }
  }, [walletForPurchase]);

  useEffect(() => {
    if (walletForPurchase) {
      fetchBalance();
    }
  }, [walletForPurchase, fetchBalance]);

  return (
    <BalanceContext.Provider value={{ balance, isBalanceLoading, error, fetchBalance }}>
      {children}
    </BalanceContext.Provider>
  );
};

export const useBalance = () => {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
};
