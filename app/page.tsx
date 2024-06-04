"use client"

import React, { useEffect, useState } from 'react';
import Image from "next/image";
import { usePrivy, useLogin } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';
import { Button, Flex } from "@radix-ui/themes";
import { User } from './types/types';
import styles from './components/styles.module.css'

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User>();
  const { ready, getAccessToken, authenticated, logout, user } = usePrivy();

  const { login } = useLogin({

    onComplete: async (user, isNewUser) => {
      console.log('login successful')
      const accessToken = await getAccessToken();
      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };
      if (isNewUser) {
        try {
          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload, {
              headers: { Authorization: `Bearer ${accessToken}` },
          });
          console.log('New user created:', response.data);
        } catch (error) {
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else {
              console.error('Unexpected error:', error);
          }
        }
          
      } 
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await fetch(`/api/user/me/${user.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setCurrentUser(userData.user);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
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
        style={{
          objectFit: "cover"
        }} />
   
      <Flex direction={'column'} justify={'center'} align={'center'}>
        <Image
          src="/logos/gogh_logo_white.png"
          alt="Gogh"
          width={960}
          height={540}
          sizes="100vw"
          style={{
            width: "100%",
            height: "auto",
            marginBottom: "50px",
            maxWidth: "100%",
          }} />
        {authenticated ? (
        
          <Flex direction={'column'} justify={'between'}>
          <Flex direction={'column'} gap={'5'}>
            {currentUser?.merchant ? (
              <>
                <Button size={'4'}>Sales</Button>
                <Button size={'4'} style={{width: "300px"}}>Purchases</Button>
              </>
            ) : (
              <Button size={'4'} style={{width: "300px"}}>
                Purchases
              </Button>
            )}
          </Flex>
          </Flex>
        ) : null}
      </Flex>
      <Flex direction={'column'} justify={'center'} align={'center'} position={'absolute'} bottom={'9'} width={'100%'}>
        {authenticated ? (
          <Button highContrast size={'4'}
            onClick={logout}>
              Log out
          </Button>
          ) : (
          <Button highContrast size={'4'} style={{width: "300px"}}
            onClick={login}>
            Log in
          </Button>
        )}
      </Flex>
    </Flex>
  );
};
