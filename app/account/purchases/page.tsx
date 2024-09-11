"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { User, Transaction } from "@/app/types/types";
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeftIcon, BellIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Table, Text, TextField } from "@radix-ui/themes";
import axios from "axios";
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Sales({ params }: { params: { userId: string } }) {
  const { ready, authenticated, user } = usePrivy();
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [ isFetchingCurrentUser, setIsFetchingCurrentUser ] = useState(true);
  const [currentUser, setCurrentUser] = useState<User>();
  const [ isFetchingTransactions, setIsFetchingTransactions ] = useState(true);
  const [totalTransactions, setTotalTransactions] = useState<Transaction[] | null>(null);
  const [noPurchases, setNoPurchases] = useState(false); 
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const { wallets } = useWallets();

  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const wallet = wallets[0]
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : 8453;

  const router = useRouter();

  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {

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
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          setCurrentUser(response.data.user)
          const walletAddress = response.data.user.smartAccountAddress || response.data.user.walletAddress;
          setWalletForPurchase(walletAddress);
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
              console.error('Error fetching user details:', error.response?.data?.message || error.message);
          } else if (isError(error)) {
              console.error('Unexpected error:', error.message);
          } else {
              console.error('Unknown error:', error);
          }
        }
      }
      
      if (chainIdNum !== null && chainId !== `eip155:${chainIdNum}`) {
        try {
          await wallet.switchChain(chainIdNum);
        } catch (error: unknown) {
          console.error('Error switching chain:', error);
      
          if (typeof error === 'object' && error !== null && 'code' in error) {
            const errorCode = (error as { code: number }).code;
            if (errorCode === 4001) {
              alert('You need to switch networks to proceed.');
            } else {
              alert('Failed to switch the network. Please try again.');
            }
          } else {
            console.log('An unexpected error occurred.');
          }
          return;
        }
      };
    },
    onError: (error) => {
      console.error("Privy login error:", error);
    },
  });


  const getPaymentTypeInfo = (paymentType: string) => {
    const types: { [key: string]: { label: string; color: string } } = {
      'sponsored crypto': { label: 'Crypto', color: '#8E004B' },
      'crypto': { label: 'Crypto', color: '#8E004B' },
      'mobile pay': { label: 'Mobile Pay', color: '#2196F3' },
      'Venmo': { label: 'Venmo', color: '#0084F7' },
      'ManualEntry': { label: 'Manual CC', color: '#ea7100' },
      'Cash': { label: 'Cash', color: '#4CAF50' },
      'Square': { label: 'Square', color: '#000000' },
      'Zelle': { label: 'Zelle', color: '#6C1CD3' },
    };
    return types[paymentType] || { label: 'Unknown', color: '#9E9E9E' };
  };


  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      try {
        setIsFetchingCurrentUser(true);
        const response = await fetch(`/api/user/me/${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setCurrentUser(userData.user);
        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress;
        setWalletForPurchase(walletAddress);
        
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsFetchingCurrentUser(false);
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
    }
  }, [authenticated, ready, user]);

  useEffect(() => {
    if (!embeddedWallet) return;
    if (!currentUser) return;
    if (currentUser.smartAccountAddress) return;

    const addSmartAccountAddress = async () => {
      const accessToken = await getAccessToken();
      try {
        const smartAccountAddress = await createSmartAccount(embeddedWallet);

        if (!smartAccountAddress) {
          throw new Error('Failed to create smart account.');
        }

        const response = await fetch('/api/user/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            smartAccountAddress: smartAccountAddress,
            privyId: user?.id
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create smart account');
        }
        console.log('successfully added smart account')
        
      } catch (error) {
        console.error('Error adding smart account:', error);
      } finally {
        
      }
    };

    if (user && embeddedWallet && currentUser && !currentUser.smartAccountAddress) {
      addSmartAccountAddress();
    }
  }, [user, currentUser, embeddedWallet]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentUser) return;
      try {
        setIsFetchingTransactions(true)
        const response = await fetch(`/api/transaction/buyer/${currentUser._id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setNoPurchases(true)
          }
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const { totalTransactions } = await response.json();
        console.log('totalTransactions:', totalTransactions);

        // Sort totalTransactions by date in descending order
        const sortedTotalTransactions = totalTransactions.slice().sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setTotalTransactions(sortedTotalTransactions);

      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching buyer transactions: ${err.message}`);
        } else {
          setError('Error fetching buyer transactions');
        }
      } finally {
        setIsFetchingTransactions(false);
      }
    };

    if (currentUser) {
      fetchTransactions();
    }
  }, [currentUser]);

  return (
    <>
    <Flex
        direction='column'
        position='relative'
        minHeight='100vh'
        width='100%'
        style={{
          background: 'linear-gradient(to bottom, #1e5799 0%,#2989d8 50%,#207cca 51%,#7db9e8 100%)'
        }}
      >
         <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
          <Heading size={'8'} style={{color: "white"}}>Purchases</Heading>
        
          <BalanceProvider walletForPurchase={walletForPurchase}>
            <Header
              color={"white"}
              merchant={currentUser?.merchant}
              embeddedWallet={embeddedWallet}
              authenticated={authenticated}
              walletForPurchase={walletForPurchase}
              currentUser={currentUser}
            />
          </BalanceProvider>
        </Flex>
        <Flex
          flexGrow={'1'}
          py={'7'}
          px={'4'}
          gap={'4'}
          direction={'column'}
          align={'center'}
          height={'100%'}
          style={{
            backgroundColor: 'white',
            borderRadius: '20px 20px 0px 0px',
            boxShadow: 'var(--shadow-6)'
          }}
        > 
          {ready ? (
              authenticated ? (
                isFetchingTransactions ? (
                  <>
                    <Text>Fetching purchases</Text>
                    <Spinner />
                  </>
                  ) : !noPurchases ? (
                    <Flex direction={'column'} gap={'4'} justify={'start'} width={'100%'}>
                      <Box overflow={'scroll'}>
                        <Table.Root>
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                            </Table.Row>
                          </Table.Header>

                          <Table.Body>
                            {totalTransactions?.map((transaction) => {
                              const { label, color } = getPaymentTypeInfo(transaction.payment.paymentType);
                              return (
                                <Table.Row key={transaction._id}>
                                  <Table.RowHeaderCell>${((transaction.product.price)+(transaction.payment.tipAmount || 0)+(transaction.payment.salesTax)).toFixed(2)}</Table.RowHeaderCell>
                                  <Table.Cell>
                                    <Text wrap={'nowrap'}>
                                      {transaction.merchant.name}: {transaction.product.name}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Badge radius="large" style={{ backgroundColor: color, color: 'white', padding: '3px 7px 3px 7px'}}>{label}</Badge>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text wrap={'nowrap'}>
                                      {format(new Date(transaction.createdAt), 'MMM dd, yyyy')}
                                    </Text>
                                  </Table.Cell>
                                </Table.Row>
                              );
                            })}
                          </Table.Body>
                        </Table.Root>
                      </Box>
                    </Flex>
                  ) : (
                <>
                  <Heading size={'5'}>No purchases yet</Heading>
                  <Callout.Root color="yellow">
                    <Callout.Icon>
                      <BellIcon />
                    </Callout.Icon>
                    <Callout.Text>
                        You haven&apos;t made any purchases yet. If you think this is a mistake,{" "}
                        <Link 
                          href='mailto:payments@ongogh.com?subject=Purchases%20inquiry&body=Hello%2C%0A%0AI%20don%27t%20see%20expected%20purchases%20listed%20in%20my%20account.%20Here%20are%20my%20details%3A%0A%0AEmail%20address%3A%20%5B%20ENTER%20EMAIL%20%5D%0A%0APurchase%20method%3A%20%5B%20ENTER%20%22CREDIT%20CARD%22%2C%20%22APPLE%20PAY%22%2C%20%22GOOGLE%20PAY%22%2C%20%22CRYPTO%22%20%5D%20%0A%0ACrypto%20wallet%20address%3A%20%5B%20ENTER%20WALLET%20ADDRESS%20IF%20APPLICABLE%20%5D%0A%0A%5B%20ENTER%20ANY%20OTHER%20DETAILS%20%5D' 
                          target='_blank' 
                          rel='noopener noreferrer'
                        >
                          please contact us.
                        </Link>
                      </Callout.Text>
                  </Callout.Root>
                </>
              )
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
          ) : (
            <Spinner />
          )}
        </Flex>
      </Flex>
    </>
  );
}