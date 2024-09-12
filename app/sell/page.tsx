'use client'

import React, { useState, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import * as Avatar from '@radix-ui/react-avatar';
import { AlertDialog, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Text, VisuallyHidden } from '@radix-ui/themes';
import { ExclamationTriangleIcon, InfoCircledIcon, RocketIcon } from '@radix-ui/react-icons';
import { Location, Merchant, RewardsCustomer, SquareCatalog, User, PaymentType, SaleFormData } from '../types/types';
import { BalanceProvider } from '../contexts/BalanceContext';
import { Header } from '../components/Header';
import { useUser } from '../contexts/UserContext';
import { logAdminError } from '../utils/logAdminError';
import { ApiError } from '../utils/ApiError';
import { useDeviceType } from '../contexts/DeviceType';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Sell() {
  const { appUser, setIsFetchingUser, setAppUser } = useUser();
  const { ready, authenticated, user, login } = usePrivy();
  const deviceType = useDeviceType();

  const [currentUser, setCurrentUser] = useState<User>();

  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  
  const [signedUrl, setSignedUrl] = useState('');
  const [merchant, setMerchant] = useState<Merchant>();
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentType[]>([]);

  const [newSaleFormData, setNewSaleFormData] = useState<SaleFormData | null>(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState<boolean>(true);

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

  const [rewardsDiscount, setRewardsDiscount] = useState<number | 0>(0);
  const [welcomeDiscount, setWelcomeDiscount] = useState<number | 0>(0);
  const [finalPriceCalculated, setFinalPriceCalculated] = useState<boolean>(false);
  const [finalPrice, setFinalPrice] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [successMessage1, setSuccessMessage1] = useState<string | null>(null);
  const [successMessage2, setSuccessMessage2] = useState<string | null>(null);
  const [discountUpgradeMessage, setDiscountUpgradeMessage] = useState<string | null>(null);
  const [squarePosError, setSquarePosError] = useState<string | null>(null);
  
  const [showVenmoDialog, setShowVenmoDialog] = useState<boolean>(false);
  const [showZelleDialog, setShowZelleDialog] = useState<boolean>(false);
  const [showCashDialog, setShowCashDialog] = useState<boolean>(false);
  const [showSquareDialog, setShowSquareDialog] = useState<boolean>(false);

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
        next: {revalidate: 1},
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

        const data = await response.json()

        if (response.status === 404) {
          setMerchantVerified(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        } else {
          setMerchant(data);
          setMerchantVerified(true);
        }

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


  
  const handleSquarePosPayment = (newSaleFormData: SaleFormData | null) => {
    if (!finalPrice || !finalPriceCalculated) {
      setSquarePosError('Missing payment details. Please refresh the page and try again.')
      return;
    } 

    //const squareClientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!;
    const squareClientId = 'sq0idp-Zy45WMkZUPguS3T00fiL7g';
    const priceInCents = Math.round(parseFloat(finalPrice) * 100);

    if (deviceType === 'iPhone') {
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/ios`;
      const dataParameter = {
        amount_money: {
          amount: priceInCents,
          currency_code: 'USD',
        },
        callback_url: callbackUrl,
        client_id: squareClientId,
        version: "2.0",
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

      window.location.href = url;

    } else if (deviceType === 'Android') {
      //const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/squarePayment/poscallback`;
      //const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/android`;
      const callbackUrl = `https://60aa-2600-387-15-1d17-00-7.ngrok-free.app/api/square/payment/pos/callback/android`;
      //const callbackUrl = 'https://60aa-2600-387-15-1d17-00-7.ngrok-free.app/squarePayment/poscallback';
      const sdkVersion = "v2.0";
      const currencyCode = "USD";
      const customerId = newSaleFormData?.customer?.userInfo.squareCustomerId;
      const tenderTypes = [
        "com.squareup.pos.TENDER_CARD",
      ].join(",");

      const posUrl =
        "intent:#Intent;" +
        "action=com.squareup.pos.action.CHARGE;" +
        "package=com.squareup;" +
        `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)};` +
        `S.com.squareup.pos.CLIENT_ID=${squareClientId};` +
        `S.com.squareup.pos.API_VERSION=${sdkVersion};` +
        `i.com.squareup.pos.TOTAL_AMOUNT=${priceInCents};` + 
        `S.com.squareup.pos.CURRENCY_CODE=${currencyCode};` +
        `S.com.squareup.pos.TENDER_TYPES=${tenderTypes};` +
        `S.com.squareup.pos.NOTE=${encodeURIComponent('Gogh initiated tap-to-pay')};` +
        "end;";

        console.log('url:', posUrl)

        window.location.href = posUrl;
    }
  };
  

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
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Zelle') {
      setShowZelleDialog(true);
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Cash') {
      setShowCashDialog(true);
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Square') {
      setShowSquareDialog(true);
      sessionStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));

    } else if (method === 'ManualEntry') {
      sessionStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));
      router.push('/checkout/manual');
    }
  };

  useEffect(() => {
    const storedData = sessionStorage.getItem('newSaleFormData');
    
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setNewSaleFormData(parsedData);
    }
  }, []);

  useEffect(() => {
    setRewardsDiscount(0);
    setWelcomeDiscount(0);
    setFinalPriceCalculated(false)
    setFinalPrice(null);

    if (!newSaleFormData) return;
    if (!newSaleFormData.price) return;

    const priceNum = parseFloat(newSaleFormData.price)

    let rewardsDiscountAmount = 0;
    let welcomeDiscountAmount = 0;
    let priceAfterDiscount = priceNum;
    let finalPriceCalculation = priceNum;


    if (newSaleFormData.sellerMerchant?.rewards?.welcome_reward && newSaleFormData.customer?.purchaseCount === 1) {
      welcomeDiscountAmount = newSaleFormData.sellerMerchant?.rewards?.welcome_reward
    }

    if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.amount) {
      rewardsDiscountAmount = newSaleFormData.customer.currentDiscount.amount
    }

    const totalDiscountAmount = rewardsDiscountAmount + welcomeDiscountAmount

    if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.type === 'percent') {
      if (totalDiscountAmount > 100) {
        priceAfterDiscount = 0
      } else {
        priceAfterDiscount = priceNum - ((totalDiscountAmount/100) * priceNum)
      }

    } else if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.type === 'dollar') {
      priceAfterDiscount = priceNum - totalDiscountAmount
      if (priceAfterDiscount < 0) {
        priceAfterDiscount = 0
      }
    }
    
    if (newSaleFormData.tax > 0) {
      finalPriceCalculation = priceAfterDiscount + ((newSaleFormData.tax / 100) * priceAfterDiscount);
    } else {
      finalPriceCalculation = priceAfterDiscount
    }

    setRewardsDiscount(rewardsDiscountAmount);
    setWelcomeDiscount(welcomeDiscountAmount);
    setFinalPriceCalculated(true);
    setFinalPrice(finalPriceCalculation.toFixed(2));

  }, [newSaleFormData])

  useEffect(() => {
    // Clear sessionStorage on page refresh
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('newSaleFormData');
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
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
    console.log('status before transaction:', newSaleFormData.paymentMethod)
    console.log('newsaleformdata:', newSaleFormData);

    const priceNum = parseFloat(newSaleFormData.price);
    const calculatedSalesTax = parseFloat(((newSaleFormData.tax/100) * priceNum).toFixed(2));

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
            finalPrice,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          setNewSaleFormData(null);
          setShowNewSaleForm(true);
          setErrorMessage('There was an error updating the customer rewards. We have received the error and are looking into it.');
    
          const apiError = new ApiError(
            `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
            response.status,
            responseData
          );
      
          await logAdminError(merchant?._id, `Updating user rewards during ${newSaleFormData.paymentMethod} transaction`, {
            message: apiError.message,
            status: apiError.status,
            responseBody: apiError.responseBody,
            stack: apiError.stack,
          });
      
          console.error(apiError);
        } else {
          if (merchant) {
            fetchCheckedInCustomers(merchant._id)
          }
          setSuccessMessage1('Customer rewards have been saved.');
          setNewSaleFormData(null);
          setShowNewSaleForm(true);

          if (responseData.discountUpgradeMessage) {
            setDiscountUpgradeMessage(responseData.discountUpgradeMessage)
          }

          console.log('Rewards updated successfully:', responseData);
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
      
      const response = await fetch(`/api/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: currentUser?.privyId,
          buyerPrivyId: currentUser?.privyId, // Needs to be the current user for auth purposes. Special case since the merchant is triggering the purchase for the buyer
          buyerId: newSaleFormData.customer?.userInfo._id,
          merchantId: newSaleFormData.sellerMerchant?._id,
          productName: newSaleFormData.product,
          productPrice: newSaleFormData.price,
          discountType: newSaleFormData.customer?.currentDiscount.type,
          discountAmount: newSaleFormData.customer?.currentDiscount.amount,
          welcomeDiscount: welcomeDiscount,
          salesTax: calculatedSalesTax,
          paymentType: newSaleFormData.paymentMethod,
          status: (newSaleFormData.paymentMethod === 'Venmo' || newSaleFormData.paymentMethod === 'Zelle' || newSaleFormData.paymentMethod === 'Cash') ? "COMPLETE" : "PENDING",
        }),
      });

      const data = await response.json();
  
      if (!response.ok) {
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
        setErrorMessage('There was an error saving the transaction. We have received the error and are looking into it.');
        
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${data.message || 'Unknown Error'}`,
          response.status,
          data
        );
    
        await logAdminError(merchant?._id, `Saving a ${newSaleFormData.paymentMethod} transaction`, {
          message: apiError.message,
          status: apiError.status,
          responseBody: apiError.responseBody,
          stack: apiError.stack,
        });
    
        console.error(error);
      } else {
        setSuccessMessage2('Transaction saved.');
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
        sessionStorage.removeItem('newSaleFormData');
        console.log('Transaction saved successfully:', data);
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
                        
                        <Flex direction={'column'} width={'100%'} justify={'center'} align={'center'} gap={'6'}>
                          
                          {newSaleFormData && finalPriceCalculated && (
                            <Flex direction={'column'} justify={'center'}>
                              <Text size={'9'} align={'center'}>${finalPrice}</Text>
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                                <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                              </Flex>
                              {rewardsDiscount > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                                  ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                                  )}
                                </Flex>
                              )}

                              {welcomeDiscount > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                                  ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                                  )}
                                </Flex>
                              )}
                          
                              {newSaleFormData.tax > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Sales tax:</Text>
                                  <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                                </Flex>
                              )}
                            </Flex>
                          )}

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
                                setShowNewSaleForm(true);
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
                        
                        <Flex direction={'column'} width={'100%'} align={'center'} gap={'6'}>

                          {newSaleFormData && finalPriceCalculated && (
                            <Flex direction={'column'} justify={'center'}>
                            <Text size={'9'} align={'center'}>${finalPrice}</Text>
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                              <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                            </Flex>
                            {rewardsDiscount > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                  <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                                ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                  <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                                )}
                              </Flex>
                            )}

                            {welcomeDiscount > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                  <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                                ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                  <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                                )}
                              </Flex>
                            )}
                        
                            {newSaleFormData.tax > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Sales tax:</Text>
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                              </Flex>
                            )}
                            </Flex>
                          )}
                         
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
                                setShowNewSaleForm(true);
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

                {newSaleFormData && selectedPaymentMethod === 'Cash' && (
                  <AlertDialog.Root open={showCashDialog} onOpenChange={setShowCashDialog}>
                    <AlertDialog.Trigger>
                      <Button style={{ display: 'none' }} />
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <VisuallyHidden>
                        <AlertDialog.Title>Cash payment</AlertDialog.Title>
                      </VisuallyHidden>
                      <VisuallyHidden>
                        <AlertDialog.Description size="2" mb="4">
                          Cash payment
                        </AlertDialog.Description>
                      </VisuallyHidden>
                      
                      <Flex direction={'column'} width={'100%'} align={'center'} justify={'center'} gap={'9'}>
                        {newSaleFormData && finalPriceCalculated && (
                          <Flex direction={'column'} justify={'center'}>
                        <Text size={'9'} align={'center'}>${finalPrice}</Text>
                          <Flex direction={'row'} width={'300px'} justify={'between'}>
                            <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                            <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                          </Flex>
                          {rewardsDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Welcome discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                              )}
                            </Flex>
                          )}
                      
                          {newSaleFormData.tax > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Sales tax:</Text>
                              <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                            </Flex>
                          )}
                          </Flex>
                        )}
                        <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                      </Flex>
                      
                      <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                        <AlertDialog.Cancel>
                          <Button size={'4'} variant="ghost" 
                            onClick={() => {
                              setSelectedPaymentMethod(null);
                              setShowNewSaleForm(true);
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
                )} 

                {newSaleFormData && selectedPaymentMethod === 'Square' && (
                  <AlertDialog.Root open={showSquareDialog} onOpenChange={setShowSquareDialog}>
                    <AlertDialog.Trigger>
                      <Button style={{ display: 'none' }} />
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <AlertDialog.Title size={'8'} align={'center'} mb={'5'}>Tap to pay</AlertDialog.Title>
                      <VisuallyHidden>
                        <AlertDialog.Description size="2" mb="4">
                          Square payment
                        </AlertDialog.Description>
                      </VisuallyHidden>
                      
                      <Flex direction={'column'} width={'100%'} align={'center'} justify={'center'} gap={'9'}>
                        {newSaleFormData && finalPriceCalculated && (
                          <Flex direction={'column'} justify={'center'}>
                        <Text size={'9'} align={'center'}>${finalPrice}</Text>
                          <Flex direction={'row'} width={'300px'} justify={'between'}>
                            <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                            <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                          </Flex>
                          {rewardsDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Welcome discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                              )}
                            </Flex>
                          )}
                      
                          {newSaleFormData.tax > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Sales tax:</Text>
                              <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                            </Flex>
                          )}
                          </Flex>
                        )}
                      </Flex>

                      <Callout.Root color="red" style={{width: 'max-content', padding: '7px'}}>
                        <Callout.Text size={'3'}>
                          {squarePosError}
                        </Callout.Text>
                      </Callout.Root>
                      
                      <Flex direction={'column'} gap="7" mt="4" justify={'between'} align={'center'} pt={'4'}>
                        <AlertDialog.Action>
                          <Button size={'4'} 
                            style={{width: '250px'}}
                            onClick={() => {
                              handleSavePaymentAndUpdateRewards(newSaleFormData);
                              setShowZelleDialog(false);
                            }}>
                            Tap to pay
                          </Button>
                        </AlertDialog.Action>
                        <AlertDialog.Cancel>
                          <Button size={'4'} variant="ghost" 
                            onClick={() => {
                              handleSquarePosPayment(newSaleFormData);
                              setShowNewSaleForm(true);
                            }}>
                            Cancel
                          </Button>
                        </AlertDialog.Cancel>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                )} 
                
                {showNewSaleForm ? (
                  <NewSaleForm
                    onQrCodeGenerated={handleQrCodeGenerated}
                    onMessageUpdate={handleMessageUpdate}
                    userId={user.id}
                    merchantFromParent={merchant}
                    customers={currentRewardsCustomers}
                    paymentMethods={paymentMethods}
                    onNewSaleFormSubmit={(formData: SaleFormData) => {
                      setShowNewSaleForm(false);
                      setNewSaleFormData(formData);
                      handlePaymentMethodChange(formData.paymentMethod, formData);
                    }}
                    onStartNewSale={handleResetMessages}
                    onCustomerRefresh={fetchCheckedInCustomers}
                    formData={newSaleFormData}
                  />
                ) : null}

                <Flex direction={'column'} gap={'4'}>

                  {discountUpgradeMessage && (
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <RocketIcon height={'25'} width={'25'} />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {discountUpgradeMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}
              
                  {successMessage1 && (
                    <Callout.Root mx={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text size={'6'}>
                      {successMessage1}
                    </Callout.Text>
                  </Callout.Root>
                  )}

                  {successMessage2 && (
                    <Callout.Root mx={'4'}>
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