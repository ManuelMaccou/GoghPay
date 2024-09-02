"use client"

import { debounce } from 'lodash';
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, RewardsTier, User, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import * as Avatar from '@radix-ui/react-avatar';
import { Button, Callout, Card, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/contexts/UserContext";
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import axios from "axios";
import { checkAndRefreshToken } from "@/app/lib/refresh-tokens";
import { InfoCircledIcon } from '@radix-ui/react-icons';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function MyMerchantRewards({ params }: { params: { merchantId: string } }) {  
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const { appUser, setIsFetchingUser, setAppUser } = useUser();

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

  const merchantId = params.merchantId


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
        }
        return;
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
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress;
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

        await updateGoghUserWithSquareId(data.newSquareCustomer.id)
      } else if (response.status === 503) {
        setErrorCheckingSquareDirectory('The was an error with Square. Please wait a few minutes and try again.');
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
        if (data.customers.length > 0) {
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
  }, [currentUser, hasSynced, isCheckingSquareDirectory, findExistingSquareCustomer, merchantTokenIsValid, isCheckingMerchantToken]);
    
  useEffect(() => {
    if (merchantId) {
      setIsFetchingMerchant(true);
      const fetchMerchant = async () => {
        try {
          const response = await fetch(`/api/merchant/${merchantId}`);
          const data:Merchant = await response.json();
          setMerchant(data);
          setPrimaryColor(data.branding.primary_color);
          setSecondaryColor(data.branding.secondary_color);
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
      if (!currentUser) return;
      console.log('no existing rewards. Creating new one')

      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/rewards/userRewards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({ 
            privyId: currentUser?.privyId,
            userId: currentUser._id,
            merchantId: merchantId,
            totalSpent: 0,
            visitsCount: 1,
            lastVisit: new Date().toISOString(),
          })
        });

        if (response.ok) {
          const userRewardsData = await response.json();
          setCurrentUserMerchantRewards(userRewardsData.userReward);
          console.log('user rewards after creating new one:', userRewardsData.userReward);
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
        const response = await fetch(`/api/rewards/userRewards/${merchantId}?currentUserId=${currentUser._id}&privyId=${currentUser.privyId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        if (response.ok) {
          const userRewardsData = await response.json();
          console.log('rewards datat from get:', userRewardsData)
          setCurrentUserMerchantRewards(userRewardsData);
        } else {
          if (response.status === 404) {
            await createNewRewards();
          } else {
            console.error('Failed to fetch rewards:', response.statusText);
          }
        }

      } catch (error: unknown) {
        if (isError(error)) {
          console.error('Error fetching merchant rewards:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      } finally {
        setIsFetchingCurrentUserRewards(false);
      }
    };

    if (ready && authenticated && currentUser) {
      fetchCurrentUserMerchantRewards();
    }
  }, [authenticated, ready, currentUser, merchantId]);

  useEffect (() => {
    const checkMilestone = () => {

      console.log('checking milestones')
      console.log('CurrentUserMerchantRewards:', currentUserMerchantRewards);
      console.log('CurrentUserMerchantRewards total spent:', currentUserMerchantRewards?.totalSpent);

      if (!merchant) return;
      console.log('checkpoint 1')

      if (!currentUserMerchantRewards) {
        console.log('No user rewards available.');
        return null;
      }
      console.log('checkpoint 2')

      const totalSpent = currentUserMerchantRewards.totalSpent;
      console.log('total spent after definition:', totalSpent)

      if (totalSpent === null || totalSpent === undefined) return;
      console.log('checkpoint 3')
      console.log ('total spent is null/undefined')
    
      const tiers = merchant?.rewards?.tiers || [];
    
      if (!tiers.length) {
        console.log('No tiers configured')
        setErrorCheckingSquareDirectory("Seller does not have rewards available.")
        return null;
      }
      console.log('checkpoint 4')
    
      const sortedTiers = tiers.sort((a, b) => a.milestone - b.milestone);
    
      let highestTier = null;
      let nextMilestone = null;
    
      for (const tier of sortedTiers) {
        if (totalSpent >= tier.milestone) {
          highestTier = tier;
        } else {
          nextMilestone = tier.milestone;
          break; 
        }
      }
      console.log('Highest tier met:', highestTier);
      console.log('Next milestone:', nextMilestone);

      const amountToNextTier = nextMilestone ? nextMilestone - totalSpent : null;

      setUsersCurrentRewardsTier(highestTier);
      setAmountToNextRewardsTier(amountToNextTier)
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

  return (
    <>
      {ready ? (
        !authenticated ? (
          !isFetchingMerchant ? (
            <Flex direction={'column'} justify={'center'} align={'center'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} style={{backgroundColor: primaryColor }}>
              <Avatar.Root>
                <Avatar.Image 
                className="MerchantLogo"
                src={merchant?.branding.logo }
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
          
        ) : ( !isFetchingMerchant && !isFetchingCurrentUserRewards ) ? (
          <>
            <Flex direction={'column'} gap={'5'} height={'100vh'}>
              <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'} style={{ backgroundColor: primaryColor }}>
                <Avatar.Root>
                  <Avatar.Image 
                  className="MerchantLogo"
                  src={merchant?.branding.logo }
                  alt="Merchant Logo"
                  style={{objectFit: "contain", maxWidth: '200px'}}
                  />
                </Avatar.Root>
                <BalanceProvider walletForPurchase={walletForPurchase}>
                  <Header
                    color={secondaryColor}
                    merchant={currentUser?.merchant}
                    embeddedWallet={embeddedWallet}
                    authenticated={authenticated}
                    walletForPurchase={walletForPurchase}
                    currentUser={currentUser}
                  />
                </BalanceProvider>
              </Flex>

              <Flex direction={'column'} justify={'between'} align={'center'} height={'100%'} gap={'4'} px={'6'} mb={'9'}>
                <Flex direction={'column'} align={'center'} gap={'4'} width={'100%'}>
                  {usersCurrentRewardsTier ? (
                    <Heading>{usersCurrentRewardsTier.name}</Heading>
                  ) : (
                    <Heading size={'8'}>Welcome</Heading>
                  )}
                  <Flex direction={'row'} width={'100%'} justify={'between'} align={'center'}>
                    <Text wrap={'wrap'} size={'5'} weight={'bold'} style={{maxWidth: '200px'}}>Remaining until next upgrade:</Text>
                    <Text size={'8'}>${amountToNextRewardsTier}</Text>
                  </Flex>
                 </Flex> 
                <Flex direction={'column'} align={'end'} width={'100vw'} maxHeight={'50vh'} overflow={'scroll'} gap={'3'} ref={rewardsContainerRef}>
                  {merchant?.rewards?.tiers
                  .sort((a, b) => b.milestone - a.milestone)
                  .map((tier) => (
                    <Card key={tier._id}
                    ref={tier._id === usersCurrentRewardsTier?._id ? targetCardRef : null}
                    variant='classic'
                      style={{
                        flexShrink: 0,
                        width: tier._id === usersCurrentRewardsTier?._id ? '85%' : '70%',
                        backgroundColor: tier._id === usersCurrentRewardsTier?._id ? primaryColor : 'transparent'
                      }}
                    >
                      <Flex direction={'row'} gap={'3'} width={'100%'} justify={'between'} align={'center'} height={'80px'} pr={'4'}>
                        <Text size={'5'} weight="bold">
                          {tier.name}
                        </Text>
                        <Text size={'5'}>
                          {tier.discount}% off
                        </Text>
                      </Flex>
                    </Card>
                  ))}
                </Flex>
                <Flex>
                  {!errorCheckingSquareDirectory ? (
                   isCheckingSquareDirectory === false ? (
                    usersCurrentRewardsTier ? (
                      <Text align={'center'} weight={'bold'} size={'7'}>You&apos;re checked in and earning {usersCurrentRewardsTier.discount}% off!</Text>
                    ) : (
                      <Text align={'center'} weight={'bold'} size={'7'}>You&apos;re checked in!</Text>
                    )
                  ) :  (
                    <Text align={'center'} weight={'bold'} size={'7'}>Checking in...</Text>
                  )
                ) : (
                  <Callout.Root color='red'>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      {errorCheckingSquareDirectory}
                    </Callout.Text>
                  </Callout.Root>
                )}
                  
                  
                </Flex>
              </Flex>
            </Flex>
          </>
        ) : (
          <Flex justify={'center'} align={'center'} height={'100vh'}>
            <Spinner />
          </Flex>
        )
      ) : (
        <Flex justify={'center'} align={'center'} height={'100vh'}>
          <Spinner />
        </Flex>
      )}
    </>
  )
}