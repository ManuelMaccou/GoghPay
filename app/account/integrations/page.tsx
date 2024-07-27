'use client'

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, User } from "@/app/types/types";
import { Button, Flex, Heading, Link, Text } from "@radix-ui/themes";
import * as Avatar from '@radix-ui/react-avatar';
import { useEffect, useState } from "react";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}


export default function Integrations() {
  const [error, setError] = useState<string | null>(null);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [merchant, setMerchant] = useState<Merchant>();

  const { login, user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
  const squareEnv = process.env.NEXT_PUBLIC_SQUARE_ENV;

  const squareScopes = [
    'ITEMS_WRITE',
    'ITEMS_READ',
    'INVENTORY_WRITE',
    'INVENTORY_READ',
    'MERCHANT_PROFILE_READ',
    'ORDERS_WRITE',
    'PAYMENTS_WRITE',
    'ORDERS_READ',
    'PAYMENTS_WRITE',
    'PAYMENTS_WRITE_SHARED_ONFILE',
    'PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS',
    'PAYMENTS_READ',
  ];
  const scopeString = squareScopes.join('+');

  const squareAuthUrl = `https://connect.${squareEnv}.com/oauth2/authorize?client_id=${squareAppId}&scope=${scopeString}&session=false&state=82201dd8d83d23cc8a48caf52b`

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
  };

  const handleSetWalletForPurchase = (wallet: string | null) => {
    setWalletForPurchase(wallet);
  };

  useEffect(() => {
    const fetchMerchant = async (id: string) => {
      try {
        const privyId = id
        const response = await fetch(`/api/merchant/privyId/${privyId}`);
        const data = await response.json();
        setMerchant(data);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      }
    }

    const fetchUser = async () => {
      if (!ready || !user?.id) return;

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        const userData = await response.json();

        if (!response.ok) throw new Error(userData.message || 'Failed to fetch user');

        setCurrentUser(userData.user);
        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress;
        setWalletForPurchase(walletAddress);

        if (userData.user.merchant) {
          fetchMerchant(userData.user.privyId)
        }

      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to fetch user data');
      }
    };

    if (ready && authenticated) {
      fetchUser();
    }
  }, [ready, authenticated, user?.id]); 

  
  return (
    <Flex direction={'column'} gap={'4'} minHeight={'100vh'} width={'100%'} pb={'9'} pt={'6'} px={'5'}>  
      {ready && authenticated && (
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
            setCurrentUser={handleSetCurrentUser}
            setWalletForPurchase={handleSetWalletForPurchase}
          />
        </BalanceProvider>
      )}
      <Text size={'6'} weight={'bold'} style={{color: 'black'}}>Integrations</Text>
      <Flex direction={'column'} flexGrow={'1'} width={'100%'} justify={'start'} gap={'4'}>
        {ready && (
          authenticated ? (
            <>
              {currentUser && currentUser.merchant && (
                <>
                 <Flex direction={'column'} flexGrow={'1'} gap={'4'} align={'center'} p={'4'} style={{
                    boxShadow: 'var(--shadow-2)',
                    borderRadius: '10px'
                    }}>
                    <Avatar.Root>
                      <Avatar.Image 
                      className="SquareLogo"
                      src='/logos/Square_LogoLockup_Black.png'
                      alt="Square Integration"
                      style={{objectFit: "contain", maxWidth: '200px'}}
                      />
                    </Avatar.Root>

                    <Button asChild size={'4'} style={{width: '250px'}}>
                      <Link href={squareAuthUrl} target='_blank' rel='noopener noreferrer'>
                        Authenticate
                      </Link>
                    </Button>
                  </Flex>
                </>
              )}
            </>
          ) : (
            <Flex direction={'column'} height={'80vh'} align={'center'} justify={'center'} gap={'5'}>
              <Text align={'center'}>
                Please log in to view this page
              </Text>
              <Button size={'4'}
              style={{
                width: '250px',
                backgroundColor: '#0051FD'
              }}
              onClick={login}>
              Log in
            </Button>
            </Flex>
          )
        )}
      </Flex>
    </Flex>
  )


}