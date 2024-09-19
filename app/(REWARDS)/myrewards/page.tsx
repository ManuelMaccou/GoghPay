'use client'

import { Header } from "@/app/components/Header";
import { useUser } from "@/app/contexts/UserContext";
import { User, UserReward } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { Card, Flex, Heading, Link, Spinner, Text } from "@radix-ui/themes";
import Image from "next/image";
import { useEffect, useState } from "react";


function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

interface CustomMerchantDetails {
  merchantName: string | null;
  merchantLogo: string | null;
  merchantPrimaryColor: string | null;
  merchantSecondaryColor: string | null;
}

interface CustomUserReward extends UserReward, CustomMerchantDetails {}

export default function ManageRewards() {
  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [isFetchingCurrentUsersRewards, setIsFetchingCurrentUsersRewards] = useState<boolean>(true);
  const [currentUserRewards, setCurrentUserRewards] = useState<CustomUserReward[]>([])

  const { appUser } = useUser();

  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  useEffect(() => {
    const fetchCurrentUsersRewards = async() => {
      if (!ready || !authenticated) return;
      if (!appUser) return;

      setIsFetchingCurrentUsersRewards(true);
      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/rewards/userRewards/customer/?customerId=${appUser._id}&privyId=${user?.id}`, {
          next: {revalidate: 1},
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        if (!response.ok) {
          setIsFetchingCurrentUsersRewards(false);
          throw new Error('Failed to fetch user rewards');
        }

        if (response.status === 204) {
          setIsFetchingCurrentUsersRewards(false);
          setCurrentUserRewards([])
        }
        const data = await response.json();
        console.log('fetched users rewards:', data)
        setCurrentUserRewards(data);
        setIsFetchingCurrentUsersRewards(false);
        
      } catch (error) {
        setIsFetchingCurrentUsersRewards(false);
        console.error('Error fetching user:', error);
      }
    }

    if (ready && user) {
      fetchCurrentUsersRewards();
    }
  }, [appUser, authenticated, ready])


  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress || null;
      setWalletForPurchase(walletAddress);
    }
  }, [appUser]);

  
  return (
    <>
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
            px={'4'}
            direction={'column'}
            align={'center'}
            height={`calc(100vh - 120px)`}
            overflowY={'scroll'}
            style={{
              borderRadius: '20px 20px 0px 0px',
              backgroundColor: '#282828',

            }}
          >
            {ready ? (
              authenticated && (
                !isFetchingCurrentUsersRewards ? (
                  currentUserRewards ? (
                    <Flex direction={'column'} gap={'3'} height={'100%'}>
                      {currentUserRewards.map((reward) => (
                        <Link key={reward.merchantId} href={`/myrewards/${reward.merchantId}`}>
                           <Card 
                          variant="ghost"
                          style={{
                            backgroundColor: reward.merchantPrimaryColor ? reward.merchantPrimaryColor : '#000000',
                            borderRadius: '20px',
                            boxShadow: 'var(--shadow-6)',
                          }}>
                          <Flex direction={'column'} align={'center'} width={'80vw'} p={'9'} position={'relative'}>
                            {reward.merchantLogo ? (
                              <Image
                                priority={true}
                                src={reward.merchantLogo}
                                alt={reward.merchantName || 'Merchant logo'}
                                fill
                                style={{
                                  display: 'block',
                                  objectFit: 'contain',
                                  paddingRight: '50px',
                                  paddingLeft: '50px',
                                  justifySelf: 'center'
                                }}
                              />
                            ) : (
                              <Text size={'6'}>{reward.merchantName || ''}</Text>
                            )}
                          
                          </Flex>
                        </Card>

                        </Link>
                       
                      ))}
                    </Flex>
                  ) : (
                    <>
                      <Heading>No rewards yet</Heading>
                      <Image
                        priority={true}
                        src={'/norewards.png'}
                        alt={'no rewards'}
                        width={435}
                        height={458}
                      />
                    </>
              
                  )


                ) : (
                  <Spinner />
                )
              )

            ) : (
              <Spinner />
            )}
          </Flex>
      </Flex>
          </>
  );
}