'use client'

import React, { useState, FormEvent, useEffect } from 'react';
import QRCode from 'qrcode.react';
import Login from '../components/Login';
import { usePrivy } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import { Box, Card, Flex, Text } from '@radix-ui/themes';
import Image from "next/image";
import styles from './styles.module.css';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}


export default function Sell() {
  const [signedUrl, setSignedUrl] = useState('');
  const { ready, authenticated, user, logout } = usePrivy();
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState('');


  const handleMessageUpdate = (msg: string) => {
    setMessage(msg);
  };

  useEffect(() => {
    if (!user) {
      return
    }
    console.log("user object from privy:", user);

    const userId = user.id
    console.log("user Id sent in for verification:", userId);

    async function verifyMerchantStatus() {
      try {
        const response = await fetch(`/api/merchant/verifyMerchantStatus/${userId}`);

        if (response.status === 404) {
          setMerchantVerified(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const data = await response.json();
        setMerchantVerified(true);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      }
    }

    verifyMerchantStatus();
  }, [user, ready, authenticated]);


  useEffect(() => {
    console.log("Authentication state changed");
  }, [ready, authenticated]);


  // Create a better experience for logged in users who are curious about the sell page, but are unauthorized
  if (!merchantVerified) {
    return <Login />;
  }
  
  const handleQrCodeGenerated = (url: string) => {
    setSignedUrl(url);
  };

  return (
    <Box className={styles.boxTest} height={'100vh'}>
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
      <Flex height={'100vh'} direction={'column'} align={'center'} justify={'center'} flexGrow={'1'}>
      {authenticated && user && merchantVerified ? (
        <>
          {signedUrl ? (
              <Card variant='classic'>
              <Flex direction={'column'} align={'center'} gap={'6'}>
              <QRCode value={signedUrl} size={256} level={"M"} includeMargin={true} />
              <Text size={'6'} weight={'bold'} align={'center'} aria-live="polite" role="status">
                {message}
                </Text>
                </Flex>
              </Card>
          ) : (
              <NewSaleForm 
                onQrCodeGenerated={handleQrCodeGenerated} 
                onMessageUpdate={handleMessageUpdate} 
                userId={user.id} 
              />
            )
          }
        </>
      ) : (
        <Login />
      )}
      </Flex>
    </Box>
  );
}