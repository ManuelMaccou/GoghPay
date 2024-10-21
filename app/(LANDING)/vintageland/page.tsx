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
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showNameField, setShowNameField] = useState<boolean>(true);
  const [userName, setUserName] = useState<string | undefined>(undefined);
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

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const sanitizedInput = input.replace(/[^a-zA-Z\s]/g, '');

    if (sanitizedInput !== input) {
      setNameError('Only letters and spaces are allowed.');
    } else {
      setNameError(null);
    }

    setUserName(sanitizedInput);
  };

  const handleUpdateUserName = async () => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: user?.id,
          name: userName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.user);
        setShowNameField(false)
      } else {
        setShowNameField(false)
        const responseErrorMessage = await response.text();
        Sentry.captureException(new Error(`Updating user name - ${response.statusText} || 'Unknown Error'}, ${response.status}`), {
          extra: {
            privyId: user?.id ?? 'unknown privyId'
          }
        });

        console.error(`Failed to update user name: ${responseErrorMessage}`);
        Sentry.captureException(new Error (`Failed to update user name: ${responseErrorMessage}`));
      }

    } catch (err) {
      setShowNameField(false)
      Sentry.captureException(err);
      if (isError(err)) {
        console.error(`Failed to update user name: ${err.message}`);
      } else {
        console.error('Failed to update user name');
      }
    }
  }

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
    const noName = !appUser.name;

    if (noEmail || noPhone || noName) {
      setShowForm(true);
    } else {
      router.push('myrewards')
    }
  }, [ready, authenticated, appUser, user, router])

  return (
    
   
    <Flex direction={'column'} justify={'center'} align={'center'} height={'100vh'} width={'100%'} 
      style={{backgroundColor: '#EC2078', position: 'relative', overflow: 'hidden', zIndex: 1}}
    >
      <Flex width={'100%'} height={'100%'} style={{ position: 'absolute', bottom: 0, overflow: 'hidden', lineHeight: 0, zIndex: -1 }}>
        <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 540 960" width="100%" height="100%"  preserveAspectRatio="none" version="1.1">
          <path d="M0 536L30 532.8C60 529.7 120 523.3 180 520C240 516.7 300 516.3 360 522.7C420 529 480 542 510 548.5L540 555L540 961L510 961C480 961 420 961 360 961C300 961 240 961 180 961C120 961 60 961 30 961L0 961Z" fill="#fa7268"/>
          <path d="M0 607L30 598.3C60 589.7 120 572.3 180 579.7C240 587 300 619 360 619.2C420 619.3 480 587.7 510 571.8L540 556L540 961L510 961C480 961 420 961 360 961C300 961 240 961 180 961C120 961 60 961 30 961L0 961Z" fill="#f85b6a"/>
          <path d="M0 715L30 719C60 723 120 731 180 725.7C240 720.3 300 701.7 360 690.2C420 678.7 480 674.3 510 672.2L540 670L540 961L510 961C480 961 420 961 360 961C300 961 240 961 180 961C120 961 60 961 30 961L0 961Z" fill="#f3426f"/>
          <path d="M0 832L30 831C60 830 120 828 180 824.2C240 820.3 300 814.7 360 815.3C420 816 480 823 510 826.5L540 830L540 961L510 961C480 961 420 961 360 961C300 961 240 961 180 961C120 961 60 961 30 961L0 961Z" fill="#ec2078"/>
        </svg>
      </Flex>
      {ready && !authenticated && (
        <Flex height={'100%'} direction={'column'} position={'relative'} gap={'9'} align={'center'} justify={'center'}>
        
          <Image
            src="/logos/lffvl-logo-white.png"
            alt="Vintage Land logo"
            priority
            width={800}
            height={324}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 50vw, 33vw"
            style={{width: '300px', height: 'auto', justifySelf: 'center', alignSelf: 'center'}}
          />
       
          <Image
            src="/logos/vl-avatar.png"
            alt="Vintage Land avatar"
            priority
            height={552}
            width={510}
            style={{width: '200px', height: 'auto', justifySelf: 'center', alignSelf: 'center'}}
          />
        
        </Flex>
         )}
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
          <Flex direction={'column'} justify={'end'} align={'end'} gap={'7'} style={{marginBottom: '50px'}}>
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
              <Flex mb={'7'} direction={'column'} justify={'center'} align={'center'}>
                <Flex direction={'column'} gap={'2'}>
                  <Image
                    src="/logos/vl-avatar.png"
                    alt="Vintage Land avatar"
                    priority
                    height={552}
                    width={510}
                    style={{width: '150px', height: 'auto', justifySelf: 'center', alignSelf: 'center'}}
                  />
                </Flex>
                {(showNameField && !appUser.name) ? (
                  <>
                    <Text mt={'5'} mb={'3'} weight={'bold'} size={'6'} align={'center'} as='label' style={{color: 'white'}}>What is your name?</Text>
                    <TextField.Root
                      size={'3'}
                      value={userName}
                      style={{width: '250px'}}
                      onChange={handleUserNameChange}
                    />
                    {nameError && (
                      <Callout.Root>
                        <Callout.Text size={'5'} style={{color: 'white'}}>
                          {nameError}
                        </Callout.Text>
                      </Callout.Root>
                      )}
                    <Button 
                      mt={'5'}
                      disabled={!userName && !nameError}
                      size={'3'}
                      style={{width: '250px'}}
                      onClick={handleUpdateUserName}
                    >
                      Continue
                    </Button>
                  </>
                ) : (!user?.email?.address && !user?.google?.email) && (
                  <>
                    <Text mt={'5'} mb={'6'} mx={'3'} align={'center'} size={'6'} weight={'bold'}
                      style={{color: 'white'}}
                    >
                      Add your email for more discounts.
                    </Text>
                    <Flex justify={'between'} gap={'5'} align={'center'} direction={'column'} my={'6'} py={'5'}
                      style={{backgroundColor: 'rgba(224, 224, 224, 0.5)', borderColor: 'rgba(224, 224, 224, 0.5)', borderStyle: 'solid', borderRadius: '5px', borderWidth: '1px', padding: '50px'}}
                    >
                      <Button disabled={!appUser} variant='solid' style={{ width: "250px", paddingTop: '40px', paddingBottom: '40px', backgroundColor: 'white' }}
                        onClick={linkGoogle}
                      >
                        <Flex direction={'row'} align={'center'} gap={'3'} my={'2'}>
                          <Avatar
                            src="/logos/googleicon.png"
                            fallback="G"
                            style={{objectFit: 'contain'}}
                          />
                          <Text size={'3'} style={{color: 'black'}}>Continue with Google</Text>
                        </Flex>
                      </Button>
                    
                      <Text size={'4'}>----or----</Text>
                      
                      <Button disabled={!appUser} highContrast variant='outline' style={{ width: "250px", fontSize: '16px' }} 
                        onClick={linkEmail}
                      >
                        Manually enter email
                      </Button>
                      
                    </Flex>
                    <Button variant='ghost' 
                      onClick={() => router.push('/myrewards')}
                    >
                      <Text size={'5'} style={{color: 'white'}}>
                        skip
                      </Text>
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
                    <Text align={'center'} size={'5'}>Add your phone number for more discounts.</Text>
                    <Button my={'5'} mx={'3'} size={'3'} style={{ width: "250px"}} onClick={linkPhone}>
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
  );
};