'use client'

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { useMerchant } from "@/app/contexts/MerchantContext";
import { Merchant, User, Location, FileData } from "@/app/types/types";
import { AlertDialog, Box, Button, Dialog, Flex, Heading, Link, RadioGroup, Spinner, Strong, Text, VisuallyHidden } from "@radix-ui/themes";
import * as Avatar from '@radix-ui/react-avatar';
import { Suspense, useEffect, useState } from "react";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import crypto from 'crypto';
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import NotificationMessage from "@/app/components/Notification";
import UploadImage from "@/app/components/UploadImage";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function IntegrationsContent() {
  const [error, setError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [isFetchingLocations, setIsFetchingLocations] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [squareLocationName, setSquareLocationName] = useState<string | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState<boolean>(false);

  const [venmoQrCode, setVenmoQrCode] = useState<string | null>(null);
  const [zelleQrCode, setZelleQrCode] = useState<string | null>(null);

  const { login, user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const { merchant, isFetchingMerchant, setMerchant } = useMerchant();

  const searchParams = useSearchParams();

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');

    setStatus(statusParam);
    setMessage(decodeURIComponent(messageParam || ''));
  }, [searchParams]);

  useEffect(() => {
    if (status === 'success') {
      setShowLocationDialog(true);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'error') {
      setError(message);
    }
  }, [status, message]);

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
    } else {
      setCsrfToken(token);
    }
  }, []);

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

  // const selectedLocationDetails = locations.find(location => location.id === selectedLocation);


  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const squareEnv = process.env.NEXT_PUBLIC_SQUARE_ENV;

  const squareScopes = [
    'CUSTOMERS_READ',
    'CUSTOMERS_WRITE',
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUri = encodeURIComponent(`${baseUrl}/api/square/auth/callback?merchantId=${merchant?._id}`);
  const squareAuthUrl = `https://connect.${squareEnv}.com/oauth2/authorize?client_id=${squareAppId}&scope=${scopeString}&session=false&state=${csrfToken}&redirect_uri=${redirectUri}`

  const handleRevokeSquareAccess = async () => {
    setError(null)
    setRevokeError(null)
    setRevokeSuccess(null)
    if (!merchant) {
      setRevokeError('Merchant not found');
      return;
    }

    const accessToken = await getAccessToken();
    try {
      const response = await fetch(`/api/square/auth/revokeAccess?merchantId=${merchant._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
      });
      if (!response.ok) {
        throw new Error('Failed to revoke Square access');
      }
      const result = await response.json();
      if (result.success) {
        setRevokeSuccess('Access revoked')

        await fetch(`/api/merchant/update`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({ 
            privyId: currentUser?.privyId,
            square: {
              access_token: "",
              refresh_token: "",
              merchant_id: "",
              token_expires_at: "",
              location_id: "",
              location_name: "",
            }
          })
        });

        await fetchLocations(merchant._id);
      } else {
        setRevokeError('Failed to revoke Square access');
      }
    } catch (error) {
      console.error('Error revoking Square access:', error);
      setRevokeError('Failed to revoke Square access');
    }
  };

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

  const handleLocationSelect = async () => {
    setError(null);
    setRevokeError(null);
    setRevokeSuccess(null);
    if (!selectedLocation) return;
    
    const accessToken = await getAccessToken();
    try {
      // Store selected location in the database for future use
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: currentUser?.privyId,
          square: {
            location_id: selectedLocation.id,
            location_name: selectedLocation.name
          },
        })
      });
      if (!response.ok) {
        throw new Error('Failed to update selected location');
      } else {
        setSquareLocationName(selectedLocation.name);
      }
    } catch (error) {
      console.error('Error updating selected location:', error);
      setError('Failed to update selected location');
    }
  };

  useEffect(() => {
    setIsFetchingLocations(true);
    const fetchMerchant = async (id: string) => {
      try {
        const privyId = id
        const response = await fetch(`/api/merchant/privyId/${privyId}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch merchant');
        }

        const data = await response.json();
        setMerchant(data);
        await fetchLocations(data._id);

        if (data.square && data.square?.location_name) {
          setSquareLocationName(data.square.location_name);
        } else {
          setSquareLocationName(null);
        }

      } catch (err) {
        if (isError(err)) {
          console.error(`Error fetching merchant: ${err.message}`);
        } else {
          console.error('Error fetching merchant');
        }
      } finally {
        setIsFetchingLocations(false);
      }
    }

    const fetchUser = async () => {
      if (!ready || !user?.id) return;

      try {
        const response = await fetch(`/api/user/me/${user.id}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch user');
        }
        const userData = await response.json();

        if (!userData.user) {
          throw new Error('No user data found');
        }

        setCurrentUser(userData.user);

        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress || null;
        setWalletForPurchase(walletAddress);

        if (userData.user.merchant && userData.user.privyId) {
          await fetchMerchant(userData.user.privyId);
        }

      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsFetchingLocations(false);
      }
    };

    if (ready && authenticated) {
      fetchUser();
    }
  }, [ready, authenticated, user?.id, setMerchant]); 

  useEffect(() => {
    if (!merchant?.paymentMethods) return;
    if (!merchant.paymentMethods.venmoQrCodeImage) return;
  
    setVenmoQrCode(merchant.paymentMethods.venmoQrCodeImage);
  }, [merchant]);

  useEffect(() => {
    if (!merchant?.paymentMethods) return;
    if (!merchant.paymentMethods.zelleQrCodeImage) return;
    
    setZelleQrCode(merchant.paymentMethods.zelleQrCodeImage)
  }, [merchant])

  
  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'linear-gradient(to bottom, #45484d 0%,#000000 100%)'
      }}
    >
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
        <Heading size={'8'} style={{color: "white"}}>Integrations</Heading>
        <Header
          color={"white"}
          merchant={currentUser?.merchant}
          embeddedWallet={embeddedWallet}
          authenticated={authenticated}
          walletForPurchase={walletForPurchase}
          currentUser={currentUser}
        />
      </Flex>
      <Flex
        flexGrow={'1'}
        p={'5'}
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
        <Flex direction={'column'} flexGrow={'1'} width={'100%'} justify={'start'} gap={'4'}>
          {ready && (
            authenticated ? (
              <>
                {currentUser && currentUser.merchant && (
                  <>
                  <Flex direction={'column'} gap={'4'} align={'center'} p={'4'} style={{
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

                      <Flex direction={'column'} gap={'4'}>
                        {!isFetchingLocations ? (
                          locationError ? (
                            <Flex direction={'column'} gap={'2'}>
                              <Flex direction={'row'} gap={'2'}>
                                <Text><Strong>Status:</Strong> Not connected</Text>
                                <RedCircle />
                              </Flex>
                              <Text>{locationError}</Text>
                              <Button asChild size={'4'} style={{width: '250px'}}>
                                <Link href={squareAuthUrl}>
                                  Connect Square
                                </Link>
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
                                    <Button variant="ghost" onClick={() => setShowLocationDialog(true)}>
                                      Select location
                                    </Button>
                                  )}

                                  <AlertDialog.Root>
                                    <AlertDialog.Trigger>
                                      <Button color="red">Revoke access</Button>
                                    </AlertDialog.Trigger>
                                    <AlertDialog.Content maxWidth="450px">
                                      <AlertDialog.Title>Revoke access</AlertDialog.Title>
                                      <AlertDialog.Description size="2">
                                        Are you sure? Square will no longer be accessible and any
                                        existing sessions will be expired.
                                      </AlertDialog.Description>

                                      <Flex gap="3" mt="4" justify="between">
                                        <AlertDialog.Cancel>
                                          <Button variant="soft" color="gray">
                                            Cancel
                                          </Button>
                                        </AlertDialog.Cancel>
                                        <AlertDialog.Action>
                                          <Button variant="solid" color="red" onClick={handleRevokeSquareAccess}>
                                            Revoke access
                                          </Button>
                                        </AlertDialog.Action>
                                      </Flex>
                                    </AlertDialog.Content>
                                  </AlertDialog.Root>
                                </>
                              ) : (
                                <Button asChild size={'4'} style={{width: '250px'}}>
                                  <Link href={squareAuthUrl}>
                                    Connect Square
                                  </Link>
                                </Button>
                              )}
                            </>
                          )
                        ) : (
                          <Spinner />
                        )}
                      </Flex>

                      {revokeError && (
                        <Box mx={'3'}>
                          <NotificationMessage message={revokeError} type="error" />
                        </Box>
                      )}
                      {revokeSuccess && (
                        <Box mx={'3'}>
                          <NotificationMessage message={revokeSuccess} type="success" />
                        </Box>
                      )}
                      {error && (
                        <Box mx={'3'}>
                          <NotificationMessage message={error} type="error" />
                        </Box>
                      )}

                    
                    </Flex>


                    <Flex direction={'column'} gap={'4'} align={'center'} p={'4'} style={{
                      boxShadow: 'var(--shadow-2)',
                      borderRadius: '10px'
                      }}>
                      <Avatar.Root>
                        <Avatar.Image 
                        src='/paymentMethodLogos/venmo.png'
                        alt="Venmo Integration"
                        style={{objectFit: "contain", maxWidth: '100px'}}
                        />
                      </Avatar.Root>
                      {!isFetchingMerchant && (
                        <>
                          {merchant && !venmoQrCode? (
                            <Flex direction={'column'}>
                              <UploadImage 
                                merchantId={merchant._id}
                                paymentProvider='Venmo'
                                onUploadSuccess={(updatedMerchant: Merchant) => setMerchant(updatedMerchant)} 
                              />
                            </Flex>
                          ) : ( 
                            venmoQrCode && (
                              <Flex direction={'column'} gap={'5'} width={'100%'}>
                                <Avatar.Root style={{alignSelf: 'center'}}>
                                  <Avatar.Image
                                    src={venmoQrCode}
                                    alt="Venmo QR Code"
                                    style={{objectFit: "contain", maxWidth: '150px'}}
                                  />
                                </Avatar.Root>
                                <Button color="red"
                                    onClick={() => setVenmoQrCode(null)}
                                  >
                                  Change
                                </Button>
                              </Flex>
                            )
                          )}
                        </>
                      )}
                    </Flex>
    
                    <Flex direction={'column'} gap={'4'} align={'center'} p={'4'} style={{
                      boxShadow: 'var(--shadow-2)',
                      borderRadius: '10px'
                      }}>
                      <Avatar.Root>
                        <Avatar.Image 
                        src='/paymentMethodLogos/zelle.png'
                        alt="Zelle Integration"
                        style={{objectFit: "contain", maxWidth: '100px'}}
                        />
                      </Avatar.Root>
                      {!isFetchingMerchant && (
                        <>
                          {merchant && !zelleQrCode ? (
                            <Flex direction={'column'}>
                              <UploadImage 
                                merchantId={merchant._id}
                                paymentProvider='Zelle'
                                onUploadSuccess={(updatedMerchant: Merchant) => setMerchant(updatedMerchant)} 
                              />
                            </Flex>
                          ) : ( 
                            zelleQrCode && (
                              <Flex direction={'column'} gap={'5'} width={'100%'}>
                                <Avatar.Root style={{alignSelf: 'center'}}>
                                  <Avatar.Image
                                    src={zelleQrCode}
                                    alt="Zelle QR Code"
                                    style={{objectFit: "contain", maxWidth: '150px'}}
                                  />
                                </Avatar.Root>
                                <Button color="red"
                                    onClick={() => setZelleQrCode(null)}
                                  >
                                  Change
                                </Button>
                              </Flex>
                            )
                          )}
                        </>
                      )}
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
    </Flex>
  )
};

export default function Integrations() {
  return (
    <Suspense fallback={<Spinner />}>
      <IntegrationsContent />
    </Suspense>
  );
}