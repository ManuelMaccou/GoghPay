'use client'

import React, { useState, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import * as Avatar from '@radix-ui/react-avatar';
import { AlertDialog, Button, Callout, Card, Flex, Heading, IconButton, Inset, Link, Spinner, Strong, Text, VisuallyHidden } from '@radix-ui/themes';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Location, Merchant, RewardsCustomer, SquareCatalog, User, PaymentType, SaleFormData } from '../types/types';
import { BalanceProvider } from '../contexts/BalanceContext';
import { Header } from '../components/Header';
import { useUser } from '../contexts/UserContext';
import { logAdminError } from '../utils/logAdminError';
import { ApiError } from '../utils/ApiError';

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

  const [newSaleFormData, setNewSaleFormData] = useState<SaleFormData | null>(null);

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentType | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [successMessage1, setSuccessMessage1] = useState<string | null>(null);
  const [successMessage2, setSuccessMessage2] = useState<string | null>(null);
  
  const [showVenmoDialog, setShowVenmoDialog] = useState<boolean>(false);
  const [showZelleDialog, setShowZelleDialog] = useState<boolean>(false);

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

  const fetchCheckedInCustomers = useCallback(async (merchantId: string) => {
    if (!currentUser) return;
    setIsFetchingCurrentRewardsCustomers(true)
    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/rewards/userRewards/customers/?merchantId=${merchantId}&privyId=${currentUser.privyId}`, {
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
  }, [currentUser]);

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
      fetchCheckedInCustomers(merchant._id);
    }
  }, [authenticated, ready, currentUser, merchant, fetchCheckedInCustomers]);

  useEffect(() => {
    if (merchant && merchant.paymentMethods.types.length > 0) {
      setPaymentMethods(merchant.paymentMethods.types);
    }
  }, [merchant]);

  useEffect(() => {
    const handleSquarePosPayment = (newSaleFormData: SaleFormData | null) => {
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/pos/callback`;
      const squareClientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!
      
      let priceInCents: number;
      const priceNum = parseFloat(newSaleFormData?.price || "0");
      
      if (newSaleFormData?.tax) {
        const taxAmount = (newSaleFormData.tax / 100) * priceNum;
        priceInCents = (priceNum + taxAmount) * 100;
      } else {
        priceInCents = priceNum * 100;
      }

      const finalPrice = priceInCents.toString();

      const dataParameter = {
        amount_money: {
          amount: finalPrice,
          currency_code: 'USD',
        },
        callback_url: callbackUrl,
        client_id: squareClientId,
        version: "1.3",
        notes: 'Thank you for your purchase!',
        customer_id: newSaleFormData?.customer?.userInfo.squareCustomerId,
        options: {
          supported_tender_types: ["CREDIT_CARD", "CASH", "OTHER", "SQUARE_GIFT_CARD", "CARD_ON_FILE"],
          auto_return: true,
        },
      };
  
      const url = `square-commerce-v1://payment/create?data=${encodeURIComponent(
        JSON.stringify(dataParameter)
      )}`;
  
      console.log("url:", url);
  
      // Redirect to Square Point of Sale app
      window.location.href = url;
    };

    if (selectedPaymentMethod === 'Square') {
      handleSquarePosPayment(newSaleFormData);
    }

  }, [newSaleFormData, selectedPaymentMethod])

  /*
  useEffect(() => {
    setShowVenmoDialog(selectedPaymentMethod === 'Venmo');
  }, [selectedPaymentMethod]);
  */

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

  const handlePaymentMethodChange = (method: PaymentType, newSaleForm: SaleFormData) => {
    setSelectedPaymentMethod(method);
    console.log('method:', method);
    if (method === 'Venmo') {
      setShowVenmoDialog(true);
    } else if (method === 'Zelle') {
      setShowZelleDialog(true);
    } else if (method === 'ManualEntry') {
      sessionStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));
      router.push('/checkout/manual');
    }
  };
  
  const handleQrCodeGenerated = (url: string) => {
    setSignedUrl(url);
  };

  const handleResetMessages = () => {
    setSuccessMessage1(null);
    setSuccessMessage2(null);
    setErrorMessage(null);
  };

  const handlePaymentSuccess = (result: any) => {
    console.log('Payment successful!', result);
    alert('Payment processed successfully!');
  };

  const handlePaymentFailure = (error: any) => {
    console.error('Payment failed!', error);
    alert('Payment failed. Please try again.');
  };


  const handleSavePaymentAndUpdateRewards = async (newSaleFormData: SaleFormData) => {
    const accessToken = await getAccessToken();

    if (newSaleFormData.customer) {
      try {
        const response = await fetch(`/api/rewards/userRewards/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            privyId: currentUser?.privyId,
            purchaseData: newSaleFormData,
          }),
        });

    
        if (!response.ok) {
          const errorData = await response.json();
          setNewSaleFormData(null);
          setErrorMessage('There was an error updating the customer rewards. We have received the error and are looking into it.');
    
          const apiError = new ApiError(
            `API Error: ${response.status} - ${response.statusText} - ${errorData.message || 'Unknown Error'}`,
            response.status,
            errorData
          );
      
          await logAdminError(merchant?._id, `Updating user rewards during ${newSaleFormData.paymentMethod} transaction`, {
            message: apiError.message,
            status: apiError.status,
            responseBody: apiError.responseBody,
            stack: apiError.stack,
          });
      
          console.error(apiError);
        } else {
          const result = await response.json();
          setSuccessMessage1('Customer rewards have been saved.');
          setNewSaleFormData(null);
          console.log('Rewards updated successfully:', result);
        }
      } catch (error) {
        // Catch any other errors and log them with their full details
        await logAdminError(merchant?._id, `Attempting to update user rewards`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      
        console.error(error);
      }
    }
    try {
      const priceNum = parseFloat(newSaleFormData.price);
      const calculatedSalesTax = parseFloat(((newSaleFormData.tax/100) * priceNum).toFixed(2));
      const response = await fetch(`/api/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: currentUser?.privyId,
          buyerPrivyId: currentUser?.privyId,
          merchantId: newSaleFormData.sellerMerchant?._id,
          productName: newSaleFormData.product,
          productPrice: newSaleFormData.price,
          salesTax: calculatedSalesTax,
          paymentType: newSaleFormData.paymentMethod,
          status: (newSaleFormData.paymentMethod === 'Venmo' || newSaleFormData.paymentMethod === 'Zelle') ? "COMPLETE" : "PENDING",
        }),
      });
  
      if (!response.ok) {
        setNewSaleFormData(null);
        setErrorMessage('There was an error saving the transaction. We have received the error and are looking into it.');
        const errorData = await response.json();
        
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${errorData.message || 'Unknown Error'}`,
          response.status,
          errorData
        );
    
        await logAdminError(merchant?._id, `Saving a ${newSaleFormData.paymentMethod} transaction`, {
          message: apiError.message,
          status: apiError.status,
          responseBody: apiError.responseBody,
          stack: apiError.stack,
        });
    
        console.error(error);
      } else {
        const result = await response.json();
        setSuccessMessage2('Transaction saved.');
        setNewSaleFormData(null);
        console.log('Transaction saved successfully:', result);
      }
    } catch (error) {

      await logAdminError(merchant?._id, `Attempting to save a ${newSaleFormData.paymentMethod} transaction`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'linear-gradient(to bottom, #1e5799 0%,#2989d8 50%,#207cca 51%,#7db9e8 100%)'
      }}
    >
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
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
              <>         
                {newSaleFormData && selectedPaymentMethod === 'Venmo' && (
                  newSaleFormData.sellerMerchant?.paymentMethods.venmoQrCodeImage ? (
                    <AlertDialog.Root open={showVenmoDialog} onOpenChange={setShowVenmoDialog}>
                      <AlertDialog.Trigger>
                        <Button style={{ display: 'none' }} />
                      </AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="450px">
                        <VisuallyHidden>
                          <AlertDialog.Title>Venmo QR code</AlertDialog.Title>
                        </VisuallyHidden>
                        <VisuallyHidden>
                          <AlertDialog.Description size="2" mb="4">
                          Venmo QR code
                          </AlertDialog.Description>
                        </VisuallyHidden>
                        
                        <Flex direction={'column'} width={'100%'} align={'center'} gap={'9'}>
                          <Avatar.Root>
                            <Avatar.Image 
                            src={ newSaleFormData.sellerMerchant?.paymentMethods.venmoQrCodeImage }
                            alt="Venmo QR code"
                            style={{objectFit: "contain", maxWidth: '100%'}}
                            />
                          </Avatar.Root>
                          <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                        </Flex>
                       
                        <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                          <AlertDialog.Cancel>
                            <Button size={'4'} variant="ghost" 
                              onClick={() => {
                                setSelectedPaymentMethod(null);
                                setNewSaleFormData(null);
                              }}>
                              Cancel
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button size={'4'} 
                              onClick={() => {
                                handleSavePaymentAndUpdateRewards(newSaleFormData);
                                setShowVenmoDialog(false);
                              }}>
                              Confirm
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  ) : newSaleFormData && !newSaleFormData.sellerMerchant?.paymentMethods.venmoQrCodeImage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        Venmo has not been configured. Please add your QR code in {" "} <Link href='/account/integrations'> <Strong>settings</Strong></Link>
                      </Callout.Text>
                    </Callout.Root>
                  )
                )}

                {newSaleFormData && selectedPaymentMethod === 'Zelle' && (
                  newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage ? (
                    <AlertDialog.Root open={showZelleDialog} onOpenChange={setShowZelleDialog}>
                      <AlertDialog.Trigger>
                        <Button style={{ display: 'none' }} />
                      </AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="450px">
                        <VisuallyHidden>
                          <AlertDialog.Title>Zelle QR code</AlertDialog.Title>
                        </VisuallyHidden>
                        <VisuallyHidden>
                          <AlertDialog.Description size="2" mb="4">
                          Zelle QR code
                          </AlertDialog.Description>
                        </VisuallyHidden>
                        
                        <Flex direction={'column'} width={'100%'} align={'center'} gap={'9'}>
                          <Avatar.Root>
                            <Avatar.Image 
                            src={ newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage }
                            alt="Zelle QR code"
                            style={{objectFit: "contain", maxWidth: '100%'}}
                            />
                          </Avatar.Root>
                          <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                        </Flex>
                       
                        <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                          <AlertDialog.Cancel>
                            <Button size={'4'} variant="ghost" 
                              onClick={() => {
                                setSelectedPaymentMethod(null);
                                setNewSaleFormData(null);
                              }}>
                              Cancel
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button size={'4'} 
                              onClick={() => {
                                handleSavePaymentAndUpdateRewards(newSaleFormData);
                                setShowZelleDialog(false);
                              }}>
                              Confirm
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  ) : newSaleFormData && !newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        Zelle has not been configured. Please add your QR code in {" "} <Link href='/account/integrations'> <Strong>settings</Strong></Link>
                      </Callout.Text>
                    </Callout.Root>
                  )
                )} 
                
                {!newSaleFormData ? (
                  <NewSaleForm
                    onQrCodeGenerated={handleQrCodeGenerated}
                    onMessageUpdate={handleMessageUpdate}
                    userId={user.id}
                    merchantFromParent={merchant}
                    customers={currentRewardsCustomers}
                    paymentMethods={paymentMethods}
                    onNewSaleFormSubmit={(formData: SaleFormData) => {
                      setNewSaleFormData(formData);
                      handlePaymentMethodChange(formData.paymentMethod, formData);
                    }}
                    onStartNewSale={handleResetMessages}
                  />
                ) : null}

                <Flex direction={'column'} gap={'4'}>
                  {successMessage1 && (
                    <Callout.Root color='green' mx={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text size={'6'}>
                      {successMessage1}
                    </Callout.Text>
                  </Callout.Root>
                  )}

                  {successMessage2 && (
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {successMessage2}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {errorMessage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {errorMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}
                </Flex>
                </>
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