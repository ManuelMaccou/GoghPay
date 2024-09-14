'use client'

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Payments } from '@square/web-sdk';
import { Merchant, PaymentType, RewardsCustomer, SaleFormData, User } from '@/app/types/types';
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { logAdminError, serializeError } from '@/app/utils/logAdminError';
import { ApiError } from '@/app/utils/ApiError';
import { Button, Callout, Flex, Heading, Strong, Text } from '@radix-ui/themes';
import { InfoCircledIcon, RocketIcon } from '@radix-ui/react-icons';
import { BalanceProvider } from '@/app/contexts/BalanceContext';
import { Header } from '@/app/components/Header';
import { useUser } from '@/app/contexts/UserContext';
import Transaction from '@/app/models/Transaction';

export default function ManualCreditCardPayment() {
  const router = useRouter();
  const { appUser, setIsFetchingUser, setAppUser } = useUser();
  const { ready, authenticated, user, login } = usePrivy();
  const [currentUser, setCurrentUser] = useState<User>();

  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);

  const [formData, setFormData] = useState<SaleFormData | null>(null);

  const [rewardsDiscount, setRewardsDiscount] = useState<number | 0>(0);
  const [welcomeDiscount, setWelcomeDiscount] = useState<number | 0>(0);
  const [finalPriceCalculated, setFinalPriceCalculated] = useState<boolean>(false);
  const [finalPrice, setFinalPrice] = useState<string | null>(null);
  
  const [card, setCard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionStorageError, setSessionStorageError] = useState<boolean>(false);

  const [paymentProcessed, setPaymentProcessed] = useState<boolean>(false);
  const [transactionSaved, setTransactionSaved] = useState<boolean>(false);

  const [successMessage1, setSuccessMessage1] = useState<string | null>(null);
  const [successMessage2, setSuccessMessage2] = useState<string | null>(null);
  const [discountUpgradeMessage, setDiscountUpgradeMessage] = useState<string | null>(null);

  const [errorMessage1, setErrorMessage1] = useState<string | null>(null);
  const [errorMessage2, setErrorMessage2] = useState<string | null>(null);

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
  
  const applicationId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const locationId = formData?.sellerMerchant?.square?.location_id;
  const merchantId = formData?.sellerMerchant?._id;
  const privyId = formData?.sellerMerchant?.privyId;
  const customerId = formData?.customer?.userInfo.squareCustomerId;
  
  const cardContainerRef = useRef<HTMLDivElement | null>(null);

  let priceInCents: number;
  const priceNum = parseFloat(formData?.price || "0");
  if (formData?.tax) {
    const taxAmount = (formData.tax / 100) * priceNum;
    priceInCents = (priceNum + taxAmount) * 100;
  } else {
    priceInCents = priceNum * 100;
  }
  console.log('price in cents:', priceInCents);

  useEffect(() => {
    const storedData = sessionStorage.getItem('newSaleFormData');
    if (!storedData) {
      setSessionStorageError(true)
    }
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setFormData(parsedData);
    }
  }, []);

  useEffect(() => {
    if (paymentProcessed) {
      sessionStorage.removeItem('newSaleFormData');
    }
  }, [paymentProcessed]);

  useEffect(() => {

    if (!applicationId || !locationId) {
      setIsLoading(false);
      return;
    }

    const initializeSquare = async () => {
      if (window.Square && !card) {
        await setupSquare();
      } else if (!window.Square) {
        const script = document.createElement('script');
        script.src = process.env.NEXT_PUBLIC_WEB_SDK_DOMAIN!;
        script.onload = async () => {
          await setupSquare();
        };
        script.onerror = () => {
          setError('Failed to load Square.js');
          setIsLoading(false);
        };
        document.body.appendChild(script);
      }
    };

    const setupSquare = async () => {
      if (!window.Square) {
        setError('Square.js is not available after script load');
        return;
      }

      try {
        const payments = window.Square.payments(applicationId, locationId);
        const cardPayment = await payments.card({
          style: {
            input: {
              fontSize: '20px'
            }
          }

    
        });

        if (cardContainerRef.current) {
          await cardPayment.attach(cardContainerRef.current);
          setCard(cardPayment);
        } else {
          throw new Error('Card container element not found');
        }
      } catch (err) {
        setError('Failed to initialize card');
      } finally {
        setIsLoading(false);
      }
    };

    if (applicationId && locationId) {
      initializeSquare();
    }

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, [applicationId, locationId, card]);

  useEffect(() => {
    setRewardsDiscount(0);
    setWelcomeDiscount(0);
    setFinalPriceCalculated(false)
    setFinalPrice(null);

    if (!formData) return;
    if (!formData.price) return;

    const priceNum = parseFloat(formData.price)

    let rewardsDiscountAmount = 0;
    let welcomeDiscountAmount = 0;
    let priceAfterDiscount = priceNum;
    let finalPriceCalculation = priceNum;


    if (formData.sellerMerchant?.rewards?.welcome_reward && formData.customer?.purchaseCount === 1) {
      welcomeDiscountAmount = formData.sellerMerchant?.rewards?.welcome_reward
    }

    if (formData.customer && formData.customer.currentDiscount.amount) {
      rewardsDiscountAmount = formData.customer.currentDiscount.amount
    }

    const totalDiscountAmount = rewardsDiscountAmount + welcomeDiscountAmount

    if (formData.customer && formData.customer.currentDiscount.type === 'percent') {
      if (totalDiscountAmount > 100) {
        priceAfterDiscount = 0
      } else {
        priceAfterDiscount = priceNum - ((totalDiscountAmount/100) * priceNum)
      }

    } else if (formData.customer && formData.customer.currentDiscount.type === 'dollar') {
      priceAfterDiscount = priceNum - totalDiscountAmount
      if (priceAfterDiscount < 0) {
        priceAfterDiscount = 0
      }
    }
    
    if (formData.tax > 0) {
      finalPriceCalculation = priceAfterDiscount + ((formData.tax / 100) * priceAfterDiscount);
    } else {
      finalPriceCalculation = priceAfterDiscount
    }

    setRewardsDiscount(rewardsDiscountAmount);
    setWelcomeDiscount(welcomeDiscountAmount);
    setFinalPriceCalculated(true);
    setFinalPrice(finalPriceCalculation.toFixed(2));

  }, [formData, finalPrice, rewardsDiscount, welcomeDiscount])

  const handlePaymentMethodSubmission = async (event: React.FormEvent) => {
    setError(null);
    setErrorMessage1(null);
    setErrorMessage2(null);
    setSuccessMessage1(null);
    setSuccessMessage2(null);
    setDiscountUpgradeMessage(null);

    event.preventDefault();
    if (!formData || !card) {
      setErrorMessage1('There was an error initializing Square. Please go back and try again');
      return;
    }

    try {
      setIsLoading(true);
      const tokenResult = await card.tokenize();
      if (tokenResult.status === 'OK') {
        await saveTransaction();
        await createPayment(tokenResult.token);
      } else {
        throw new Error(`Tokenization failed with status: ${tokenResult.status}`);
      }
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred during payment';
      console.error('Payment failed:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  let transactionId: string | undefined;
  const saveTransaction = async () => {
    setTransactionSaved(false);
    const accessToken = await getAccessToken();
    try {
      const priceNum = parseFloat(formData?.price || '0');
      let calculatedSalesTax;
      if (formData && formData.tax) {
        calculatedSalesTax = parseFloat(((formData?.tax/100) * priceNum).toFixed(2));
      } else {
        calculatedSalesTax = 0
    }
     
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 

        },
        body: JSON.stringify({
          privyId: formData?.sellerMerchant?.privyId,
          merchantId: formData?.sellerMerchant?._id,
          buyerId: formData?.customer?.userInfo._id,
          buyerPrivyId: formData?.sellerMerchant?.privyId,
          productName: formData?.product,
          productPrice: formData?.price,
          discountType: formData?.customer?.currentDiscount.type,
          discountAmount: formData?.customer?.currentDiscount.amount,
          welcomeDiscount: welcomeDiscount,
          salesTax: calculatedSalesTax,
          paymentType: 'ManualEntry',
          status: 'PENDING'
        }),
      });

      const responseData = await response.json();
      const serializedError = await serializeError(responseData.error);

      if (!response.ok) {
        setErrorMessage1('There was an error saving the transaction. We have received the error and are looking into it.');
  
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );

        await logAdminError(
          formData?.sellerMerchant?._id,
          `Saving a manual entry credit card transaction. Price: $${formData?.price}. Tax: ${formData?.tax}%`,
          serializedError
        );
    
        console.error(apiError);
      } else {
        transactionId = responseData.transaction._id;
        setTransactionSaved(true);
        console.log('save cc transaction response:', responseData)
      }
    } catch (error) {
      setErrorMessage1('There was an error saving the transaction. We have received the error and are looking into it.');
      
      await logAdminError(
        formData?.sellerMerchant?._id,
        `Saving a manual entry credit card transaction. Price: $${formData?.price}. Tax: ${formData?.tax}%`,
        {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    
      console.error(error);
    }
  }

  const createPayment = async (token: string) => {
    setPaymentProcessed(false);
  
    const userFixableErrors = [
      'ADDRESS_VERIFICATION_FAILURE',
      'CARD_EXPIRED',
      'CARD_NOT_SUPPORTED',
      'CVV_FAILURE',
      'EXPIRATION_FAILURE',
      'GENERIC_DECLINE',
      'INVALID_CARD',
      'INVALID_CARD_DATA',
      'INVALID_EXPIRATION',
      'INVALID_POSTAL_CODE',
      'MANUALLY_ENTERED_PAYMENT_NOT_SUPPORTED',
      'PAYMENT_LIMIT_EXCEEDED',
      'TRANSACTION_LIMIT',
      'BAD_EXPIRATION',
      'CARD_DECLINED_VERIFICATION_REQUIRED',
    ];
  
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/square/payment/creditCard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId,
          merchantId,
          locationId,
          sourceId: token,
          customerId,
          priceInCents,
          transactionId,
        }),
      });
  
      const responseData = await response.json();
      if (!response.ok) {
        let parsedErrorDetails;
  
        // Check if the error details are stringified and parse them
        if (typeof responseData.details === 'string') {
          try {
            parsedErrorDetails = JSON.parse(responseData.details);
          } catch (e) {
            console.error('Error parsing error details:', e);
            setErrorMessage2('There was an error processing the transaction. We have received the error and are looking into it.');
            return;
          }
        } else {
          parsedErrorDetails = responseData.details;
        }
  
        // Check if there are specific errors we should show to the user
        if (parsedErrorDetails?.errors && Array.isArray(parsedErrorDetails.errors)) {
          const userFacingError = parsedErrorDetails.errors.find((error: any) =>
            userFixableErrors.includes(error.code)
          );
  
          // If there's a user-fixable error, show the detail field
          if (userFacingError) {
            setErrorMessage2(userFacingError.detail);
          } else {
            // General error if the error code isn't in the fixable list
            setErrorMessage2('There was an error processing the transaction. We have received the error and are looking into it.');
          }
        } else {
          // General error if no specific errors were found
          setErrorMessage2('There was an error processing the transaction. We have received the error and are looking into it.');
        }
  
        // Log the error for admin purposes
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );

        const serializedError = await serializeError(responseData.error);
  
        await logAdminError(
          formData?.sellerMerchant?._id,
          `Processing a manual entry credit card transaction. Price: $${formData?.price}. Tax: ${formData?.tax}%`,
          serializedError
        );  

        console.error(apiError);
      } else {
        console.log(responseData)
        
        setPaymentProcessed(true);
        setSuccessMessage2('Payment processed.');

        try {
          const updateSuccess = await updateTransactionDetails(responseData.id);
          if (!updateSuccess) {
            console.error('Failed to update transaction details.');
          }
        } catch (updateError) {
          console.error('Error updating transaction details:', updateError);
        }

        if (formData && formData.customer) {
          try {
            const updatedRewards = await updateRewards(formData);
            if (!updatedRewards) {
              console.error('Failed to updating rewards after transaction.');
            }
          } catch (updateError) {
            console.error('Failed to updating rewards after transaction:', updateError);
          }
        }
        
        return responseData;

      }
    } catch (error) {
      setErrorMessage2('There was an error processing the transaction. We have received the error and are looking into it 111.');
      
      await logAdminError(
        formData?.sellerMerchant?._id,
        `Processing a manual entry credit card transaction. Price: $${formData?.price}. Tax: ${formData?.tax}%`,
        {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

  
      console.error(error);
    }
  };  

  const updateTransactionDetails = async (squarePaymentId: string) => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/transaction/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: user?.id,
          transactionId,
          status: 'COMPLETED',
          squarePaymentId,
          
        }),
      });
      const responseData = await response.json();
      const serializedError = await serializeError(responseData.error);
      console.log('serializedError:', serializedError)
  
      if (!response.ok) {
        const apiError = new ApiError(
          `API Error11: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );
    
        await logAdminError(
          formData?.sellerMerchant?._id,
          `Updating transaction after a successful Square payment with paymenet ID: ${squarePaymentId} for transaction ID: ${transactionId}`,
          serializedError
        );
    
        console.error(apiError);
        return false;
      }

      console.log('Transaction updated successfully:', responseData);
      return true;
      
    } catch (error) {
      await logAdminError(
        formData?.sellerMerchant?._id,
        `Updating transaction after a successful Square payment with paymenet ID: ${squarePaymentId} for transaction ID: ${transactionId}`,
        {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    
      console.error(error);
      return false;
    }
  }

  const updateRewards = async (formData: SaleFormData | null) => {
    const accessToken = await getAccessToken();
    if (!formData || !formData.customer) {
      await logAdminError('Unknown seller', 'Missing form data to update rewards after a manual credit card transaction.', { error: 'No formData provided' });
      console.error('missing form data to update rewards')
      return false;
    }
    try {
      const response = await fetch(`/api/rewards/userRewards/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: currentUser?.privyId,
          purchaseData: formData,
          finalPrice,
        }),
      });

      const responseData = await response.json();
      const serializedError = await serializeError(responseData.error);

      if (!response.ok) {
        
        setErrorMessage1('There was an error updating the customer rewards. We have received the error and are looking into it.');
  
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );
    
        await logAdminError(formData.sellerMerchant?._id,
          `Updating user rewards during ${formData.paymentMethod} transaction. User: ${formData.customer.userInfo._id}. Amount: ${formData.price}.`,
          serializedError
        );

        console.error(apiError);
        return false;
      } else {
        setSuccessMessage1('Customer rewards have been saved.');
        console.log('Rewards updated successfully:', responseData);

        if (responseData.discountUpgradeMessage) {
          setDiscountUpgradeMessage(responseData.discountUpgradeMessage)
        }

        return true;
      }
    } catch (error) {
      // Catch any other errors and log them with their full details
      await logAdminError(formData.sellerMerchant?._id, `Updating user rewards during ${formData.paymentMethod} transaction. User: ${formData.customer.userInfo._id}. Amount: ${formData.price}.`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    
      console.error(error);
      return false;
    }
  }
  

  if (sessionStorageError || !formData) {
    return (
      <Callout.Root color='red' mx={'4'}>
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text size={'6'}>
          There was an issue loading sale information. Please go back and try again.
        </Callout.Text>
      </Callout.Root>
    );
  }
  
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
        <Flex direction={'column'}>
          <Heading size={'8'} style={{color: "white"}}>New Sale</Heading>
          <Text size={'5'} style={{color: "white"}}>Manual credit card entry</Text>
        </Flex>
        
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
        align={'center'}
        height={'100%'}
        style={{
          backgroundColor: 'white',
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)'
        }}
      >
        {formData && finalPriceCalculated && (
          <Flex direction={'column'} justify={'center'} mb={'5'}>
            <Text size={'9'} align={'center'}>${finalPrice}</Text>
            <Flex direction={'row'} width={'300px'} justify={'between'}>
              <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
              <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(formData.price).toFixed(2)}</Strong></Text>
            </Flex>
            {rewardsDiscount > 0 && (
              <Flex direction={'row'} width={'300px'} justify={'between'}>
                <Text size={'5'} align={'left'}>Rewards discount:</Text>
                {formData.customer?.currentDiscount.type === 'percent' ? (
                  <Text size={'5'} align={'left'}><Strong>{formData.customer.currentDiscount.amount}%</Strong></Text>
                ) : formData.customer?.currentDiscount.type === 'dollar' && (
                  <Text size={'5'} align={'left'}><Strong>${formData.customer.currentDiscount.amount}</Strong></Text>
                )}
              </Flex>
            )}

            {welcomeDiscount > 0 && (
              <Flex direction={'row'} width={'300px'} justify={'between'}>
                <Text size={'5'} align={'left'}>Welcome discount:</Text>
                {formData.customer?.currentDiscount.type === 'percent' ? (
                  <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                ) : formData.customer?.currentDiscount.type === 'dollar' && (
                  <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                )}
              </Flex>
            )}
        
            {formData.tax > 0 && (
              <Flex direction={'row'} width={'300px'} justify={'between'}>
                <Text size={'5'} align={'left'}>Sales tax:</Text>
                <Text size={'5'} align={'left'}><Strong>{formData.tax}%</Strong></Text>
              </Flex>
            )}
          </Flex>
        )}
          
        <Flex direction={'column'} width={'90%'}>
          <form id="payment-form" onSubmit={handlePaymentMethodSubmission}>
            <style>
              {`
                #card-container .sq-card-wrapper {
                  width: 100% !important;
                  max-width: none !important;
                }
              `}
            </style>
            <Flex width={'100%'} direction={'column'} id="card-container" ref={cardContainerRef} align={'center'}></Flex>

            {error && <p className="error">{error}</p>}
            <Flex mb={'5'} id="payment-status-container"></Flex>
            <Flex direction={'column'} gap={'8'} justify={'center'}>
              <Button size={'4'} id="card-button" type="submit" disabled={!formData || isLoading || paymentProcessed} style={{width: '100%'}}>
              {isLoading 
                ? 'Processing...' 
                : `Charge $${finalPrice}`
              }
              </Button>
              {!paymentProcessed ? (
                <Button
                  variant='ghost'
                  size={'4'}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/sell?status=cancel'); 
                  }}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                size={'4'}
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/sell');
                }}
              >
                New sale
              </Button>
              )}
              
            </Flex>
            


            <Flex direction={'column'} gap={'4'} mt={'5'}>

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


              {errorMessage1 && (
                <Callout.Root color='red' mx={'4'}>
                  <Callout.Icon>
                    <InfoCircledIcon />
                  </Callout.Icon>
                  <Callout.Text size={'6'}>
                    {errorMessage1}
                  </Callout.Text>
                </Callout.Root>
              )}

              {errorMessage2 && (
                <Callout.Root color='red' mx={'4'}>
                  <Callout.Icon>
                    <InfoCircledIcon />
                  </Callout.Icon>
                  <Callout.Text size={'6'} wrap={'wrap'} style={{ wordBreak: 'break-word' }}>
                    {errorMessage2}
                  </Callout.Text>
                </Callout.Root>
              )}
            </Flex>
            
          </form>
        </Flex>
          
      </Flex>
    </Flex>
  );
};