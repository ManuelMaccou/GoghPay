'use client'

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, useLogout, usePrivy } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import { Button, Callout, Card, Flex, Heading, IconButton, Link, Spinner, Strong, Text } from '@radix-ui/themes';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Location, Merchant, SquareCatalog } from '../types/types';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}



export default function Sell() {
  const [signedUrl, setSignedUrl] = useState('');
  const { ready, authenticated, user, login } = usePrivy();
  const [merchant, setMerchant] = useState<Merchant>();
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [ merchant, setMerchant ] = useState<Merchant>();
  const [ isDeterminingMerchantStatus, setIsDeterminingMerchantStatus ] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingCatelog, setLoadingCatalog] = useState<boolean>(false);
  const [squareCatalog, setSquareCatalog] = useState<SquareCatalog[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);

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
        } else {
          const data = await response.json();
          setMerchant(data);
          setMerchantVerified(true);
        }

        const data: Merchant = await response.json();
        setMerchant(data);
        setMerchantVerified(true);

      } catch (err) {
        if (isError(err)) {
          console.error(`Error fetching merchant: ${err.message}`);
        } else {
          console.error('Error fetching merchant');
        }
      } finally {
        setIsLoading(false);
        setIsDeterminingMerchantStatus(false);
      }
    }

    verifyMerchantStatus();
  }, [user, ready, authenticated]);

  useEffect(() => {
    const fetchInventory = async () => {
      if (merchant?.square_access_token) {
        await fetchLocations(merchant._id);
        if (locations) {
          await fetchSquareCatelog();
        }
      }
    }

    fetchInventory();
    
  }, [merchant, locations]);

  const fetchSquareCatelog = async () => {
    setLoadingCatalog(true);
    

  } 

  const fetchLocations = async (merchantId: string) => {
    setIsFetchingLocations(true);
    try {
      const response = await fetch(`/api/square/locations?merchantId=${merchantId}`);
      if (response.status === 401) {
        const errorText = await response.text();
        if (errorText.includes('expired')) {
          setError('Token expired. Please reconnect.');
        } else if (errorText.includes('revoked')) {
          setError('Token revoked. Please reconnect.');
        } else if (errorText.includes('No access token')) {
          setError(null);
        } else {
          setError('Unauthorized. Please reconnect.');
        }
        setLocations([]);
      } else if (response.status === 403) {
        setError('Insufficient permissions. Please contact us.');
        setLocations([]);
      } else if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      } else {
        setError('Process failed. Please try again.');
        setLocations([]);
      }
    } catch (err) {
      if (isError(err)) {
        setLocationError(`Error fetching locations: ${err.message}`);
      } else {
        setLocationError('Error fetching locations. Please contact us.');
      }
    } finally {
      setIsFetchingLocations(false);
    }
  };

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
        <IconButton variant='ghost' style={{color: 'white'}} onClick={() => router.push(`/account/sales`)}>
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
          user && merchant ? (
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
                  merchantFromParent={merchant}
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