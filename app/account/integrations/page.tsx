'use client'

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, User } from "@/app/types/types";
import { Button, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import * as Avatar from '@radix-ui/react-avatar';
import { Suspense, useEffect, useState } from "react";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import crypto from 'crypto';
import { setCookie } from 'nookies';
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function IntegrationsContent() {
  const [error, setError] = useState<string | null>(null);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [merchant, setMerchant] = useState<Merchant>();
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  // const [merchantSet, setMerchantSet] = useState<boolean>(false);

  const { login, user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const searchParams = useSearchParams();

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');

    setStatus(statusParam);
    setMessage(decodeURIComponent(messageParam || ''));
  }, [searchParams]);

  useEffect(() => {
    let token = Cookies.get('csrfToken');
  
    if (!token) {
      // Generate CSRF token and set it as a cookie if it doesn't exist
      token = crypto.randomBytes(16).toString('hex');
      setCsrfToken(token);
  
      Cookies.set('csrfToken', token, {
        expires: 1, // 1 day
        path: '/',
        secure: process.env.SECURE_ENV === 'true', // Secure flag set based on environment
        sameSite: 'lax' // Changed from 'strict' to 'lax'
      });
      console.log('CSRF Token in client useEffect:', token);
    } else {
      setCsrfToken(token);
      console.log('CSRF token retrieved from cookie:', token);
    }
  }, []);


  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const squareEnv = process.env.NEXT_PUBLIC_SQUARE_ENV;

  const squareScopes = [
    'ITEMS_WRITE',
    'ITEMS_READ',
    'INVENTORY_WRITE',
    'INVENTORY_READ',
    'MERCHANT_PROFILE_READ',
    'ORDERS_WRITE',
    'PAYMENTS_WRITE',
    'ORDERS_READ',
    'PAYMENTS_WRITE',
    'PAYMENTS_WRITE_SHARED_ONFILE',
    'PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS',
    'PAYMENTS_READ',
  ];
  const scopeString = squareScopes.join('+');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUri = encodeURIComponent(`${baseUrl}/api/square/auth/callback?merchantId=${merchant?._id}`);
  const squareAuthUrl = `https://connect.${squareEnv}.com/oauth2/authorize?client_id=${squareAppId}&scope=${scopeString}&session=false&state=${csrfToken}&redirect_uri=${redirectUri}`

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
  };

  const handleSetWalletForPurchase = (wallet: string | null) => {
    setWalletForPurchase(wallet);
  };

  const fetchLocations = async (merchantId: string) => {
    try {
      const response = await fetch(`/api/square/locations?merchantId=${merchantId}`);
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      if (isError(err)) {
        setError(`Error fetching locations: ${err.message}`);
      } else {
        setError('Error fetching locations');
      }
    }
  };

  const handleLocationSelect = async (locationId: string) => {
    setSelectedLocation(locationId);
    const accessToken = await getAccessToken();
    try {
      // Store selected location in the database for future use
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({ privyId: currentUser?.privyId, square_location_id: locationId })
      });
      if (!response.ok) {
        throw new Error('Failed to update selected location');
      }
    } catch (error) {
      console.error('Error updating selected location:', error);
      setError('Failed to update selected location');
    }
  };

  useEffect(() => {
    const fetchMerchant = async (id: string) => {
      try {
        const privyId = id
        const response = await fetch(`/api/merchant/privyId/${privyId}`);
        const data = await response.json();
        console.log('Fetched merchant:', data);
        setMerchant(data);
        fetchLocations(data._id);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      }
    }

    const fetchUser = async () => {
      if (!ready || !user?.id) return;

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        const userData = await response.json();

        if (!response.ok) throw new Error(userData.message || 'Failed to fetch user');

        setCurrentUser(userData.user);
        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress;
        setWalletForPurchase(walletAddress);

        if (userData.user.merchant) {
          fetchMerchant(userData.user.privyId)
        }

      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to fetch user data');
      }
    };

    if (ready && authenticated) {
      fetchUser();
    }
  }, [ready, authenticated, user?.id]); 


  useEffect(() => {
    if (merchant) {
      // setMerchantSet(true);
      console.log('Checking Square auth token with merchant:', merchant);

    }
  }, [merchant]);


  
  return (
    <Flex direction={'column'} gap={'4'} minHeight={'100vh'} width={'100%'} pb={'9'} pt={'6'} px={'5'}>  
      {ready && authenticated && (
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
            setCurrentUser={handleSetCurrentUser}
            setWalletForPurchase={handleSetWalletForPurchase}
          />
        </BalanceProvider>
      )}
      <Text size={'6'} weight={'bold'} style={{color: 'black'}}>Integrations</Text>
      <Flex direction={'column'} flexGrow={'1'} width={'100%'} justify={'start'} gap={'4'}>
        {ready && (
          authenticated ? (
            <>
              {currentUser && currentUser.merchant && (
                <>
                 <Flex direction={'column'} flexGrow={'1'} gap={'4'} align={'center'} p={'4'} style={{
                    boxShadow: 'var(--shadow-2)',
                    borderRadius: '10px'
                    }}>
                    <Avatar.Root>
                      <Avatar.Image 
                      className="SquareLogo"
                      src='/logos/Square_LogoLockup_Black.png'
                      alt="Square Integration"
                      style={{objectFit: "contain", maxWidth: '200px'}}
                      />
                    </Avatar.Root>

                    <Button asChild size={'4'} style={{width: '250px'}}>
                      <Link href={squareAuthUrl} target='_blank' rel='noopener noreferrer'>
                        Connect Square
                      </Link>
                    </Button>


                    {/* Placeholder for error messaging */}
                    {locations.length > 0 && (
                      <div>
                        <Text size={'4'} weight={'bold'}>Locations:</Text>
                        <ul>
                          {locations.map((location) => (
                            <li key={location.id}>
                              <Button onClick={() => handleLocationSelect(location.id)} disabled={!merchant}>
                                {location.name}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* On success, show other components like a status indicator of "authenicated" or "connected" with a green check mark */}




                  </Flex>
                </>
              )}
            </>
          ) : (
            <Flex direction={'column'} height={'80vh'} align={'center'} justify={'center'} gap={'5'}>
              <Text align={'center'}>
                Please log in to view this page
              </Text>
              <Button size={'4'}
              style={{
                width: '250px',
                backgroundColor: '#0051FD'
              }}
              onClick={login}>
              Log in
            </Button>
            </Flex>
          )
        )}
      </Flex>
    </Flex>
  )
}

export default function Integrations() {
  return (
    <Suspense fallback={<Spinner />}>
      <IntegrationsContent />
    </Suspense>
  );
}