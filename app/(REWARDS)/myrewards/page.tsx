'use client'

import { Header } from "@/app/components/Header";
import { useRouter } from 'next/navigation';
import { useUser } from "@/app/contexts/UserContext";
import { User, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { Avatar, Box, Button, Callout, Card, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import Image from "next/image";
import { useEffect, useState } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import * as Sentry from '@sentry/nextjs';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

interface Reward {
  _id: string;
  customerId: string;
  merchantId: string;
  merchantInfo: {
    name: string;
    branding: {
      primary_color: string;
      secondary_color: string;
      logo: string;
    };
  };
}

export default function MyRewards() {
  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [isFetchingCurrentUsersRewards, setIsFetchingCurrentUsersRewards] = useState<boolean>(true);
  const [currentUserRewards, setCurrentUserRewards] = useState<Reward[]>([])

  const [error, setError] = useState<string | null>(null);

  const { appUser } = useUser();
  const router = useRouter();


  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress || null;
      setWalletForPurchase(walletAddress);
      setCurrentUser(appUser);
    }
  }, [appUser]);

  useEffect(() => {
    const fetchCurrentUsersRewards = async () => {
      if (!ready || !authenticated || !appUser) return;
      console.log('app user:', appUser);
  
      const accessToken = await getAccessToken();
      setIsFetchingCurrentUsersRewards(true);
  
      try {
        const response = await fetch(
          `/api/rewards/userRewards/customer?customerId=${appUser._id}&privyId=${appUser.privyId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
  
        if (response.ok) {
          if (response.status === 204) {
            setCurrentUserRewards([]);
          } else {
            const userRewardsData = await response.json();
            setCurrentUserRewards(userRewardsData);
          }
        } else {
          switch (response.status) {
            case 401:
              throw new Error("Unauthorized. Please check your credentials.");
            case 403:
              throw new Error("Forbidden. You don't have access to this resource.");
            case 404:
              throw new Error("Rewards not found.");
            default:
              throw new Error(`Unexpected error: ${response.statusText}`);
          }
        }
      } catch (error: unknown) {
        Sentry.captureException(error);
        if (isError(error)) {
          console.error("Failed to fetch user rewards:", error.message);
          setError(`Failed to fetch rewards: ${error.message}`);
        } else {
          console.error("An unknown error occurred:", error);
          setError("An unknown error occurred while fetching rewards.");
        }
      } finally {
        setIsFetchingCurrentUsersRewards(false);
      }
    };
  
    fetchCurrentUsersRewards();
  }, [ready, authenticated, appUser]);

  useEffect(() => {
    if (ready && !authenticated) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 3000);
    

      return () => clearTimeout(timer);
    }
  }, [ready, authenticated, router]);
  
  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'black'
      }}
    >
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
        <Heading size={'8'} style={{color: "white"}}>My Rewards</Heading>
          <Header
            color={"white"}
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
      </Flex>

      <Flex
        flexGrow={'1'}
        py={'7'}
        gap={'3'}
        direction={'column'}
        justify={'start'}
        align={'center'}
        height={'calc(100vh - 120px)'}
        overflowY={'auto'}
        style={{
          backgroundColor: '#282828',
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)'
        }}
      >
        {error && (
          <Callout.Root color="red">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {ready && authenticated ? (
          !isFetchingCurrentUsersRewards ? (
            currentUserRewards.length > 0 ? (
              currentUserRewards.map((reward) => (
                <Link key={reward._id} href={`/myrewards/${reward.merchantId}`}>
                <Flex 
                  key={reward._id}
                  position={'relative'}
                  direction={'column'}
                  width={'80vw'}
                  minHeight={'120px'}
                  align={'center'}
                  justify={'center'}
                  p={'9'}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: reward.merchantInfo?.branding?.primary_color || "#000000",
                  }}
                >
                  {reward.merchantInfo?.branding?.logo ? (
                    <Image
                    priority
                    src={reward.merchantInfo?.branding?.logo}
                    alt={reward.merchantInfo?.name || 'Merchant logo'}
                    fill
                    sizes="(max-width: 200px) 50vw,"
                    style={{
                      objectFit: 'contain',
                      padding: '10px 50px',
                    }}
                  />

                  ): (
                    <Text style={{color: 'white'}}>{reward.merchantInfo?.name ? reward.merchantInfo?.name : ''}</Text>
                  )}
                  
                </Flex>
                </Link>
              ))
            ) : (
              <>
              <Flex direction={'column'} justify={'center'} align={'center'} px={'4'} height={'50%'}>
                <Text 
                  size={'6'} align={'center'} style={{color: 'white'}}
                >
                  You&apos;re ready to start earning your first rewards!
                  Visit a participating merchant to start.
                </Text>
              </Flex>
              </>
            )
          ) : (
            <>
              <Text size={'4'} style={{color: 'white'}}>Fetching rewards</Text>
              <Spinner style={{color: 'white'}} />
            </>
          )

          
        ) : ready && !authenticated && (
          <Flex direction={'column'} align={'center'} justify={'center'}>
            <Text size={'4'} align={'center'} style={{color: 'white'}}>Please log in first</Text>
            <Text size={'4'} align={'center'}  style={{color: 'white'}}>Redirecting...</Text>
          </Flex>
        )}
        
      </Flex>
    </Flex>
  );
}