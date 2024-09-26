'use client'

import { debounce } from 'lodash';
import { useRouter } from 'next/navigation';
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, RewardsTier, User, UserReward } from "@/app/types/types";
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
import { getComplementaryColor, hexToRgba } from '@/app/utils/getComplementaryColor';


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
  

  const [code, setCode] = useState<string | null>(null);

  const searchParams = useSearchParams();

  const merchantId = params.merchantId

  useEffect(() => {
    const codeParam = searchParams.get('code');

    setCode(codeParam);
  }, [searchParams]);


  const handleLogin = () => {
    login({ loginMethods: ['google', 'email'] });
  };

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      console.log('login successful');

      const embeddedWallet = getEmbeddedConnectedWallet(wallets);

      let smartAccountAddress;

      if (isNewUser) {
        if (embeddedWallet) {
          smartAccountAddress = await createSmartAccount(embeddedWallet);
        };

        try {
          console.log('smart account address:', smartAccountAddress);
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          console.log('New user created:', response.data);
          if (response.status >= 200 && response.status < 300) {
            console.log('New user created:', response.data);
            setAppUser(response.data.user);
          } else {
            setErrorCheckingSquareDirectory('There was an issue logging in. Please try again.');
            console.error('Unexpected response status:', response.status, response.statusText);
          }

        } catch (error: unknown) {
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


  const updateGoghUserWithSquareId = useCallback(async (squareCustomerId: string) => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          squareCustomerId: squareCustomerId,
          privyId: currentUser?.privyId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.updatedUser);
      } else {
        const errorMessage = await response.text();
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Failed to update Gogh user: ${errorMessage}`);
      }

    } catch (err) {
      if (isError(err)) {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Error syncing Square customer with Gogh: ${err.message}`);
      } else {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error('Error syncing Square customer with Gogh');
      }
    }
  }, [setAppUser, currentUser]);

  const createNewSquareCustomer = useCallback(async () => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/square/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          email: currentUser?.email,
          merchantId: merchant?._id,
          goghUserId: currentUser?._id, // saved in Square as a referenceID
          privyId: currentUser?.privyId,
          note: "Gogh rewards"
        }),
      });

      if (response.ok) {
        const data = await response.json();

        await updateGoghUserWithSquareId(data.newSquareCustomer?.id)
      } else if (response.status === 503) {
        setErrorCheckingSquareDirectory('The was an error checking in. Please wait a few minutes and try again.');
      } else if (response.status === 401) {
        setErrorCheckingSquareDirectory('Unauthorized.');
      } else {
        const errorMessage = await response.text();
        console.error(`Failed to create Square customer: ${errorMessage}`);
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      }
    } catch (err) {
      if (isError(err)) {
        console.error(`Error creating new square customer: ${err.message}`);
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      } else {
        console.error('Error creating new square customer.');
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
      }
    }
  }, [currentUser, merchant?._id, updateGoghUserWithSquareId]);

  const findExistingSquareCustomer = useCallback(async () => {
    console.log("is finding existing customer")

    if (!currentUser || !currentUser?.email) return

    try {
      const encodedEmail = encodeURIComponent(currentUser.email);
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/square/user?email=${encodedEmail}&merchantId=${merchant?._id}&privyId=${currentUser.privyId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Update the user with the returned customer ID
        if (data.customers && data.customers.length > 0) {
          await updateGoghUserWithSquareId(data.customers[0].id);
        } else {
          await createNewSquareCustomer();
        }

      } else if (response.status === 404) {
        // Add the user to Square.
        await createNewSquareCustomer();
      } else {
        const errorMessage = await response.text();
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Error searching Square directory: ${errorMessage}`);
      }

    } catch (err) {
      if (isError(err)) {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error(`Error searching Square directory: ${err.message}`);
      } else {
        setErrorCheckingSquareDirectory('Failed to check in. Please re-scan QR code and try again.');
        console.error('Error searching Square directory');
      }
    } finally {
      setIsCheckingSquareDirectory(false);
    }
  }, [currentUser, merchant, createNewSquareCustomer, updateGoghUserWithSquareId]);
  
  useEffect(() => {
    if (!merchant?.square) {
      setIsCheckingSquareDirectory(false);
      return;
    };
    console.log('ischeckingsquaredirectory:', isCheckingSquareDirectory)
    // Run the API sync only if `currentUser` is available and has not been synced yet
    if (!currentUser) return;
    if (currentUser && !currentUser?.email) {
      setErrorCheckingSquareDirectory('Please connect using an email address to participate in Rewards')
      return;
    }

    if (currentUser?.squareCustomerId) {
      setIsCheckingSquareDirectory(false);
      return;
    }

    if (!hasSynced && !isCheckingSquareDirectory) {
      if (!isCheckingMerchantToken && merchantTokenIsValid) {
        setIsCheckingSquareDirectory(true);

        findExistingSquareCustomer().then(() => {
          setHasSynced(true);
          setIsCheckingSquareDirectory(false);
          
        });
      } else if (!isCheckingMerchantToken && !merchantTokenIsValid) {
        console.error('There was an error. Please have the seller reconnect to Square from their Gogh account.')
        setErrorCheckingSquareDirectory('There was an error. Please have the seller reconnect to Square from their Gogh account.')
      }
      
    }
  }, [merchant, currentUser, hasSynced, isCheckingSquareDirectory, findExistingSquareCustomer, merchantTokenIsValid, isCheckingMerchantToken]);
    
  useEffect(() => {
    if (merchantId) {
      console.log('mechant ID when fetching merchant:', merchantId)
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
      complementaryColorState = getComplementaryColor(merchant.branding?.primary_color || '#000000');
    }

    setcomplementaryColor(complementaryColorState) // Border and text of current tier

    const transparentSecondaryColor = hexToRgba(merchant.branding?.secondary_color || '#FFFFFF', 0.6);
    setSecondaryColorWithTransparency(transparentSecondaryColor) // Border and text of other tiers
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
      console.log('no existing rewards. Creating new one')

      const accessToken = await getAccessToken();
      try {
        console.log('customerID:', currentUser._id);
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

        if (response.ok) {
          const userRewardsData = await response.json();

          if (userRewardsData?.userReward) {
            setCurrentUserMerchantRewards(userRewardsData.userReward);
          } else {
            console.error('No valid user reward data returned');
          }
        } else {
          console.error('Failed to create new reward:', response.statusText);
        }
      } catch (error: unknown) {
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
            console.log('creating new reward')
            await createNewRewards();
          } else {
            const userRewardsData = await response.json();
            setCurrentUserMerchantRewards(userRewardsData);
          }
        } else {
          console.error('Failed to fetch rewards:', response.statusText);
        }
      } catch (error: unknown) {
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

      console.log('checking milestones')
      console.log('CurrentUserMerchantRewards:', currentUserMerchantRewards);
      console.log('CurrentUserMerchantRewards total spent:', currentUserMerchantRewards?.totalSpent);

      if (!merchant) return;
      console.log('checkpoint 1')

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
      console.log('Highest tier met:', highestTier);
      console.log('Next milestone:', nextMilestone);

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
                Contiue
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
                        <Flex direction={'column'} gap={'3'} justify={'between'} align={'center'} height={'60px'} width={'auto'}>
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