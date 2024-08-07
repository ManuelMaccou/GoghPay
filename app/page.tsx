"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { usePrivy, useLogin, useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth';
import axios from 'axios';
import { Button, Flex, Separator, Spinner } from "@radix-ui/themes";
import { User } from './types/types';
import styles from './components/styles.module.css';
import { createSmartAccount } from './utils/createSmartAccount';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null);

  const { ready, getAccessToken, authenticated, logout, user } = usePrivy();
  const {wallets} = useWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

  const { login } = useLogin({
    onComplete: async (user: { id: any; wallet: { address: any; }; email: { address: any; }; google: { email: any; }; }, isNewUser: any) => {
      console.log('login successful');

      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      console.log("wallet object:", wallet);

      let smartAccountAddress;

      if (isNewUser) {
        if (embeddedWallet) {
          smartAccountAddress = await createSmartAccount(embeddedWallet);
        };

        try {
          console.log('smart account address:', smartAccountAddress);
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          console.log('New user created:', response.data);
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
        }
        router.replace('/account/transfer?step=new-user')
        return;
      }

      setIsExistingUser(true);
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  useEffect(() => {
    if (!ready) return;
  
    const fetchUser = async () => {
      if (!user) return;
      setIsFetchingUser(true)

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setCurrentUser(userData.user);
      } catch (error: unknown) {
        if (isError(error)) {
          console.error('Error fetching user:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      } finally {
        setIsFetchingUser(false);
        setIsLoading(false);
      }
    };

    if (ready && authenticated && user) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [authenticated, ready, user]);

  useEffect(() => {
    if (!embeddedWallet) return;
    if (!currentUser) return;
    if (currentUser.smartAccountAddress) return;

    const addSmartAccountAddress = async () => {
      const accessToken = await getAccessToken();
      try {
       const smartAccountAddress = await createSmartAccount(embeddedWallet);

        if (!smartAccountAddress) {
          throw new Error('Failed to create smart account.');
        }

        const response = await fetch('/api/user/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            smartAccountAddress: smartAccountAddress,
            privyId: user?.id
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create smart account');
        }
        console.log('successfully added smart account')
        
      } catch (error) {
        console.error('Error adding smart account:', error);
      } finally {
       
      }
    };

    if (user && embeddedWallet && currentUser && !currentUser.smartAccountAddress) {
      addSmartAccountAddress();
    }
  }, [user, currentUser, embeddedWallet, getAccessToken]);

  useEffect(() => {
    if (isExistingUser !== true) return;

    if (currentUser && currentUser.merchant) {
      router.replace('/account/sales')
    } else if (currentUser && !currentUser.merchant) {
      router.replace('/account/purchases')
    }
  }, [currentUser, isExistingUser, router]);

  return (
    <Flex direction={'column'} className={styles.section} position={'relative'} minHeight={'100vh'} width={'100%'}>
      <Image
        src="/bg_m.jpg"
        alt="background image"
        priority
        className={styles.fullBackgroundImage}
        fill
        sizes="100vw"
        style={{ objectFit: "cover" }} 
      />
   
      <Flex direction={'column'} justify={'center'} align={'center'}>
        <Image
          src="/logos/gogh_logo_white.svg"
          alt="Gogh"
          width={960}
          height={540}
          sizes="100vw"
          style={{
            width: "100%",
            height: "auto",
            marginBottom: "50px",
            maxWidth: "100%",
          }} 
        />

        {isLoading || (!ready && (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Spinner />
          </Flex>
        ))}

        {!isLoading && (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Button highContrast size={'4'} style={{width: "300px"}} onClick={login}>
              Log in/Sign up
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};