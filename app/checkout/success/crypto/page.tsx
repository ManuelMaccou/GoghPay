'use client';






// THIS SHOULD BE REMOVED OR MODIFIED FOR PAYING IN CRYPTO AT RETAIL STORES

import { PrivyClient } from '@privy-io/server-auth';
import { Merchant, User } from '@/app/types/types';
import { Button, Callout, Card, Flex, Heading, Spinner, Strong, Text } from '@radix-ui/themes';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ConnectedWallet, getAccessToken, usePrivy } from '@privy-io/react-auth';
import { CheckIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';

interface PurchaseParams {
  merchantId: string | null;
  product: string | null;
  price: number;
  walletAddress?: string | null;
}

function SuccessContent() {
  const [merchant, setMerchant] = useState<Merchant>();
  const [checkoutUser, setCheckoutUser] = useState<User>();
  const [stripeUserAdded, setStripeUserAdded] = useState<boolean>(false);
  const [isSettingCheckoutUser, setIsSettingCheckoutUser] = useState<boolean>(false);
  const [subscribedSuccess, setSubscribedSuccess] = useState<boolean>(false);
  const [isCheckingSubscriptionStatus, setIsCheckingSubscriptionStatus] = useState<boolean>(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('undefined');
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { authenticated, user, ready, login } = usePrivy();
  const privyId = user?.id;

  const isError = (error: any): error is Error => error instanceof Error && typeof error.message === "string";

  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const productName = searchParams.get('productName');
  const price = searchParams.get('price');
  const priceNum = parseFloat(price || "0");
  const stripeCheckoutId = searchParams.get('session_id');
  const checkoutMethod = searchParams.get('checkout_method');

  const chainMapping: { [key: string]: Chain } = {
    'baseSepolia': baseSepolia,
    'base': base,
  };

  // Utility function to get Chain object from environment variable.
  const getChainFromEnv = (envVar: string | undefined): Chain => {
    if (!envVar) {
      throw new Error('Environment variable for chain is not defined');
    }
    
    const chain = chainMapping[envVar];
    
    if (!chain) {
      throw new Error(`No chain found for environment variable: ${envVar}`);
    }

    return chain;
  };

  useEffect(() => {
    if (!ready) return;

    async function fetchUserFromWallet() {
      try {
        const response = await fetch(`/api/user/me/${privyId}`);
        if (!response.ok) throw new Error('Failed to fetch user');

        const userData = await response.json();
        setCheckoutUser(userData.user);
      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to fetch user details');
      }
    };

    async function fetchUserFromStripe() {
      try {
        const sessionResponse = await fetch('/api/stripe/checkout/retrieve-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: stripeCheckoutId })
        });

        if (!sessionResponse.ok) throw new Error(`Error retrieving checkout session: ${sessionResponse.statusText}`);

        const sessionData = await sessionResponse.json();
        if (!sessionData.buyerDetails) throw new Error('No session details available');

        await handleUserSearch(sessionData.buyerDetails.email);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error fetching checkout session');
      }
    };

    async function handleUserSearch(email: string) {
      console.log('running handleUserSearch');
      const accessToken = await getAccessToken();
      const userResponse = await fetch(`/api/user/by-email?address=${email}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      console.log('user response:', userResponse);

      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          console.log('creating a new user with email:', email);
          await importPrivyUser(email);
        } else {
          throw new Error(`Failed to find user: ${userResponse.statusText}`);
        }
      } else {
        const existingUser = await userResponse.json();
        console.log("existing user:", existingUser);
        setCheckoutUser(existingUser);
      }
    };

    async function createUser(email: string, privyId: string, wallet: ConnectedWallet, walletAddress: string) {
      console.log('adding a user with privy ID and creating smart account');

      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privyId,
          email,
          wallet,
          walletAddress,
          creationType: 'stripe'
        }),
      });

      if (!response.ok) throw new Error(`Error creating user: ${response.statusText}`);

      const newStripeCheckoutUser = await response.json();
      console.log('newstripeuser:', newStripeCheckoutUser);
      setCheckoutUser(newStripeCheckoutUser.user);
    };

    async function importPrivyUser (email: string) {
      console.log('importing a privy user with email:', email);
      const accessToken = await getAccessToken();
      const userData = {
        email: email,
      };
  
      try {
        const response = await fetch('/api/user/import-privy-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify(userData),
        });
    
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const data = await response.json();
        console.log('data from importing user:', data.user);

        const privyId = data.user.id;
        const wallet = data.user.wallet;
        const walletAddress = data.user.wallet.address;
        await createUser(email, privyId, wallet, walletAddress);
      } catch (error) {
        console.error('Error importing user:', error);
      }
    }

    async function fetchUserDetails() {
      if (stripeCheckoutId) {
        if (ready && authenticated) {
          await fetchUserFromWallet();
        } else {
          await fetchUserFromStripe();
        }
      } else {
        await fetchUserFromWallet();
      }
    }

    fetchUserDetails();
  }, [checkoutMethod, privyId, ready, stripeCheckoutId, authenticated]);

  useEffect(() => {
    if (!checkoutUser || !merchantId || !ready) return;

    async function checkSubscriptionStatus() {
      try {
        const response = await fetch(`/api/stripe/subscription/status?userId=${checkoutUser?._id}&merchantId=${merchantId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();

        if (response.ok) {
          setSubscriptionStatus(data.result);
        } else {
          throw new Error(data.error || 'Error checking subscription status');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error fetching checkout session');
      } finally {
        setIsCheckingSubscriptionStatus(false);
      }
    }

    if (checkoutUser) {
      console.log("checkout user:", checkoutUser);
      checkSubscriptionStatus();
    }
  }, [checkoutUser, merchantId, ready]);

  useEffect(() => {
    if (!checkoutUser || !merchantId || !ready) return;
    if (checkoutMethod === 'wallet') return;

    const transactionData = {
      merchantId: merchantId,
      buyerId: checkoutUser?._id,
      buyerPrivyId: checkoutUser?.privyId,
      productName: productName,
      productPrice: price,
      paymentType: 'mobile pay'
    }

    let transactionSaved = false; 

    async function saveTransaction() {
      if (transactionSaved) return;
      transactionSaved = true;
      
      const accessToken = await getAccessToken();
      try {
        const response = await fetch('/api/transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
  
          },
          body: JSON.stringify(transactionData),
        });
    
        if (!response.ok) {
          throw new Error('Failed to save transaction');
        }
        
        
        const data = await response.json();
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }

    if (checkoutUser && !transactionSaved) {
      console.log("checkout user:", checkoutUser);
      console.log('transaction saved?', transactionSaved);
      saveTransaction();
    }
  }, [checkoutUser, merchantId, ready, checkoutMethod, price, productName]);

  const handleNewSubscription = async (subscriberStatus: String) => {
    console.log('checkoutuser:', checkoutUser);
    console.log('merchantId:', merchantId);
    if (!checkoutUser || !merchantId) {
      return;
    }
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutUser, merchantId, subscriberStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add new subscriber: ${response.statusText}`);
      }

      const data = await response.json();
      setSubscribedSuccess(true);
      console.log('Subscriber added:', data);
    } catch (err) {
      if (isError(err)) {
        setError(`Error adding subscriber: ${err.message}`);
      } else {
        setError('Error adding subscriber');
      }
    }
  }

  return (
    <Flex
      direction="column"
      position="relative"
      minHeight="100vh"
      width="100%"
      style={{
        background: "linear-gradient(to bottom, rgba(161,116,252,1) 0%,rgba(220,132,244,1) 100%)",
      }}
    >
      <Flex direction="column" height={"40vh"} justify="center" align="center" width="100%" gap={"4"}>
        <Heading
          style={{
            color: "white",
          }}
          size={"8"}
        >
          Purchase complete
        </Heading>
        <Text
          style={{
            color: "white",
          }}
          weight={"bold"}
          size={"9"}
        >
          ${priceNum.toFixed(2)}
        </Text>
      </Flex>
      <Flex
        flexGrow={"1"}
        py={"7"}
        direction={"column"}
        justify={"between"}
        align={"center"}
        style={{
          backgroundColor: "white",
          borderRadius: "20px 20px 0px 0px",
          boxShadow: "var(--shadow-6)",
        }}
      >
        <Flex direction={"column"} gap={"7"} mt={"3"} px={"5"} align={"center"}>
          <Heading
            style={{
              color: "black",
            }}
            size={"8"}
          >
            Thank you!
          </Heading>
          {isCheckingSubscriptionStatus ? (
            <Spinner />
          ) : subscriptionStatus !== 'undefined' ? ( // For now, keep this wording the same as an active, denied, and unsubscribed status. Later, add special text for active subscribers
            <>
              <Text size={"5"}>
                We hope you enjoy your purchase. And thank you for being a loyal member of our community!
              </Text>
              <Button
                variant="ghost"
                size={"4"}
                style={{
                  width: "250px",
                }}
                onClick={() => router.push("/")}
              >
                Return home
              </Button>
            </>
          ) : (
            <>
              <Text size={"5"}>
                We hope you enjoy your purchase. We may offer exclusive deals to our supporters. {" "}
                <Strong>That&apos;s you!</Strong> We would love to share them with you.
              </Text>
              <Text size={"5"} weight={"bold"}>
                May we stay in touch?
              </Text>
              <Flex direction={"column"} gap={"7"}>
                {!subscribedSuccess ? (
                  <>
                    <Button
                      size={"4"}
                      loading={isSettingCheckoutUser}
                      style={{
                        fontSize: "26px",
                        width: "250px",
                      }}
                      onClick={() => handleNewSubscription('active')}
                    >
                      Yes!
                    </Button>
                    <Button
                      variant="ghost"
                      size={"4"}
                      style={{
                        width: "250px",
                      }}
                      onClick={() => handleNewSubscription('denied')}
                    >
                      No thanks
                    </Button>
                  </>
                ) : (
                  <Flex direction={'column'} align={'center'} justify={"center"} gap={'6'}>
                    <Callout.Root variant="soft" color="green">
                      <Callout.Icon>
                        <CheckIcon />
                      </Callout.Icon>
                      <Callout.Text align={"center"}>Got it!</Callout.Text>
                    </Callout.Root>
                    <Button
                      variant="ghost"
                      size={"4"}
                      style={{
                        width: "250px",
                      }}
                      onClick={() => router.push("/")}
                    >
                      Return home
                    </Button>
                  </Flex>
                )}
              </Flex>
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}

export default function Success() {
  return (
    <Suspense fallback={<Spinner />}>
      <SuccessContent />
    </Suspense>
  );
}