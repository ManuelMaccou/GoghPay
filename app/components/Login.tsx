import React from 'react';
import styles from './styles.module.css';
import Image from "next/legacy/image";
import { usePrivy, useLogin } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';
import { Avatar, Box, Button, Container, Flex, Heading, Section } from "@radix-ui/themes";


  

export default function Login() {
  const { getAccessToken, authenticated, logout } = usePrivy();
  const { login } = useLogin({

    onComplete: async (user, isNewUser) => {
      const accessToken = await getAccessToken();
      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };

      try {
        if (isNewUser) {
          try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

          } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error fetching user details:', error.response?.data?.message || error.message);
            } else {
                console.error('Unexpected error:', error);
            }
          }
            
        } else {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error fetching user details:', error.response?.data?.message || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
      }
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
        layout="fill"
        objectFit="cover"
        priority
        className={styles.fullBackgroundImage}
      />
   
      <Flex direction={'column'} justify={'center'} align={'center'}>
        <Image src="/logos/gogh_logo_white.png" 
        alt="Gogh" 
        width={960}
        height={540}
        sizes="100vw"
        style={{
          width: "100%",
          height: "auto",
          marginBottom: "50px",
        }}
        />
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

// Styling for the login component
const loginStyles = {
    container: {
      display: 'flex' as 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center' as 'center',
      justifyContent: 'center' as 'center',
      height: '100vh',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#fff',
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '300px',
      margin: 'auto',
      boxSizing: 'border-box' as 'border-box'
    },
    message: {
      marginBottom: '20px'
    },
    button: {
      padding: '10px 20px',
      fontSize: '16px',
      borderRadius: '5px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: '#007BFF',
      color: 'white',
      outline: 'none'
    }
  };
