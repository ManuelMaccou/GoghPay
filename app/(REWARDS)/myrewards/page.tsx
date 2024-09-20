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

export default function ManageRewards() {
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
  
        // Handle non-JSON responses or failed `response.json()` calls
        let responseData: Reward[];
        try {
          responseData = await response.json();
        } catch (jsonError) {
          console.error("Failed to parse JSON response", jsonError);
          throw new Error("Invalid JSON received from the server");
        }
  
        if (response.ok) {
          // Successful response with valid rewards data
          setCurrentUserRewards(responseData);
        } else if (response.status === 204) {
          // No content scenario: treat it as an empty rewards list
          setCurrentUserRewards([]);
        } else {
          // Handle specific error statuses, for example, 401 Unauthorized or 403 Forbidden
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
        // Use isError helper to check if it's an instance of Error and has a message
        if (isError(error)) {
          console.error("Failed to fetch user rewards:", error.message);
          setError(`Failed to fetch rewards: ${error.message}`);
        } else {
          console.error("An unknown error occurred:", error);
          setError("An unknown error occurred while fetching rewards.");
        }
      } finally {
        // Ensure the loading state is reset no matter the outcome
        setIsFetchingCurrentUsersRewards(false);
      }
    };
  
    fetchCurrentUsersRewards();
  }, [ready, authenticated, appUser]);
  

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
                    <Text>{reward.merchantInfo?.name ? reward.merchantInfo?.name : ''}</Text>
                  )}
                  
                </Flex>
                </Link>
              ))
            ) : (
              <>
              <Flex direction={'column'}>
              <Text size={'4'} align={'center'} style={{color: 'white'}}>No rewards yet.</Text>
                <Flex 
                  position={'relative'}
                  direction={'column'}
                  width={'80vw'}
                  minHeight={'120px'}
                  align={'center'}
                  justify={'center'}
                  p={'9'}
                >
                  <Image
                    priority
                    src={'/norewards.png'}
                    alt={'No rewards'}
                    fill
                    sizes="(max-width: 200px) 50vw,"
                    style={{
                      objectFit: 'contain',
                      padding: '10px 50px',
                    }}
                  />
                </Flex>
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
          <Button variant="ghost" style={{ width: '250px', color: "white" }} size={'4'}  onClick={() => router.push("/")}>
            Please log in to view this page
          </Button>
        )}
        
      </Flex>
    </Flex>
  );
}