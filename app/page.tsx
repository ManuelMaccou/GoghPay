"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { usePrivy, useLogin } from '@privy-io/react-auth';
import axios from 'axios';
import { Button, Flex, Text, Spinner } from "@radix-ui/themes";
import styles from './components/styles.module.css';
import { useUser } from './contexts/UserContext';
import { useMerchant } from './contexts/MerchantContext';
import * as Sentry from '@sentry/nextjs';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Home() {
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  const { appUser, setAppUser } = useUser();
  const { merchant } = useMerchant();

  const { ready, getAccessToken, authenticated, logout, user } = usePrivy();
  const router = useRouter();

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      if (isNewUser) {

        try {
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            phone: user.phone?.number,
            name: user.google?.name,
            creationType: 'privy',
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          setAppUser(response.data.user);
        } catch (error: unknown) {
          Sentry.captureException(error);
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
        }
      }
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  const handleLogin = () => {
    login({
      loginMethods: ['email', 'google', 'sms'],
      disableSignup: true 
    });
  };

  const handleSignup = () => {
    login({ loginMethods: ['sms']
     });
  };

  useEffect(() => {
    if (!user) return;
    if (!appUser) return;

    const updateUserWithSmartWalletAddress = async (smartWallet: any) => {
      try {
        const accessToken = await getAccessToken();
        const response = await fetch('/api/user/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            smartAccountAddress: smartWallet?.address,
            privyId: user.id,
          }),
        });
  
        if (response.ok) {
          const data = await response.json();
          setAppUser(data.user);
        } else {
          const errorMessage = await response.text();
          Sentry.captureException(new Error(`Updating user with smart wallet address - ${response.statusText} || 'Unknown Error'}, ${response.status}`), {
            extra: {
              privyId: user?.id ?? 'unknown privyId'
            }
          });
  
          console.error(`Failed to update user with smart wallet address: ${errorMessage}`);
          Sentry.captureException(new Error (`Failed to update user with smart wallet address: ${errorMessage}`));
        }
  
      } catch (err) {
        Sentry.captureException(err);
        if (isError(err)) {
          console.error(`Failed to update user with smart wallet address: ${err.message}`);
        } else {
          console.error('Failed to update user with smart wallet address');
        }
      }

    }
    const smartWallet = user.linkedAccounts.find((account) => account.type === 'smart_wallet');
    if (!appUser?.smartAccountAddress && smartWallet) {
      updateUserWithSmartWalletAddress(smartWallet)
    }
  }, [appUser, setAppUser, user, getAccessToken])

  useEffect(() => {
    if (!ready || !authenticated || !appUser) return
    console.log('merchant:', merchant)
    if (appUser.merchant) {
      if (!merchant) return;
      
      if (merchant && merchant.status === 'onboarding') {
        if (merchant.onboardingStep) {
          router.replace(`/onboard/step${merchant.onboardingStep}`);
        } else {
          router.replace('/onboard');
        }
       
      } else {
        router.replace('/account/sales')
      }
    } else if (appUser && !appUser.merchant) {
      router.replace('/myrewards')
    }
  }, [ready, authenticated, appUser, router, merchant]);

  return (
    <Flex direction={'column'} className={styles.section} position={'relative'} minHeight={'100vh'} width={'100%'}>
      <Image
        src="/bg_m.jpg"
        alt="background image"
        priority
        className={styles.fullBackgroundImage}
        fill
        sizes="100vw"
        style={{objectFit: "cover"}} 
      />
   
      <Flex direction={'column'} justify={'center'} align={'center'}>
        <Image
          priority
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

        {!ready && (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Spinner style={{color: 'white'}} />
          </Flex>
        )}

        {isRedirecting && (
          <>
            <Text size={'4'} weight={'bold'} style={{color: 'white', paddingBottom: '10px'}}>Redirecting...</Text>
          </>
        )}

        {ready && !authenticated && (
          <Flex direction={'column'} justify={'end'} align={'end'} gap={'7'}>
          <Button size={'4'} style={{width: "250px", backgroundColor: 'white'}}
            onClick={handleLogin}
          >
            <Text size={'5'} style={{color: 'black'}}>
              Log in
            </Text>
          </Button>
    
          <Button size={'4'} style={{ width: "250px", backgroundColor: 'white' }} 
            onClick={handleSignup}
          >
            <Text size={'5'} style={{color: 'black'}}>
              Create an account
            </Text>
          </Button>
        </Flex>
        )}
      </Flex>
    </Flex>
  );
};