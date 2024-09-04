'use client'

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import { Button, Callout, Card, Flex, Heading, IconButton, Link, Spinner, Strong, Text } from '@radix-ui/themes';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Location, Merchant, RewardsCustomer, SquareCatalog, User, PaymentType } from '../types/types';
import { BalanceProvider } from '../contexts/BalanceContext';
import { Header } from '../components/Header';
import { useUser } from '../contexts/UserContext';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}



export default function Sell() {
  const { appUser, setIsFetchingUser, setAppUser } = useUser();
  const { ready, authenticated, user, login } = usePrivy();

  const [currentUser, setCurrentUser] = useState<User>();

  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  
  const [signedUrl, setSignedUrl] = useState('');
  const [merchant, setMerchant] = useState<Merchant>();
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentType[]>([]);

  const [currentRewardsCustomers, setCurrentRewardsCustomers] = useState<RewardsCustomer[]>([]);
  const [isFetchingCurrentRewardsCustomers, setIsFetchingCurrentRewardsCustomers] = useState<boolean>(true);
  const [errorFetchingRewards, setErrorFetchingRewards] = useState<string | null>(null);

  const [ isDeterminingMerchantStatus, setIsDeterminingMerchantStatus ] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingCatelog, setLoadingCatalog] = useState<boolean>(false);
  const [squareCatalog, setSquareCatalog] = useState<SquareCatalog[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [isFetchingLocations, setIsFetchingLocations] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  

  const router = useRouter();

  useEffect(() => {

    if (appUser && !currentUser) {
      setCurrentUser(appUser);
    }
  }, [appUser, currentUser]);

  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress;
      setWalletForPurchase(walletAddress);
    }
  }, [appUser]);

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  const handleMessageUpdate = (msg: string) => {
    setMessage(msg);
  };

  const fetchCheckedInCustomers = async () => {
    if (!currentUser) return;
    setIsFetchingCurrentRewardsCustomers(true)
    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/rewards/userRewards/customers/?merchantId=${merchant?._id}&privyId=${currentUser.privyId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
      });

      if (response.ok) {
        const rewardsCustomers = await response.json();
        console.log('rewards data from get:', rewardsCustomers)
        setCurrentRewardsCustomers(rewardsCustomers);

      } else if (response.status === 401) {
        setErrorFetchingRewards('Unauthorized access. Please log in again.');
      } else if (response.status === 404) {
        setErrorFetchingRewards('No customers found. Please refresh the page.');
      } else {
        setErrorFetchingRewards('Error searching for customers. Please refresh the page.');
      }

    } catch (error: unknown) {
      if (isError(error)) {
        console.error('Error fetching reward customers:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      setError('Error fetching user');
    } finally {
      setIsFetchingCurrentRewardsCustomers(false);
    }
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
    if (ready && authenticated && currentUser && merchant) {
      fetchCheckedInCustomers();
    }
  }, [authenticated, ready, currentUser, merchant]);

  useEffect(() => {
    if (merchant && merchant.paymentMethods.types.length > 0) {
      setPaymentMethods(merchant.paymentMethods.types);
    }
  }, [merchant]);

  /*
  useEffect(() => {
    const fetchInventory = async () => {
      if (merchant?.square?.access_token) {
        await fetchLocations(merchant._id);
        if (locations) {
          await fetchSquareCatelog();
        }
      }
    }

    fetchInventory();
    
  }, [locations, merchant]);
  */

  const fetchSquareCatelog = async () => {
    setLoadingCatalog(true);
    
    // PLACEHOLDER FOR FETCHING CATELOG
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
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'} style={{ backgroundColor: "#1E589A" }}>
        <Heading size={'8'} style={{color: "white"}}>New Sale</Heading>
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            color={"white"}
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
        </BalanceProvider>
      </Flex>
      <Flex
        flexGrow={'1'}
        py={'7'}
        direction={'column'}
        justify={'between'}
        align={'center'}
        height={'100%'}
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
                  customers={currentRewardsCustomers}
                  paymentMethods={paymentMethods}
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