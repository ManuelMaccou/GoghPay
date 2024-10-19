"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { usePrivy, useLogin, useWallets, getEmbeddedConnectedWallet, useLinkAccount, User as PrivyUser } from '@privy-io/react-auth';
import axios from 'axios';
import {Avatar, Button, Flex, Text, Spinner, Card, TextField, Callout } from "@radix-ui/themes";
import styles from '@/app/components/styles.module.css';
import { useUser } from '@/app/contexts/UserContext';
import { useMerchant } from '@/app/contexts/MerchantContext';
import { User } from '@/app/types/types';
import * as Sentry from '@sentry/nextjs';
import { InfoCircledIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function VintageLand() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [linkPhoneError, setLinkPhoneError] = useState<string | null>(null);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [linkGmailError, setLinkGmailError] = useState<string | null>(null);
  const { appUser, setAppUser } = useUser();
  const { merchant } = useMerchant();

  const { ready, getAccessToken, authenticated, logout, user, unlinkEmail, unlinkGoogle, unlinkPhone } = usePrivy();
  const router = useRouter();

  type LoginMethod = "google" | "sms" | "email" | "farcaster" | "discord" | "twitter" | "github" | "spotify" | "instagram" | "tiktok" | "linkedin" | "apple" | "telegram" | "wallet";

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {

      if (isNewUser) {
        setIsNewUser(true);

        try {
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            phone: user.phone?.number,
            creationType: 'privy',
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          setAppUser(response.data.user);
        } catch (error: unknown) {
          Sentry.captureException(error);
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
        }
      }
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  const handleLogin = () => {
    login({
      loginMethods: ['email', 'google', 'sms'],
      disableSignup: true 
    });
  };

  const handleSignup = () => {
    login({ loginMethods: ['sms']
     });
  };

  const { linkEmail, linkGoogle, linkPhone } = useLinkAccount({
    onSuccess: (user, linkMethod) => handleLinkSuccess(user, linkMethod),
    onError: (error, details) => {
      console.error(error, details);
      Sentry.captureException(error, { extra: details });
  
      // Handle errors based on `linkMethod.type`
      if (details?.linkMethod) {
        if (error !== 'exited_link_flow') {
          setLinkError(details.linkMethod);
        }
      } else { 
        console.error('Unknown error type during linking:', details);
      }
    }
  });

  const handleLinkSuccess = async (user: any, linkMethod: string) => {
    setIsRedirecting(true);
    try {
      setLinkEmailError(null);
      setLinkGmailError(null);
      setLinkPhoneError(null);

      const accessToken = await getAccessToken();
      const requestBody: { email?: string; phone?: string; name?: string; privyId: string }  = {
        privyId: user.id,
      };

      switch (linkMethod) {
        case 'email':
          requestBody.email = user.email?.address;
          break;
        case 'sms':
          requestBody.phone = user.phone?.number;
          break;
        case 'google':
          requestBody.email = user.google?.email;
          requestBody.name = user.google?.name;
          break;
        default:
          console.error('Unknown link method:', linkMethod);
          return;
      }

      console.log('request body:', requestBody);

      const response = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.user);
        setIsRedirecting(false);
        router.push('/myrewards')
      } else {
        await handleUnlinkAccount(linkMethod, user)
        setIsRedirecting(false);
        const responseErrorMessage = await response.text();
        Sentry.captureException(
          new Error(`Linking ${linkMethod} to existing user - ${response.statusText || 'Unknown Error'}, ${response.status}`),
          {
            extra: {
              privyId: appUser?.privyId ?? 'unknown privyId',
            },
          }
        );

        // Set specific error messages
        setLinkError(linkMethod);
        console.error(`Failed to link ${linkMethod}: ${responseErrorMessage}`);
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Error linking ${linkMethod}:`, err);
      setIsRedirecting(false);
      // Set specific error messages
      setLinkError(linkMethod);
    }
  };

  const setLinkError = (accountType: string) => {
    switch (accountType) {
      case 'email':
        setLinkEmailError('There was an error linking your email address. Please try again.');
        break;
      case 'google':
        setLinkGmailError('There was an error linking your Google address. Please try again.');
        break;
        case 'sms':
        setLinkPhoneError('There was an error linking your phone number. Please try again.');
        break;
      default:
        console.error('Unknown linked account type:', accountType);
    }
  };

  const handleUnlinkAccount = async (linkMethod: LoginMethod, user: PrivyUser) => {
    if (linkMethod === 'google') {
      if (user.google?.email) unlinkGoogle(user.google.subject)
    }
    if (linkMethod === 'email') {
      if (user.email?.address) unlinkEmail(user.email.address)
    }
    if (linkMethod === 'sms') {
      if (user.phone?.number) unlinkPhone(user.phone.number)
    }
  }

  useEffect(() => {
    if (!user) return;
    if (!appUser) return;

    const updateUserWithSmartWalletAddress = async (smartWallet: any) => {
      try {
        const accessToken = await getAccessToken();
        const response = await fetch('/api/user/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            smartAccountAddress: smartWallet?.address,
            privyId: user.id,
          }),
        });
  
        if (response.ok) {
          const data = await response.json();
          setAppUser(data.user);
        } else {
          const responseErrorMessage = await response.text();
          Sentry.captureException(new Error(`Updating user with smart wallet address - ${response.statusText} || 'Unknown Error'}, ${response.status}`), {
            extra: {
              privyId: user?.id ?? 'unknown privyId'
            }
          });
  
          console.error(`Failed to update user with smart wallet address: ${responseErrorMessage}`);
          Sentry.captureException(new Error (`Failed to update user with smart wallet address: ${responseErrorMessage}`));
        }
  
      } catch (err) {
        Sentry.captureException(err);
        if (isError(err)) {
          console.error(`Failed to update user with smart wallet address: ${err.message}`);
        } else {
          console.error('Failed to update user with smart wallet address');
        }
      }

    }
    const smartWallet = user.linkedAccounts.find((account) => account.type === 'smart_wallet');
    if (!appUser?.smartAccountAddress && smartWallet) {
      updateUserWithSmartWalletAddress(smartWallet)
    }
  }, [appUser, setAppUser, user, getAccessToken])

  useEffect(() => {
    if (!ready) return;
    if (isNewUser) return;
    
    const fetchUser = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setAppUser(userData.user);
      } catch (error: unknown) {
        Sentry.captureException(error);
        if (isError(error)) {
          console.error('Error fetching user:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      } finally {
        setIsLoading(false);
      }
    };

    if (ready && authenticated && user) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [authenticated, ready, user, isNewUser, setAppUser]);

  useEffect(() => {
    if (appUser && appUser.merchant) {
      if (merchant && merchant.status === 'onboarding') {
        setIsRedirecting(true);
        if (merchant.onboardingStep) {
          router.replace(`/onboard/step${merchant.onboardingStep}`);
        } else {
          router.replace('/onboard');
        }
      }
    }
  }, [appUser, router, merchant]);

  useEffect(() => {
    if (!ready || !authenticated || !appUser || !user) return;

    const noEmail = !user.email?.address && !user.google?.email;
    const noPhone = !user.phone?.number;

    if (noEmail || noPhone) {
      setShowForm(true);
    } else {
      router.push('myrewards')
    }
  }, [ready, authenticated, appUser, user, router])

  return (
    <Flex direction={'column'} className={styles.section} position={'relative'} minHeight={'100vh'} width={'100%'}>
      <Image
        src="/bg_m.jpg"
        alt="background image"
        priority
        className={styles.fullBackgroundImage}
        fill
        sizes="100vw"
        style={{ objectFit: "cover" }} 
      />
   
      <Flex direction={'column'} justify={'center'} align={'center'} width={'100%'}>
        {isLoading || (!ready && (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Spinner style={{color: 'white'}} />
          </Flex>
        ))}

        {isRedirecting && (
          <>
            <Text size={'4'} weight={'bold'} style={{color: 'white', paddingBottom: '10px'}}>Redirecting...</Text>
          </>
        )}

        {!ready && (
          <Spinner style={{color: 'white'}} />
        )}

        {ready && !authenticated && (
          <Flex direction={'column'} justify={'end'} align={'end'} gap={'7'} height={'100vh'} style={{marginBottom: '250px'}}>
            <Button size={'4'} style={{width: "250px", backgroundColor: 'white'}}
              onClick={handleLogin}
            >
              <Text size={'5'} style={{color: 'black'}}>
                Log in
              </Text>
            </Button>
      
            <Button size={'4'} style={{ width: "250px", backgroundColor: 'white' }} 
              onClick={handleSignup}
            >
              <Text size={'5'} style={{color: 'black'}}>
                Create an account
              </Text>
            </Button>
          </Flex>
        )}
        {ready && authenticated && appUser && !isRedirecting && (
          showForm && (
            <>
              <Flex mb={'7'} direction={'column'} justify={'center'} align={'center'} style={{backgroundColor: 'white', borderRadius: '10px', padding: '25px', width: '95%'}}>
                <Text mb={'5'} weight={'bold'} size="7">
                  Welcome!
                </Text>
                {(!user?.email?.address && !user?.google?.email) && (
                  <>
                    <Text mt={'5'} mb={'6'} align={'center'} size={'6'}>Add your email for more rewards.</Text>
                    <Flex justify={'center'} align={'center'} direction={'column'} gap={'4'} my={'6'} style={{borderStyle: 'solid', borderRadius: '5px', borderColor: '#e0e0e0', borderWidth: '1px', padding: '50px'}}>
                      <Text size={'5'} mx={'3'} align={'center'} style={{color: 'black', backgroundColor: 'white', marginTop: '-65px', paddingRight: '10px', paddingLeft: '10px'}}>Fastest</Text>
                      <Button disabled={!appUser} variant='outline' style={{ width: "250px", paddingTop: '40px', paddingBottom: '40px' }}
                        onClick={linkGoogle}
                      >
                        <Flex direction={'row'} align={'center'} gap={'3'} my={'2'}>
                          <Avatar
                            src="/logos/googleicon.png"
                            fallback="G"
                            style={{objectFit: 'contain'}}
                          />
                          <Text size={'3'}>Continue with Google</Text>
                        </Flex>
                      </Button>
                    </Flex>
                    <Text mb={'8'} size={'4'}>----or----</Text>
                    
                    <Button disabled={!appUser} mb={'3'} style={{ width: "250px", fontSize: '16px' }} 
                      onClick={linkEmail}
                    >
                      Manually enter email
                    </Button>
      
                    {linkEmailError && (
                      <Callout.Root>
                        <Callout.Icon>
                          <InfoCircledIcon />
                        </Callout.Icon>
                        <Callout.Text>
                          {linkEmailError}
                        </Callout.Text>
                      </Callout.Root>
                    )}
                    {linkGmailError && (
                      <Callout.Root>
                        <Callout.Icon>
                          <InfoCircledIcon/>
                        </Callout.Icon>
                        <Callout.Text>
                          {linkGmailError}
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </>
                )}
                {!user?.phone?.number && (
                  <>
                    <Text align={'center'} size={'5'}>Add your phone number for more rewards.</Text>
                    <Button my={'5'} size={'3'} style={{ width: "250px"}} onClick={linkPhone}>
                      Add phone
                    </Button>
                    {linkPhoneError && (
                      <Callout.Root>
                        <Callout.Icon>
                          <InfoCircledIcon/>
                        </Callout.Icon>
                        <Callout.Text>
                          {linkPhoneError}
                        </Callout.Text>
                      </Callout.Root>
                    )}
                  </>
                )}
              </Flex>
            </>
          )
        )}
      </Flex>
    </Flex>
  );
};