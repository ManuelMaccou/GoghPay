'use client'

import { debounce } from 'lodash';
import { useRouter } from 'next/navigation';
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { ContactMethod, Merchant, RewardsTier, User as TypeUser, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets, useLinkAccount } from "@privy-io/react-auth";
import * as Avatar from '@radix-ui/react-avatar';
import { Avatar as AvatarImage, Button, Callout, Card, Flex, Heading, Spinner, Text, Separator, Box } from "@radix-ui/themes";
import Image from 'next/image';
import { Suspense, useCallback, useEffect, useRef, useState, use } from "react";
import { useUser } from "@/app/contexts/UserContext";
import axios from "axios";
import { checkAndRefreshToken } from "@/app/lib/refresh-tokens";
import { ArrowLeftIcon, CheckCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useSearchParams } from "next/navigation";
import * as Sentry from '@sentry/nextjs';
import { ApiError } from '@/app/utils/ApiError';
import { hexToRgba } from '@/app/utils/getComplementaryColor';
import { User } from '@privy-io/server-auth';
import React from 'react';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

interface MyMerchantRewardsContentProps {
  params: Promise<{
    merchantId: string;
  }>;
}

interface MyMerchantRewardsProps {
  params: Promise<{
    merchantId: string;
  }>;
}

function MyMerchantRewardsContent({ params }: MyMerchantRewardsContentProps) {  
  const router = useRouter();
  const { ready, authenticated, user, unlinkEmail, unlinkGoogle, unlinkPhone } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const { appUser, setAppUser } = useUser();

  const [error, setError] = useState<string | null>(null);
  const [errorCheckingSquareDirectory, setErrorCheckingSquareDirectory] = useState<string | null>(null);
  const [linkPhoneError, setLinkPhoneError] = useState<string | null>(null);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [linkGmailError, setLinkGmailError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<TypeUser>();
  const [isFetchingMerchant, setIsFetchingMerchant] = useState<boolean>(true);
  const [merchantTokenIsValid, setMerchantTokenIsValid] = useState<boolean>(false);
  const [isCheckingMerchantToken, setIsCheckingMerchantToken] = useState<boolean>(true);
  const [currentUserMerchantRewards, setCurrentUserMerchantRewards] = useState<UserReward | null>(null);
  const [isFetchingCurrentUserRewards, setIsFetchingCurrentUserRewards] = useState<boolean>(true);
  const [isCheckingSquareDirectory, setIsCheckingSquareDirectory] =  useState<boolean | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const [usersCurrentRewardsTier, setUsersCurrentRewardsTier] = useState<RewardsTier | null>(null);
  const [amountToNextRewardsTier, setAmountToNextRewardsTier] = useState<number | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);

  const [primaryColor, setPrimaryColor] = useState<string>("#FFFFFF");
  const [secondaryColor, setSecondaryColor] = useState<string>("#000000");

  const [preferredContact, setPreferredContact] = useState<ContactMethod | null>(null);
  type LoginMethod = "google" | "sms" | "email" | "farcaster" | "discord" | "twitter" | "github" | "spotify" | "instagram" | "tiktok" | "linkedin" | "apple" | "telegram" | "wallet";

  const [showLinkEmail, setShowLinkEmail] = useState<boolean>(false);
  const [showLinkPhone, setShowLinkPhone] = useState<boolean>(false);

  let privyLoginMethods: LoginMethod[] = ['sms'];
  if (preferredContact === ContactMethod.Email) {
    privyLoginMethods = ['google', 'email']
  } else if (preferredContact === ContactMethod.Phone) {
    privyLoginMethods = ['sms']
  } else if (preferredContact === ContactMethod.Either || !preferredContact) {
    privyLoginMethods = ['google', 'email', 'sms']
  };
  

  const [code, setCode] = useState<string | null>(null);

  const searchParams = useSearchParams();

  const { merchantId } = React.use(params);

  useEffect(() => {
    if (!merchant) return;
    const codeParam = searchParams.get('code');

    if (codeParam && codeParam === merchant.code) {
      setCode(codeParam);
    }
  }, [searchParams, merchant]);


  const handleLogin = () => {
    login({
      loginMethods: ['email', 'google', 'sms'],
      disableSignup: true 
    });
  };

  const handleSignup = () => {
    login({ loginMethods: privyLoginMethods
     });
  };

  const handleUnlinkAccount = async (linkMethod: LoginMethod, user: User) => {
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


  const handleLinkSuccess = async (user: any, linkMethod: string) => {
    try {
      setErrorCheckingSquareDirectory(null);
      setLinkEmailError(null);
      setLinkGmailError(null);
      setLinkPhoneError(null);

      const accessToken = await getAccessToken();
      const requestBody: { email?: string; phone?: string; privyId: string }  = {
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
        setShowLinkEmail(false)
        setShowLinkPhone(false)
      } else {
        await handleUnlinkAccount(linkMethod, user)
        const errorMessage = await response.text();
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
        console.error(`Failed to link ${linkMethod}: ${errorMessage}`);
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Error linking ${linkMethod}:`, err);
  
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


  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    console.log('preferred contact:', preferredContact)
    if (preferredContact === ContactMethod.Phone && !user?.phone?.number) {
      setShowLinkPhone(true);
    }

    if (preferredContact === ContactMethod.Email && (!user?.google?.email && !user.email?.address)) {
      setShowLinkEmail(true);
    }
  }, [ready, authenticated, user, preferredContact])

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
          const errorMessage = await response.text();
          Sentry.captureException(new Error(`Updating user with smart wallet address - ${response.statusText} || 'Unknown Error'}, ${response.status}`), {
            extra: {
              privyId: user?.id ?? 'unknown privyId'
            }
          });
  
          console.error(`Failed to update user with smart wallet address: ${errorMessage}`);
          Sentry.captureException(new Error (`Failed to update user with smart wallet address: ${errorMessage}`));
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
    if (!appUser.smartAccountAddress && smartWallet) {
      updateUserWithSmartWalletAddress(smartWallet)
    }
  }, [setAppUser, appUser, user])

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);

      if (isNewUser) {
        try {
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            phone: user.phone?.number,
            creationType: 'privy',
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          if (response.status >= 200 && response.status < 300) {

            console.log('new app user:', response.data.user)
            const newUser = response.data.user

            await findExistingSquareCustomer(newUser)

            setAppUser(newUser);
          } else {
            setErrorCheckingSquareDirectory('There was an issue logging in. Please try again.');
            console.error('Unexpected response status:', response.status, response.statusText);
          }

        } catch (error: unknown) {
          Sentry.captureException(error);
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
          return;
        }
      }
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  useEffect(() => {
    if (appUser && !currentUser) {
      setCurrentUser(appUser);
    }
  }, [appUser, currentUser]);

  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress || null;
      setWalletForPurchase(walletAddress);
    }
  }, [appUser]);


  const updateGoghUserWithSquareId = useCallback(async (squareCustomerId: string, appUser: TypeUser) => {
    try {
      const accessToken = await getAccessToken();
      console.log('privy id at update gogh user:', appUser?.privyId)
      const response = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          squareCustomerId: squareCustomerId,
          privyId: appUser?.privyId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.user);
      } else {
        const errorMessage = await response.text();
        Sentry.captureException(new Error(`Adding Square user Id to Gogh user - ${response.statusText} || 'Unknown Error'}, ${response.status}`), {
          extra: {
            privyId: appUser?.privyId ?? 'unknown privyId'
          }
        });

        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Failed to update Gogh user: ${errorMessage}`);
        Sentry.captureException(new Error (`Failed to update Gogh user: ${errorMessage}`));
      }

    } catch (err) {
      Sentry.captureException(err);
      if (isError(err)) {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Error syncing Square customer with Gogh: ${err.message}`);
      } else {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error('Error syncing Square customer with Gogh');
      }
    }
  }, [setAppUser]);

  const createNewSquareCustomer = useCallback(async (appUser: TypeUser) => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/square/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          email: appUser?.email,
          phone: appUser?.phone,
          merchantId: merchant?._id,
          goghUserId: appUser?._id, // saved in Square as a referenceID
          privyId: appUser?.privyId,
          note: "Gogh rewards"
        }),
      });

      const data = await response.json();

      const apiError = new ApiError(
        `Creating a new Square customer - ${response.statusText} - ${data.message || 'Unknown Error'}`,
        response.status,
        data
      );

      if (response.ok) {
        
        console.log('new square customer created')

        await updateGoghUserWithSquareId(data.newSquareCustomer?.id, appUser)

      } else if (response.status === 503) {
        Sentry.captureException(apiError, {
          extra: {
            responseStatus: response?.status ?? 'unknown',
            responseMessage: data?.message || 'Unknown Error',
            email: appUser?.email ?? 'unknown email',
            merchantId: merchant?._id ?? 'unknown merchant Id',
            goghUserId: appUser?._id ?? 'unknown userId',
            privyId: appUser?.privyId ?? 'unknown',
            },
        });

        setErrorCheckingSquareDirectory('The was an error checking in. Please wait a few minutes and try again.');
      } else if (response.status === 401) {
        Sentry.captureException(apiError, {
          extra: {
            responseStatus: response?.status ?? 'unknown',
            responseMessage: data?.message || 'Unknown Error',
            email: appUser?.email ?? 'unknown email',
            merchantId: merchant?._id ?? 'unknown merchant Id',
            goghUserId: appUser?._id ?? 'unknown userId',
            privyId: appUser?.privyId ?? 'unknown',
            },
        });

        setErrorCheckingSquareDirectory('Unauthorized.');
      } else {
        Sentry.captureException(apiError, {
          extra: {
            responseStatus: response?.status ?? 'unknown',
            responseMessage: data?.message || 'Unknown Error',
            email: appUser?.email ?? 'unknown email',
            merchantId: merchant?._id ?? 'unknown merchant Id',
            goghUserId: appUser?._id ?? 'unknown userId',
            privyId: appUser?.privyId ?? 'unknown',
            },
        });

        const errorMessage = await response.text();
        console.error(`Failed to create Square customer: ${errorMessage}`);
        Sentry.captureException(new Error(`Failed to create Square customer: ${errorMessage}`))
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      }
    } catch (err) {
      Sentry.captureException(err, {
          extra: {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            email: appUser?.email ?? 'unknown email',
            merchantId: merchant?._id ?? 'unknown merchant Id',
            goghUserId: appUser?._id ?? 'unknown userId',
            privyId: appUser?.privyId ?? 'unknown',
            },
        });

      if (isError(err)) {
        console.error(`Error creating new square customer: ${err.message}`);
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      } else {
        console.error('Error creating new square customer.');
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      }
    }
  }, [merchant?._id, updateGoghUserWithSquareId]);

  const findExistingSquareCustomer = useCallback(async (appUser: TypeUser) => {
    console.log("is finding existing square customer")

    let encodedEmail
    let encodedPhone
    if (!appUser) return
    if (appUser.email) {
      encodedEmail = encodeURIComponent(appUser.email);
      console.log('encdoedEmail:', encodedEmail);
    }

    if (appUser.phone) {
      encodedPhone = encodeURIComponent(appUser.phone);
      console.log('encodedPhone:', encodedPhone);
    }

    if (!encodedEmail && !encodedPhone) return;

    try {
      const accessToken = await getAccessToken();

      // Construct the query string dynamically
      const queryParams = new URLSearchParams();
      
      if (encodedEmail) {
        queryParams.append('email', encodedEmail);
      }
      
      if (encodedPhone) {
        queryParams.append('phone', encodedPhone);
      }

      if (merchant?._id) {
        queryParams.append('merchantId', merchant._id);
      }

      if (appUser.privyId) {
        queryParams.append('privyId', appUser.privyId);
      }

      const url = `/api/square/user?${queryParams.toString()}`;
      console.log('Get Square user url:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
      });

      if (response.ok) {
        if (response.status === 204) {

          console.log('creating new square customer');

          await createNewSquareCustomer(appUser);
        } else {

          const data = await response.json();
          if (data.customers && data.customers.length > 0) {
            console.log('updateding gogh user with id:' , data.customers[0].id, 'privyId:', appUser.privyId)
            await updateGoghUserWithSquareId(data.customers[0].id, appUser);
          } else {
            await createNewSquareCustomer(appUser);
          }
        }
      } else {
        const errorMessage = await response.text();
        setErrorCheckingSquareDirectory(
          'Failed to check in. Please re-scan QR code and try again.'
        );
        Sentry.captureException(new Error(`Error searching Square directory: ${errorMessage}`));
        console.error(`Error searching Square directory: ${errorMessage}`);
      }
    } catch (err) {
      setErrorCheckingSquareDirectory(
        'Failed to check in. Please re-scan QR code and try again.'
      );
      Sentry.captureException(err);
      if (isError(err)) {
        console.error(`Error searching Square directory: ${err.message}`);
      } else {
        console.error('Error searching Square directory');
      }
    } finally {
      setIsCheckingSquareDirectory(false);
    }
  }, [merchant, createNewSquareCustomer, updateGoghUserWithSquareId]);
  
  useEffect(() => {
    if (!merchant?.square) {
      setIsCheckingSquareDirectory(false);
      return;
    };
    
    if (!appUser) return;

    if (appUser?.squareCustomerId) {
      setIsCheckingSquareDirectory(false);
      return;
    }

    if (!hasSynced && !isCheckingSquareDirectory) {
      if (!isCheckingMerchantToken && merchantTokenIsValid) {
        console.log('ischeckingsquaredirectory')
        setIsCheckingSquareDirectory(true);

        findExistingSquareCustomer(appUser).then(() => {
          setHasSynced(true);
          setIsCheckingSquareDirectory(false);
          
        });
      } else if (!isCheckingMerchantToken && !merchantTokenIsValid) {
        console.error('There was an error. Please have the seller reconnect to Square from their Gogh account.')
        setErrorCheckingSquareDirectory('There was an error. Please have the seller reconnect to Square from their Gogh account.')
      }
      
    }
  }, [merchant, appUser, hasSynced, isCheckingSquareDirectory, findExistingSquareCustomer, merchantTokenIsValid, isCheckingMerchantToken]);
    
  useEffect(() => {
    if (merchantId) {
      setIsFetchingMerchant(true);
      const fetchMerchant = async () => {
        try {
          const response = await fetch(`/api/merchant/${merchantId}`);
          const data:Merchant = await response.json();
          setMerchant(data || null);

          if (data?.branding) {
            setPrimaryColor(() => data.branding?.primary_color || "#FFFFFF"); // Use functional update
            setSecondaryColor(() => data.branding?.secondary_color || "#000000"); // Use functional update
          }

          if (data?.preferredContactMethod) {
            setPreferredContact(data?.preferredContactMethod)
          }

        } catch (err) {
          if (isError(err)) {
            setError(`Error fetching merchant: ${err.message}`);
          } else {
            setError('Error fetching merchant');
          }
        } finally {
          setIsFetchingMerchant(false);
        }
      };
      
      fetchMerchant();
    }
  }, [merchantId]);

  useEffect(() => {
    const debouncedCheck = debounce(async () => {
      if (merchant) {
        setIsCheckingMerchantToken(true);
        const isValid = await checkAndRefreshToken(merchant._id);
        setMerchantTokenIsValid(isValid);
        setIsCheckingMerchantToken(false);
      }
    }, 500); // 500ms debounce time
  
    debouncedCheck();
  
    return () => {
      debouncedCheck.cancel(); // Clean up debounce on component unmount or merchant change
    };
  }, [merchant]);

  useEffect(() => {
    const createNewRewards = async () => {
      if (!currentUser || !merchant) return;
      if (!merchant.rewards || !merchant.rewards.discount_type || !merchant.rewards.tiers) return;

      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/rewards/userRewards/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({ 
            privyId: currentUser?.privyId,
            customerId: currentUser._id,
            merchantId: merchantId,
            currentDiscountType: merchant.rewards?.discount_type,
            welcomeDiscount: merchant.rewards?.welcome_reward ? merchant.rewards.welcome_reward : null,
            totalSpent: 0,
            purchaseCount: 0,
            lastVisit: new Date().toISOString(),
          })
        });

        const userRewardsData = await response.json();

        if (response.ok) {
         
          if (userRewardsData?.userReward) {
            setCurrentUserMerchantRewards(userRewardsData.userReward);
          } else {
            console.error('No valid user reward data returned');
          }
        } else {
          const apiError = new ApiError(
            `Creating new user reward record - ${response.statusText} - ${userRewardsData.message || 'Unknown Error'}`,
            response.status,
            userRewardsData
          );
          Sentry.captureException(apiError, {
            extra: {
              responseStatus: response?.status ?? 'unknown',
              responseMessage: userRewardsData?.message || 'Unknown Error',
              privyId: currentUser?.privyId ?? 'uknown',
              customerId: currentUser._id ?? 'unknown',
              merchantId: merchantId ?? 'unknown',
            },
          });
          console.error('Failed to create new reward:', response.statusText);
          Sentry.captureException(new Error(`Failed to create a new reward: ${response.status}`));
        }
      } catch (error: unknown) {
        Sentry.captureException(error);
        if (isError(error)) {
          console.error('Error fetching merchant rewards:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      }
    }

    const fetchCurrentUserMerchantRewards = async () => {
      if (!currentUser) return;
      setIsFetchingCurrentUserRewards(true)
      const accessToken = await getAccessToken();

      try {
        const queryParamsObj: Record<string, string> = {
          customerId: currentUser._id,
          privyId: currentUser.privyId || '',
        };
    
        if (code) {
          queryParamsObj.code = code;
        }

        const queryParams = new URLSearchParams(queryParamsObj).toString();

        const response = await fetch(`/api/rewards/userRewards/${merchantId}?${queryParams}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        if (response.ok) {
          if (response.status === 204) {
            if (code) {
              await createNewRewards();
            }
          } else {
            const userRewardsData = await response.json();
            setCurrentUserMerchantRewards(userRewardsData);
          }
        } else {
          console.error('Failed to fetch rewards:', response.statusText);
          Sentry.captureException(new Error(`Failed to fetch rewards: ${response.statusText}`))
        }
      } catch (error: unknown) {
        Sentry.captureException(error);
        if (isError(error)) {
          console.error('Error fetching merchant rewards:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      } finally {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('code'); // Remove the "code" parameter

        // Use replaceState to update the URL without reloading the page
        window.history.replaceState(null, '', currentUrl.toString());

        setIsFetchingCurrentUserRewards(false);
      }
    };

    if (ready && authenticated && currentUser) {
      fetchCurrentUserMerchantRewards();
    }
  }, [authenticated, ready, currentUser, merchantId, merchant, code]);

  useEffect (() => {
    const checkMilestone = () => {

      if (!merchant) return;

      if (!currentUserMerchantRewards) {
        return null;
      }

      const discountEarned = currentUserMerchantRewards?.currentDiscount?.amount;
      const totalSpent = currentUserMerchantRewards?.totalSpent;

      if (totalSpent === null || totalSpent === undefined) return;
    
      const tiers = merchant?.rewards?.tiers || [];
    
      if (!tiers.length) {
        setErrorCheckingSquareDirectory("Seller does not have rewards available.")
        return null;
      }
    
      const sortedTiers = tiers.sort((a, b) => a.milestone - b.milestone);
    
      let highestTier = null;
      let nextMilestone = null;
    
      for (const tier of sortedTiers) {
        if (totalSpent >= tier.milestone) {
          highestTier = tier;
        } else if (discountEarned >= tier.discount) {
          highestTier = tier;
        } else {
          nextMilestone = tier.milestone;
          break; 
        }
      }

      const amountToNextTier = nextMilestone ? nextMilestone - totalSpent : 0;

      setUsersCurrentRewardsTier(highestTier);
      setAmountToNextRewardsTier(Math.round(amountToNextTier * 100) / 100);
    };

    checkMilestone();  
  }, [currentUserMerchantRewards, merchant])

  const rewardsContainerRef = useRef<HTMLDivElement>(null);
  const targetCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom when the component mounts or updates
    if (rewardsContainerRef.current) {
      rewardsContainerRef.current.scrollTop = rewardsContainerRef.current.scrollHeight;
    }
  }, [merchant?.rewards?.tiers]); 

  useEffect(() => {
    // Scroll to the specific card when the component mounts or updates
    if (targetCardRef.current) {
      targetCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [usersCurrentRewardsTier, merchant?.rewards?.tiers]);

  const sortedMilestoneTiers = merchant?.rewards?.tiers ? [...merchant.rewards.tiers].sort((a, b) => a.milestone - b.milestone) : [];

  if (!ready) {
    return (
      <Flex justify={'center'} align={'center'} height={'100vh'}>
        <Spinner />
      </Flex>
    );
  }
  
  if (!authenticated) {
    if (isFetchingMerchant) {
      return (
        <Flex justify={'center'} align={'center'} height={'100vh'}>
          <Spinner />
        </Flex>
      );
    }
    
    return (
      <Flex direction={'column'} justify={'center'} align={'center'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} style={{ backgroundColor: primaryColor }}>
        <Avatar.Root>
          <Avatar.Image
            className="MerchantLogo"
            src={merchant?.branding?.logo || '/logos/gogh_logo_black.svg'}
            alt="Merchant Logo"
            style={{ objectFit: "contain", maxWidth: '200px' }}
          />
        </Avatar.Root>
  
        <Button style={{  width: "250px", backgroundColor: secondaryColor, color: primaryColor }}
          onClick={handleLogin}
        >
          Log in
        </Button>
  
        <Button style={{ width: "250px", backgroundColor: secondaryColor, color: primaryColor }} 
          onClick={handleSignup}
        >
          Create an account
        </Button>
      </Flex>
    );
  }

  if (showLinkEmail && merchant) {
    return (
      <Flex direction={'column'} justify={'center'} align={'center'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} style={{ backgroundColor: primaryColor }}>
        <Avatar.Root>
          <Avatar.Image
            className="MerchantLogo"
            src={merchant?.branding?.logo || '/logos/gogh_logo_black.svg'}
            alt="Merchant Logo"
            style={{ objectFit: "contain", maxWidth: '200px'}}
          />
        </Avatar.Root>
        <Text align={'center'} size={'5'} style={{color: secondaryColor}}>Add your email to receive rewards from</Text>
        <Text align={'center'} size={'5'} mt={'-5'} style={{color: secondaryColor}}>{merchant?.name}</Text>
        <Flex justify={'center'} align={'center'} direction={'column'} gap={'4'} mt={'6'} style={{borderStyle: 'solid', borderRadius: '5px', borderColor: secondaryColor, borderWidth: '1px', padding: '35px'}}>
          <Text size={'5'} mx={'3'} align={'center'} style={{color: secondaryColor, backgroundColor: primaryColor, marginTop: '-50px', paddingRight: '10px', paddingLeft: '10px'}}>Fastest</Text>
          <Button style={{ width: "250px", height: "fit-content", backgroundColor: secondaryColor, color: primaryColor }}
            onClick={linkGoogle}
          >
            <Flex direction={'row'} align={'center'} gap={'3'} my={'2'}>
              <AvatarImage
                src="/logos/googleicon.png"
                fallback="G"
                style={{objectFit: 'contain'}}
              />
              <Text size={'3'}>Continue with Google</Text>
            </Flex>
          </Button>
        </Flex>
        <Text size={'4'} style={{color: secondaryColor}}>----or----</Text>
        
        <Button style={{ width: "250px", fontSize: '16px', backgroundColor: secondaryColor, color: primaryColor }} 
          onClick={linkEmail}
        >
          Manually enter email
        </Button>

        {linkEmailError && (
          <Callout.Root style={{backgroundColor: secondaryColor}}>
            <Callout.Icon>
              <InfoCircledIcon style={{color: primaryColor}}/>
            </Callout.Icon>
            <Callout.Text style={{color: primaryColor}}>
              {linkEmailError}
            </Callout.Text>
          </Callout.Root>
        )}
        {linkGmailError && (
          <Callout.Root style={{backgroundColor: secondaryColor}}>
            <Callout.Icon>
              <InfoCircledIcon style={{color: primaryColor}} />
            </Callout.Icon>
            <Callout.Text  style={{color: primaryColor}}>
              {linkGmailError}
            </Callout.Text>
          </Callout.Root>
        )}
        
      </Flex>
    );
  }

  if (showLinkPhone && merchant) {
    return (
      <Flex direction={'column'} justify={'center'} align={'center'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} style={{ backgroundColor: primaryColor }}>
        <Avatar.Root>
          <Avatar.Image
            className="MerchantLogo"
            src={merchant?.branding?.logo || '/logos/gogh_logo_black.svg'}
            alt="Merchant Logo"
            style={{ objectFit: "contain", maxWidth: '200px' }}
          />
        </Avatar.Root>
        <Text align={'center'} size={'5'} style={{color: secondaryColor}}>Link your phone to receive rewards from</Text>
        <Text align={'center'} size={'5'} style={{color: secondaryColor}} mt={'-5'}>{merchant?.name}</Text>
        <Button style={{ width: "250px", backgroundColor: secondaryColor, color: primaryColor }} onClick={linkPhone}>
          Add phone
        </Button>
        {linkPhoneError && (
          <Callout.Root style={{backgroundColor: secondaryColor}}>
            <Callout.Icon>
              <InfoCircledIcon style={{color: primaryColor}}/>
            </Callout.Icon>
            <Callout.Text style={{color: primaryColor}}>
              {linkPhoneError}
            </Callout.Text>
          </Callout.Root>
        )}
      </Flex>
    );
  }

  if (!isFetchingMerchant && !isFetchingCurrentUserRewards && !isCheckingSquareDirectory && !errorCheckingSquareDirectory) {
    return (
      <>
        <Flex direction={'column'} height={'20vh'}  width={'100%'} style={{backgroundColor: '#091b36'}}>
          <Flex direction={'row'} justify={'end'} align={'center'} p={'6'}>
            <Header
              color={secondaryColor}
              merchant={currentUser?.merchant}
              embeddedWallet={embeddedWallet}
              authenticated={authenticated}
              walletForPurchase={walletForPurchase}
              currentUser={currentUser}
            />
          </Flex>
        </Flex>
        <Flex
          minHeight='80vh'
          pb={'7'}
          direction={'column'}
          gap={'5'}
          align={'center'}
        >
          {merchant?.branding?.logo ? (
            <Flex mb={'4'} mt={'-9'} direction={'column'} align={'center'} justify={'center'}>
              <AvatarImage
                src={merchant.branding.logo}
                fallback='/logos/gogh_logo_black.svg'
                radius='full'
                size={'8'}
                style={{padding: '7px', objectFit: 'scale-down', borderStyle: 'solid', borderColor: 'white', borderRadius: '100%', backgroundColor: primaryColor}}
              />
            </Flex>
          ) : (
            <Heading style={{color: 'white', zIndex: '10'}}>{merchant?.name}</Heading>
          )}
          <Flex direction={'column'} width={'100%'}>
            <Flex style={{marginRight: '20px', marginLeft: '20px'}}>
              <Flex direction={'column'} gap={'4'} px={'2'} width={'100%'}>
                {usersCurrentRewardsTier && (
                  <Flex direction={'column'} justify={'center'} width={'100%'}>
                    {code && (
                     
                      <Callout.Root mt={'-5'} mb={'3'} color='green'>
                        <Callout.Icon>
                          <CheckCircledIcon />
                        </Callout.Icon>
                        <Callout.Text>
                          You&apos;re checked in! Waiting for the merchant.
                        </Callout.Text>
                      </Callout.Root>
               
                    )}
                    <Text weight={'bold'} align={'center'} size={'6'}>Earning{' '}{usersCurrentRewardsTier.discount}% off</Text>
                  </Flex>
                )}

                {!usersCurrentRewardsTier || usersCurrentRewardsTier._id !== sortedMilestoneTiers[sortedMilestoneTiers.length - 1]?._id ? (
                  <Flex direction={'column'} width={'100%'} justify={'start'} align={'start'}>
                    <Text align={'left'} weight={'bold'} size={'5'}>
                      Until next upgrade:
                    </Text>
                    <Flex direction={'row'}>
                      <Text size={'7'}>$</Text>
                      <Text size={'9'}>{amountToNextRewardsTier}</Text>
                    </Flex>
                  </Flex>
                  
                ) : usersCurrentRewardsTier && usersCurrentRewardsTier._id === sortedMilestoneTiers[sortedMilestoneTiers.length - 1]?._id && (  
                  <Flex 
                    direction={'column'} 
                    align={'center'} justify={'center'}
                    p={'3'}
                  >
                    <Text weight={'bold'} size={'4'} align={'center'}>
                      You&apos;re earning the max discount!
                    </Text>
                  </Flex>
                )}
              </Flex>
            </Flex>
            <Flex direction={'column'} py={'5'} px={'3'} overflow={'scroll'} gap={'3'} ref={rewardsContainerRef}>
              {sortedMilestoneTiers.map((tier) => (
                <Flex key={tier._id}
                  ref={tier._id === usersCurrentRewardsTier?._id ? targetCardRef : null}
                  style={{
                    padding: '16px',
                    backgroundColor: tier._id === usersCurrentRewardsTier?._id ? "#7DA7D7" : "",
                    borderRadius: '8px',
                    flexShrink: 0,
                  }}
                >
                  <Flex direction={'column'} gap={'3'} justify={'between'} align={'center'} height={'60px'} width={'100%'}>
                    <Text size={'5'} weight="bold" style={{color: tier._id === usersCurrentRewardsTier?._id ? 'black' : 'grey'}}>
                      {tier.name}
                    </Text>
                    <Text size={'5'} style={{color: tier._id === usersCurrentRewardsTier?._id ? 'black' : 'grey'}}>
                      {tier.discount}% off
                    </Text>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Flex>
      </>
    );
  }

  if (!isCheckingSquareDirectory && errorCheckingSquareDirectory) {
    return (
      <Flex direction={'column'} gap={'4'} height={'100vh'} style={{ background: primaryColor }}>
        <Flex direction={'row'} justify={'end'} align={'center'} px={'4'} height={'100px'}>
          <Header
            color={secondaryColor}
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
        </Flex>
        <Text size={'7'} weight={'bold'} align={'center'} style={{ color: secondaryColor }}>Oops!</Text>
        <Text align={'center'} style={{ color: secondaryColor }}>{errorCheckingSquareDirectory}</Text>
        <Button size={'4'} onClick={() => router.back}>
          <ArrowLeftIcon />
          Go back
        </Button>
      </Flex>
    );
  }

  

  return (
    <Flex justify={'center'} align={'center'} height={'100vh'}>
      <Spinner />
    </Flex>
  );
};


export default function MyMerchantRewards({ params }: MyMerchantRewardsProps) {  
  return (
    <Suspense fallback={<Spinner />}>
      <MyMerchantRewardsContent params={params} />
    </Suspense>
  );
}