"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { usePrivy, useLogin, useWallets } from '@privy-io/react-auth';
import axios from 'axios';
import { Button, Flex, Spinner } from "@radix-ui/themes";
import { User } from './types/types';
import styles from './components/styles.module.css';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { ready, getAccessToken, authenticated, logout, user } = usePrivy();
  const {wallets} = useWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      console.log('login successful');

      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };

      if (isNewUser) {
        try {
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
      }

      if (chainIdNum !== null && chainId !== `eip155:${chainIdNum}`) {
        try {
          await wallet.switchChain(chainIdNum);
        } catch (error: unknown) {
          console.error('Error switching chain:', error);
      
          if (typeof error === 'object' && error !== null && 'code' in error) {
            const errorCode = (error as { code: number }).code;
            if (errorCode === 4001) {
              alert('You need to switch networks to proceed.');
            } else {
              alert('Failed to switch the network. Please try again.');
            }
          } else {
            console.log('An unexpected error occurred.');
          }
          return;
        }
      };
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  const handleNewSaleClick = () => {
    router.push('/sell');
  };

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

        {!isLoading && ready && authenticated ? (
          isFetchingUser ? (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Spinner />
            </Flex>
          ) : (
            <Flex direction={'column'} justify={'between'}>
              <Flex direction={'column'} gap={'5'}>
                {currentUser?.merchant ? (
                  <>
                    <Button size={'4'} style={{height: '100px'}} onClick={handleNewSaleClick}>
                      New Sale
                    </Button>
                    <Button size={'4'}>Sales</Button>
                    <Button size={'4'} style={{width: "300px"}}>Purchases</Button>
                  </>
                ) : (
                  <Button size={'4'} style={{width: "300px"}}>Purchases</Button>
                )}
              </Flex>
            </Flex>
          )
        ) : (
          !isLoading && (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Button highContrast size={'4'} style={{width: "300px"}} onClick={login}>
                Log in
              </Button>
            </Flex>
          )
        )}
      </Flex>
      {ready && authenticated && !isFetchingUser && !isLoading && (
        <Flex direction={'column'} justify={'center'} align={'center'} position={'absolute'} bottom={'9'} width={'100%'}>
          <Button highContrast size={'4'} onClick={logout}>
            Log out
          </Button>
        </Flex>
      )}
    </Flex>
  );
};
