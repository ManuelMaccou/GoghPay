"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { User } from '../types/types';

interface UserContextType {
  appUser: User | null;
  setAppUser: (user: User | null) => void;
  isFetchingUser: boolean;
  setIsFetchingUser: (isFetchingUser: boolean) => void;
}

// Create the context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Provide the context to the app
export const UserProvider = ({ children }: { children: ReactNode }) => {
    const { user } = usePrivy();
    
    const [appUser, setAppUser] = useState<User | null>(null);
    const [isFetchingUser, setIsFetchingUser] = useState<boolean>(false);
    const [isUserFetched, setIsUserFetched] = useState<boolean>(false);

    useEffect(() => {
      // Reset user data on user logout
      if (!user) {
        setAppUser(null);
        setIsUserFetched(false);
      }
    }, [user]);

    useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      setIsFetchingUser(true);
        try {
            const response = await fetch(`/api/user/me/${user.id}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch user data: ${response.statusText}`);
            }

            const data = await response.json();
            setAppUser(data.user);
            setIsUserFetched(true);
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
          setIsFetchingUser(false);
        }
    };

    // Fetch merchant data only if it's not already in state
    if (user && !isUserFetched) {
      fetchUserData();
    }
  }, [user, isUserFetched]);

    return (
        <UserContext.Provider value={{ appUser, setAppUser, isFetchingUser, setIsFetchingUser }}>
          {children}
        </UserContext.Provider>
    );
};

// Custom hook to use the Merchant context
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a MerchantProvider');
    }
    return context;
};
