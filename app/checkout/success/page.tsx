'use client'

import { Merchant, User } from '@/app/types/types';
import { Button, Callout, Card, Flex, Heading, Strong, Text } from '@radix-ui/themes';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken, usePrivy } from '@privy-io/react-auth';
import { CheckIcon } from '@radix-ui/react-icons';
import { stripe } from '@/app/lib/stripe';

export default function Success() {
  const [merchant, setMerchant] = useState<Merchant>();
  const [checkoutUser, setCheckoutUser] = useState<User>();
  const [isSettingCheckoutUser, setIsSettingCheckoutUser] = useState<boolean>(true);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const price = searchParams.get('price');
  const stripeCheckoutId = searchParams.get('session_id')


  function isError(error: any): error is Error {
    return error instanceof Error && typeof error.message === "string";
  }

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        const response = await fetch(`/api/merchant/${merchantId}`);
        if (!response.ok) {
          throw new Error(`Error fetching merchant: ${response.statusText}`);
        }
        const data = await response.json();
        setMerchant(data);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      }
    };
    fetchMerchant();
  }, [merchantId]);

  // Need to get user objects to save a new subscriber and possibly user for stripe payers
  useEffect(() => {
    setIsSettingCheckoutUser(true);
    const fetchUserDetails = async () => {
      if (stripeCheckoutId !== null) {
        try {
          const sessionResponse = await fetch('/api/stripe/checkout/retrieve-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: stripeCheckoutId })
          });
          if (!sessionResponse.ok) {
            throw new Error(`Error retrieving checkout session: ${sessionResponse.statusText}`);
          }

          const sessionData = await sessionResponse.json();
          if (!sessionData.buyerDetails) {
            throw new Error('No session details available');
          }

          // Search for user with matching email address
          const accessToken = await getAccessToken();
          const userResponse = await fetch(`/api/user/by-email?address=${sessionData.buyerDetails.email}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!userResponse.ok) {
            if (userResponse.status === 404) {
              const response = await fetch('/api/user', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ 
                  email: sessionData.buyerDetails.email,
                }),
              });
              if (!response.ok) {
                throw new Error(`Error creating user: ${response.statusText}`);
              }
              
              const newStripeCheckoutUser = await response.json();
              console.log("added new user:", newStripeCheckoutUser )

              setCheckoutUser(newStripeCheckoutUser);
            } else {
              throw new Error('Error fetching user data');
            }
          } else {
            const existingUser = await userResponse.json();
            console.log("user exists:", existingUser )
            setCheckoutUser(existingUser);
          }
        } catch (error) {
          setError(error instanceof Error ? `Error while fetching checkout session and getting user info ${error.message}` : 'Unknown error fetching checkout session');
        } finally {
          setIsSettingCheckoutUser(false);
        }
      } else {
        setIsSettingCheckoutUser(false);
      }
    };

    fetchUserDetails();
  }, [stripeCheckoutId]);

  const handleNewSubscription = async () => {
    if (!checkoutUser || !merchantId) {
      return;
    }
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ checkoutUser, merchantId}),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add new subscriber: ${response.statusText}`);
      }
  
      const data = await response.json();
      setIsSubscribed(true);
      console.log('Subscriber added:', data);
    } catch (err) {
      if (isError(err)) {
        setError(`Error adding subsriber: ${err.message}`);
      } else {
        setError('Error adding subscriber');
      }
    }
  }

  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
          background: 'linear-gradient(to bottom, rgba(161,116,252,1) 0%,rgba(220,132,244,1) 100%)'
      }}>
      <Flex direction='column' height={'40vh'} justify='center' align='center' width='100%' gap={'4'}>
        <Heading style={{
        color: 'white'
        }}
        size={'8'}>
          Purchase complete
        </Heading>
        <Text style={{
          color: 'white'
          }}
          weight={'bold'}
          size={'9'}>
          ${price}
        </Text>
      </Flex>
      <Flex flexGrow={'1'} py={'7'} direction={'column'} justify={'between'} align={'center'} style={{
          backgroundColor: "white",
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)' 
        }}>
        <Flex direction={'column'} gap={'7'} mt={'3'} px={'5'} align={'center'}>
        <Heading style={{
          color: 'black'
          }}
          size={'8'}>
          Thank you!
        </Heading>
        <Text size={'5'}>
          We hope you enjoy your purchase. We may offer exclusive deals to our supporters. 
          <Strong>That&apos;s you!</Strong> We would love to share them with you.
        </Text>
        <Text size={'5'} weight={'bold'}>May we stay in touch?</Text>
        </Flex>
        <Flex direction={'column'} gap={'7'}>
          {!isSubscribed ? (
            <Button size={'4'} loading={isSettingCheckoutUser} style={{
            fontSize: '26px',
            width: '250px'
          }}
          onClick={() => handleNewSubscription()}>
            Yes!
          </Button>
          ) : (
            <Callout.Root variant="soft" color='green'>
              <Callout.Icon>
                <CheckIcon />
              </Callout.Icon>
              <Callout.Text align={'center'}>
                Subscribed!
              </Callout.Text>
            </Callout.Root>
          )}
          
          <Button variant='ghost' size={'4'} style={{
            width: '250px'
          }}>
            No thanks
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}