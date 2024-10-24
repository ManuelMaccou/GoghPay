'use client'

import { useRouter } from 'next/navigation';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { useUser } from '@/app/contexts/UserContext';
import { AlertDialog, Button, Callout, Flex, Heading, Link, RadioGroup, Spinner, Strong, Text, VisuallyHidden } from "@radix-ui/themes";
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import * as Sentry from '@sentry/nextjs';
import { use, useEffect, useState } from 'react';
import { ArrowRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import Cookies from "js-cookie";
import crypto from 'crypto';
import { useSearchParams } from "next/navigation";
import { Location } from '@/app/types/types';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Step3() {
  const router = useRouter();
  const { merchant, setMerchant } = useMerchant();
  const { appUser, setAppUser } = useUser();
  const { user } = usePrivy();

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [showLocationDialog, setShowLocationDialog] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isFetchingLocations, setIsFetchingLocations] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMessageWithLogin, setErrorMessageWithLogin] = useState<boolean>(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [squareLocationName, setSquareLocationName] = useState<string | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    let token = Cookies.get('csrfToken');
  
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      setCsrfToken(token);
  
      Cookies.set('csrfToken', token, {
        expires: 1, // 1 day
        path: '/',
        secure: process.env.SECURE_ENV === 'true', // Secure flag set based on environment
        sameSite: 'lax' // Changed from 'strict' to 'lax'
      });
    } else {
      setCsrfToken(token);
    }
  }, []);

  useEffect(() => {
    const fetchLocations = async (merchantId: string) => {
      setIsFetchingLocations(true);
      try {
        const response = await fetch(`/api/square/locations?merchantId=${merchantId}`);
        console.log('location response:', response);
        if (response.status === 401) {
          const errorText = await response.text();
          if (errorText.includes('expired')) {
            setLocationError('Token expired. Please reconnect.');
          } else if (errorText.includes('revoked')) {
            setLocationError('Token revoked. Please reconnect.');
          } else if (errorText.includes('No access token')) {
            setLocationError(null);
          } else {
            setLocationError('Unauthorized. Please reconnect.');
          }
          setLocations([]);
        } else if (response.status === 403) {
          setLocationError('Insufficient permissions. Please contact us.');
          setLocations([]);
        } else if (response.ok) {
          const data = await response.json();
          setLocations(data.locations || []);
        } else {
          setLocationError('Process failed. Please try again.');
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

    if (merchant && merchant.square?.access_token) {
      fetchLocations(merchant._id);
    }
  }, [merchant]);

  useEffect(() => {
    if (merchant?.square?.location_name) {
      setSquareLocationName(merchant.square.location_name);
    }
  }, [merchant?.square]);

  useEffect(() => {
    if (typeof window !== 'undefined' && searchParams) {
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message');
      
      setStatus(statusParam);
      setMessage(decodeURIComponent(messageParam || ''));
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'error') {
      setErrorMessage(message);
    }
  }, [status, message]);

  useEffect(() => {
    if (status === 'success') {
      setShowLocationDialog(true);
    }
  }, [status]);

  const handleLocationSelect = async () => {
    setErrorMessage(null);
    if (!selectedLocation) return;
    
    const accessToken = await getAccessToken();
    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: user?.id,
          square: {
            location_id: selectedLocation.id,
            location_name: selectedLocation.name
          },
        })
      });
      if (!response.ok) {
        throw new Error('Failed to update selected location');
      } else {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        setSquareLocationName(selectedLocation.name);
      }
    } catch (error) {
      console.error('Error updating selected location:', error);
      setErrorMessage('Failed to update selected location');
      Sentry.captureException(error);
    }
  };

  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const squareEnv = process.env.NEXT_PUBLIC_SQUARE_ENV;
  const squareScopes = [
    'CUSTOMERS_READ',
    'CUSTOMERS_WRITE',
    'DEVICE_CREDENTIAL_MANAGEMENT',
    'ITEMS_WRITE',
    'ITEMS_READ',
    'MERCHANT_PROFILE_READ',
    'ORDERS_WRITE',
    'ORDERS_READ',
    'PAYMENTS_WRITE',
    'PAYMENTS_WRITE_SHARED_ONFILE',
    'PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS',
    'PAYMENTS_READ',
  ];
  const scopeString = squareScopes.join('+');

  const destinationPath = '/onboard/step3';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUri = encodeURIComponent(`${baseUrl}/api/square/auth/callback?merchantId=${merchant?._id}&path=${destinationPath}`);
  const squareAuthUrl = `https://connect.${squareEnv}.com/oauth2/authorize?client_id=${squareAppId}&scope=${scopeString}&session=false&state=${csrfToken}&redirect_uri=${redirectUri}`

  const handleConnectSquare = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      router.push(squareAuthUrl);
    }, 100);
  };

  const RedCircle = () => (
    <svg width="16" height="16">
      <circle cx="5" cy="5" r="5" fill="red" />
    </svg>
  );

  const GreenCircle = () => (
    <svg width="16" height="16">
      <circle cx="5" cy="5" r="5" fill="green" />
    </svg>
  );
  
  const handleFinishStep3 = async () => {
    if (!merchant) {
      console.error("No merchant data available");
      setErrorMessageWithLogin(true);
      return;
    }

    if (!merchant.square) {
      setErrorMessage("Please connect to Square first.");
      return;
    }

    if (!merchant.square.location_name) {
      setErrorMessage("Please select a location first.");
      return;
    }

    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          onboardingStep: 3,
        }),
      });

      if (response.ok) {
        const updatedMerchant = await response.json();
        setMerchant(updatedMerchant.merchant);
        router.push('/onboard/step4');
      } else {
        setErrorMessage('An unexpected error happened. Please try again later.');
        console.error('Failed to update merchant', response.statusText);
        Sentry.captureException(new Error(`Failed to update merchant: ${response.statusText} (Status: ${response.status})`));
      }
    } catch (error) {
      console.error('An unexpected error happened:', error);
      setErrorMessage('An unexpected error happened. Please try again later.');
      Sentry.captureException(error);
    }
  };

  useEffect(() => {
    if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 2) {
      const timer = setTimeout(() => {
        router.push(`/onboard/step${merchant.onboardingStep || '1'}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 2) {
    return (
      <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
        <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Connect Square</Heading>
        <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
          <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
          <Text>Redirecting...</Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
      <Heading size={{ initial: "5", sm: "8" }} align={'center'}>Connect Square</Heading>
      <Flex direction={'column'} justify={'center'}  gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center'}}>
        <Text>
          Connect your Square account to accept credit card and mobile payments.
        </Text>

        <AlertDialog.Root open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <AlertDialog.Trigger>
            <Button style={{ display: 'none' }} />
          </AlertDialog.Trigger>
          <AlertDialog.Content maxWidth="450px">
            <AlertDialog.Title>Select a location</AlertDialog.Title>
            <VisuallyHidden>
              <AlertDialog.Description size="2" mb="4">
                Select a location
              </AlertDialog.Description>
            </VisuallyHidden>
            {!isFetchingLocations ? (
              <RadioGroup.Root value={selectedLocation?.id || ''} onValueChange={(value) => setSelectedLocation(locations.find(loc => loc.id === value) || null)} name="locations">
                {locations.map((location) => (
                  <RadioGroup.Item key={location.id} value={location.id} disabled={!merchant}>
                    <Text as='label'>{location.name}</Text>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            ) : (
              <Spinner />
            )}
            <Flex gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
              <AlertDialog.Action>
                <Button onClick={handleLocationSelect}>
                    Continue
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>

        <Flex direction={'column'}>
          {!isFetchingLocations ? (
            locationError ? (
              <Flex direction={'column'} gap={'2'}>
                <Flex direction={'row'} gap={'2'}>
                  <Text><Strong>Status:</Strong> Not connected</Text>
                  <RedCircle />
                </Flex>
                <Text>{locationError}</Text>
                <Button 
                  loading={isAuthenticating}
                  size={'4'}
                  style={{width: '250px'}}
                  onClick={handleConnectSquare}
                >
                  Connect Square
                </Button>
              </Flex>
            ) : (
              <>
                {locations.length > 0 ? (
                  <>
                    <Flex direction={'row'} gap={'2'}>
                      <Text><Strong>Status:</Strong> Connected</Text>
                      <GreenCircle />
                    </Flex>

                    {squareLocationName ? (
                      <>
                  
                        <Flex direction={'row'} gap={'4'} align={'center'} mb={'4'}>
                          <Text><Strong>Location:</Strong> {squareLocationName}</Text>
                          <Button variant="ghost" onClick={() => setShowLocationDialog(true)}>
                            Change location
                          </Button>
                        </Flex>
                      
                      </>
                    ) : (
                      <Flex direction={'row'} gap={'4'} my={'4'}>
                        <Button variant="ghost" onClick={() => setShowLocationDialog(true)}>
                          Select location
                        </Button>
                      </Flex>
                    )}

                    
                  </>
                ) : (
                  <Button 
                    loading={isAuthenticating}
                    size={'4'}
                    style={{width: '250px'}}
                    onClick={handleConnectSquare}
                  >
                    Connect Square
                  </Button>
                )}
              </>
            )
          ) : (
            <Spinner />
          )}
        </Flex>
      </Flex>
      <Flex direction={'column'} align={{initial: 'center', sm: 'end'}} justify={'end'} width={'100%'}>
      <Button
        disabled={!merchant || !merchant.square || !merchant.square.access_token}
        size={'4'}
        variant='ghost'
        style={{ width: '250px', cursor: !merchant ? 'default' : 'pointer', fontWeight: 'bold' }}
          onClick={handleFinishStep3}
        >
          Next
          <ArrowRightIcon height={'20'} width={'20'} />
        </Button>
      </Flex>
      {errorMessage && (
        <Callout.Root color='red' mx={'4'}>
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            {errorMessage}
          </Callout.Text>
        </Callout.Root>
      )}
      {errorMessageWithLogin && (
        <Callout.Root color='red' mx={'4'}>
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            An unexpected error happened. Please {" "} <Link href="/">log in and try again.</Link>
          </Callout.Text>
        </Callout.Root>
      )}
    </Flex>
  );
}