import React from 'react';
import styles from './styles.module.css';
import Image from "next/image";
import { usePrivy, useLogin, useWallets } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';
import { Avatar, Box, Button, Container, Flex, Heading, Section } from "@radix-ui/themes";


function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Login() {
  const {wallets} = useWallets();
  const wallet = wallets[0];
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

  const { getAccessToken, authenticated, logout } = usePrivy();
  const { login } = useLogin({
    onComplete: async (user) => {
      console.log('login successful');
      const accessToken = await getAccessToken();
      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };
  
        try {
          console.log('fetching/adding user')
          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload, {
              headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
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
  return (
    <Flex direction={'column'} className={styles.section}>
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
          }} />
        {authenticated && (
          <Button 
          highContrast
          onClick={logout}>
          Log out
        </Button>
        )}
        {!authenticated && (
          <Button 
          highContrast
          onClick={login}>
          Log in
        </Button>
        )}
        
      </Flex>
    </Flex>
  );
};
