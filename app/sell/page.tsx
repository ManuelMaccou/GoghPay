'use client'

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, useLogout, usePrivy } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import { Button, Callout, Card, Flex, Heading, IconButton, Link, Spinner, Strong, Text } from '@radix-ui/themes';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}


export default function Sell() {
  const [signedUrl, setSignedUrl] = useState('');
  const { ready, authenticated, user, login } = usePrivy();
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [ isDeterminingMerchantStatus, setIsDeterminingMerchantStatus ] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState('');

  const router = useRouter();

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  const handleMessageUpdate = (msg: string) => {
    setMessage(msg);
  };

  useEffect(() => {
    if (!ready || !authenticated) {
      setIsLoading(false);
      return;
    }
    
    if (!user) {
      setIsLoading(false);
      return
    }
    const userId = user.id

    async function verifyMerchantStatus() {
      setIsDeterminingMerchantStatus(true);
      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/merchant/verifyMerchantStatus/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        if (response.status === 404) {
          setMerchantVerified(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const data = await response.json();
        console.log('data:', data);
        setMerchantVerified(true);

      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      } finally {
        setIsLoading(false);
        setIsDeterminingMerchantStatus(false);
      }
    }

    verifyMerchantStatus();
  }, [user, ready, authenticated]);

  // Spinner shown during loading state
  if (isLoading) {
    return (
      <Flex height={'100vh'} direction={'column'} align={'center'} justify={'center'} flexGrow={'1'}>
        <Spinner />
      </Flex>
    );
  }
  
  const handleQrCodeGenerated = (url: string) => {
    setSignedUrl(url);
  };


  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'linear-gradient(to bottom, rgba(30,87,153,1) 0%,rgba(125,185,232,1) 100%)'
      }}
    >
      <Flex direction={'row'} width={'100%'} pl={'6'} pt={'6'}>
        <IconButton variant='ghost' style={{color: 'white'}} onClick={() => router.push(`/`)}>
          <ArrowLeftIcon width={'35px'} height={'35px'} />
        </IconButton>
      </Flex>
      <Flex direction='column' height={'40vh'} justify='center' align='center' width='100%' gap={'4'}>
        <Heading style={{ color: 'white' }} size={'9'}>
          New sale
        </Heading>
      </Flex>
      <Flex
        flexGrow={'1'}
        py={'7'}
        direction={'column'}
        justify={'between'}
        align={'center'}
        style={{
          backgroundColor: 'white',
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)'
        }}
      >
       {authenticated ? (
          user ? (
            isDeterminingMerchantStatus ? (
              <Spinner />
            ) : merchantVerified ? (
              signedUrl ? (
                <Card variant='classic'>
                  <Flex direction={'column'} align={'center'} gap={'6'}>
                    <QRCode value={signedUrl} size={256} level={'M'} includeMargin={true} />
                    <Text size={'6'} weight={'bold'} align={'center'} aria-live='polite' role='status'>
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
            ) : (
              <Flex direction={'column'} flexGrow={'1'} px={'5'} justify={'center'} align={'center'} gap={'9'}>
                <Callout.Root color='red' role='alert'>
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>
                    <Strong>Unauthorized.</Strong> This page is for merchants only. You can{' '}
                    <Link href='https://www.ongogh.com' target='_blank' rel='noopener noreferrer'>
                      request access here.
                    </Link>
                      If you think this is a mistake, please{' '}
                    <Link href='mailto: hello@ongogh.com' target='_blank' rel='noopener noreferrer'>
                      contact us.
                    </Link>
                  </Callout.Text>
                </Callout.Root>
                <Button onClick={logout} style={{ width: '250px' }} size={'4'}>
                  Log out
                </Button>
              </Flex>
            )
          ) : null
        ) : (
          <Button size={'4'} style={{ width: '250px' }} onClick={login}>
            Log in
          </Button>
        )}
      </Flex>
    </Flex>
  );
}