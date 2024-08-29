"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, User, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import * as Avatar from '@radix-ui/react-avatar';
import { Button, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useUser } from "@/app/contexts/UserContext";
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import axios from "axios";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function MyMerchantRewards({ params }: { params: { merchantId: string } }) {  
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const { appUser, setIsFetchingUser } = useUser();

  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User>();
  const [isFetchingMerchant, setIsFetchingMerchant] = useState<boolean>(true);
  const [currentUserRewards, setCurrentUserMerchantRewards] = useState<UserReward | null>(null);
  const [isFetchingCurrentUserRewards, setIsFetchingCurrentUserRewards] = useState<boolean>(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);

  const [primaryColor, setPrimaryColor] = useState<string>("#FFFFFF");
  const [secondaryColor, setSecondaryColor] = useState<string>("#000000");

  const merchantId = params.merchantId

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
          setCurrentUserMerchantRewards(userRewardsData);
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
  }, [authenticated, ready, currentUser]);

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

  return (
    <>
      <Flex
        direction={'column'}
        justify={authenticated ? 'start' : 'center'}
        align={authenticated ? 'start' : 'center' }
        pt={'6'} pb={'4'} px={'4'} gap={'5'}
        height={ (!authenticated || isFetchingCurrentUserRewards) ? '100vh' : 'auto'}
        style={{backgroundColor: primaryColor }}
      >
        {isFetchingCurrentUserRewards && <Spinner style={{color: isFetchingCurrentUserRewards ? secondaryColor : primaryColor}} />}
        
        {ready && !authenticated ? (
          <>
            {isFetchingMerchant && <Spinner />}
            
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
              onClick={login}>
              Contiue
            </Button>
          </>
        ) : ready && authenticated && (
          <Flex direction={'row'} justify={'between'} width={'100%'}>
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
        )}
      </Flex>

      {ready && authenticated && !isFetchingCurrentUserRewards && !isFetchingMerchant && (
        <Flex direction={'column'} align={'center'} mt={'6'}>
          {currentUserRewards?.currentTier ? (
            <Heading>{currentUserRewards.currentTier}</Heading>
          ) : (
            <Heading>Welcome</Heading>
          )}
        </Flex>
      )}
    </>
  );
}