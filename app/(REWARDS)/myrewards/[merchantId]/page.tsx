'use client'

import { debounce } from 'lodash';
import { useRouter } from 'next/navigation';
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { ContactMethod, Merchant, RewardsTier, User, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import * as Avatar from '@radix-ui/react-avatar';
import { Button, Callout, Card, Flex, Heading, Spinner, Text, Separator } from "@radix-ui/themes";
import Image from 'next/image';
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/contexts/UserContext";
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import axios from "axios";
import { checkAndRefreshToken } from "@/app/lib/refresh-tokens";
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useSearchParams } from "next/navigation";
import * as Sentry from '@sentry/nextjs';
import { ApiError } from '@/app/utils/ApiError';
import { getModifiedColor, hexToRgba } from '@/app/utils/getComplementaryColor';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function MyMerchantRewardsContent({ params }: { params: { merchantId: string } }) {  
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const { appUser, setAppUser } = useUser();

  const [error, setError] = useState<string | null>(null);
  const [errorCheckingSquareDirectory, setErrorCheckingSquareDirectory] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User>();
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
  const [complementaryColor, setcomplementaryColor] = useState<string>("#000000");
  const [secondaryColorWithTransparency, setSecondaryColorWithTransparency] = useState<string>("#000000");

  const [preferredContact, setPreferredContact] = useState<ContactMethod>(ContactMethod.Phone);
  type LoginMethod = "google" | "sms" | "email" | "farcaster" | "discord" | "twitter" | "github" | "spotify" | "instagram" | "tiktok" | "linkedin" | "apple" | "telegram" | "wallet";

  let privyLoginMethods: LoginMethod[] = ['sms'];
  if (preferredContact === ContactMethod.Email) {
    privyLoginMethods = ['google', 'email']
  } else if (preferredContact === ContactMethod.Phone) {
    privyLoginMethods = ['sms']
  } else if (preferredContact === ContactMethod.Either) {
    privyLoginMethods = ['google', 'email', 'sms']
  };
  

  const [code, setCode] = useState<string | null>(null);

  const searchParams = useSearchParams();

  const merchantId = params.merchantId

  useEffect(() => {
    const codeParam = searchParams.get('code');

    setCode(codeParam);
  }, [searchParams]);


  const handleLogin = () => {
    login({
      loginMethods: privyLoginMethods,
      disableSignup: true 
    });
  };

  const handleSignup = () => {
    login({ loginMethods: privyLoginMethods
     });
  };

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);

      let smartAccountAddress;

      if (isNewUser) {
        if (embeddedWallet) {
          smartAccountAddress = await createSmartAccount(embeddedWallet);
        };

        try {
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            phone: user.phone?.number,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
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


  const updateGoghUserWithSquareId = useCallback(async (squareCustomerId: string, appUser: User) => {
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
        setAppUser(data.updatedUser);
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
  }, [setAppUser, appUser]);

  const createNewSquareCustomer = useCallback(async (appUser: User) => {
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
  }, [currentUser, appUser, merchant?._id, updateGoghUserWithSquareId]);

  const findExistingSquareCustomer = useCallback(async (appUser: User) => {
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
  }, [currentUser, appUser, merchant, createNewSquareCustomer, updateGoghUserWithSquareId]);
  
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

  useEffect (() => {
    if (!merchant) return;

    let complementaryColorState;
    if (merchant.branding?.primary_color === '#000000') {
      complementaryColorState = "#8c8c8c"
    } else {
      complementaryColorState = getModifiedColor(merchant.branding?.primary_color || '#000000');
    }

    setcomplementaryColor(complementaryColorState)

    const transparentSecondaryColor = hexToRgba(merchant.branding?.secondary_color || '#FFFFFF', 0.6);
    setSecondaryColorWithTransparency(transparentSecondaryColor) 
  }, [merchant])

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
            await createNewRewards();
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

  return (
    <>
      {ready ? (
        !authenticated ? (
          !isFetchingMerchant ? (
            <Flex direction={'column'} justify={'center'} align={'center'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} style={{backgroundColor: primaryColor }}>
              <Avatar.Root>
                <Avatar.Image 
                  className="MerchantLogo"
                  src={merchant?.branding?.logo || '/logos/gogh_logo_black.svg'}
                  alt="Merchant Logo"
                  style={{objectFit: "contain", maxWidth: '200px'}}
                  />
              </Avatar.Root>

              <Button style={{
                  width: "250px",
                  backgroundColor: secondaryColor,
                  color: primaryColor,
                }} 
                onClick={handleLogin}>
                Log in
              </Button>

              <Button style={{
                  width: "250px",
                  backgroundColor: secondaryColor,
                  color: primaryColor,
                }} 
                onClick={handleSignup}>
                Create an account
              </Button>
            </Flex>
          ) : (
            <Flex justify={'center'} align={'center'} height={'100vh'}>
              <Spinner />
            </Flex>
          )
        ) : ( !isFetchingMerchant && !isFetchingCurrentUserRewards && isCheckingSquareDirectory === false && !errorCheckingSquareDirectory ) ? (
          <>
            <Flex 
              direction='column'
              minHeight='100vh'
              style={{
                background: primaryColor
              }}
            >
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
              <Flex
                flexGrow={'1'}
                pb={'7'}
                direction={'column'}
                gap={'5'}
                align={'center'}
                justify={'between'}
               
              >
                <Flex direction={'column'} width={'100%'}>
                  <Flex justify={'center'} style={{marginRight: '20px', marginLeft: '20px'}}>
                    <Flex direction={'column'} align={'center'} gap={'4'} px={'2'}>
                      {merchant?.branding?.logo ? (
                        <Flex height={'120px'} width={'80vw'} position={'relative'} direction={'column'} align={'center'} justify={'center'}
                          style={{maxHeight: '100px'}}
                        >
                          <Image
                            priority
                            src={merchant.branding.logo}
                            alt={merchant.name}
                            fill
                            sizes="(max-width: 200px) 50vw"
                            style={{
                              objectFit: 'contain',
                             // padding: '10px 50px',
                            }}
                          />
                        </Flex>
                      ) : (
                        <Heading style={{color: secondaryColor}}>{merchant?.name}</Heading>
                      )}
                     
                        {usersCurrentRewardsTier && (
                          <Flex direction={'column'} justify={'center'} width={'100%'}>
                            <Text weight={'bold'} align={'center'} size={'6'} style={{color: secondaryColor}}>Earning{' '}{usersCurrentRewardsTier.discount}% off</Text>
                          </Flex>
                        )}

                        {!usersCurrentRewardsTier || usersCurrentRewardsTier._id !== sortedMilestoneTiers[sortedMilestoneTiers.length - 1]?._id ? (
                          <Flex direction={'row'} 
                          width={'100%'} 
                          justify={'between'} align={'center'}>
                            <Text wrap={'wrap'} size={'5'} style={{color: secondaryColor}}>
                              Remaining until<br></br> next upgrade:
                            </Text>
                            <Text size={'5'} style={{color: secondaryColor}}>${amountToNextRewardsTier}</Text>
                          </Flex>
                        
                        ) : usersCurrentRewardsTier && usersCurrentRewardsTier._id === sortedMilestoneTiers[sortedMilestoneTiers.length - 1]?._id && (  
                          <Flex 
                            direction={'column'} 
                            align={'center'} justify={'center'}
                            p={'3'}
                            style={{backgroundColor: complementaryColor, borderRadius: '5px'}}
                          >
                            <Text weight={'bold'} size={'4'} align={'center'}
                              style={{color: secondaryColor}}
                            >
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
                          backgroundColor: tier._id === usersCurrentRewardsTier?._id ? complementaryColor : "",
                          borderStyle: 'solid',
                          borderColor: tier._id === usersCurrentRewardsTier?._id ? complementaryColor : secondaryColorWithTransparency,
                          borderWidth: '1px',
                          borderRadius: '8px',
                          flexShrink: 0,
                        }}
                      >
                        <Flex direction={'column'} gap={'3'} justify={'between'} align={'center'} height={'60px'} width={'100%'}>
                          <Text size={'5'} weight="bold" style={{color: tier._id === usersCurrentRewardsTier?._id ? secondaryColor : secondaryColorWithTransparency}}>
                            {tier.name}
                          </Text>
                          <Text size={'5'} style={{color: tier._id === usersCurrentRewardsTier?._id ? secondaryColor : secondaryColorWithTransparency}}>
                            {tier.discount}% off
                          </Text>
                        </Flex>
                      </Flex>
                    ))}
                  </Flex>
                </Flex>
              </Flex>
            </Flex>
          </>
        ) : isCheckingSquareDirectory === false && errorCheckingSquareDirectory ? (
          <Flex direction={'column'} gap={'4'} height={'100vh'} style={{
              background: primaryColor
            }}
          >
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
            <Text size={'7'} weight={'bold'} align={'center'} style={{color: secondaryColor}}>Oops!</Text>
            <Text align={'center'} style={{color: secondaryColor}}>{errorCheckingSquareDirectory}</Text>
          </Flex>
        ) : <Flex justify={'center'} align={'center'} height={'100vh'}>
              <Spinner />
            </Flex>
      ) : (
        <Flex justify={'center'} align={'center'} height={'100vh'}>
          <Spinner />
        </Flex>
      )}
    </>
  )
};


export default function MyMerchantRewards({ params }: { params: { merchantId: string } }) {
  return (
    <Suspense fallback={<Spinner />}>
      <MyMerchantRewardsContent params={params} />
    </Suspense>
  );
}