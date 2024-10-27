"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { User, Transaction } from "@/app/types/types";
import { ApiError } from "@/app/utils/ApiError";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeftIcon, BellIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Table, Text, TextField } from "@radix-ui/themes";
import axios from "axios";
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from "react";
import * as Sentry from '@sentry/nextjs';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Sales(props: { params: Promise<{ userId: string }> }) {
  const params = use(props.params);
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
      if (isNewUser) {
        try {
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            phone: user.phone?.number,
            name: user.google?.name,
            creationType: 'privy',
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
        if (wallet && typeof wallet.switchChain === 'function') {
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
        } else {
          console.error('Wallet is undefined or does not support switchChain');
        }
      }
    },
    onError: (error) => {
      console.error("Privy login error:", error);
    },
  });

  useEffect(() => {
    if (!user) return;
    if (!currentUser) return;

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
          setCurrentUser(data.user);
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
    if (!currentUser?.smartAccountAddress && smartWallet) {
      updateUserWithSmartWalletAddress(smartWallet)
    }
  }, [currentUser, setCurrentUser, user])

  const getPaymentTypeInfo = (paymentType: string) => {
    const types: { [key: string]: { label: string; color: string } } = {
      'sponsored crypto': { label: 'Crypto', color: '#8E004B' },
      'crypto': { label: 'Crypto', color: '#8E004B' },
      'mobile pay': { label: 'Mobile Pay', color: '#2196F3' },
      'Venmo': { label: 'Venmo', color: '#0084F7' },
      'ManualEntry': { label: 'Credit', color: '#ea7100' },
      'Cash': { label: 'Cash', color: '#4CAF50' },
      'Square': { label: 'Credit', color: '#ea7100' },
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
    const fetchTransactions = async () => {
      if (!currentUser) return;
      try {
        setIsFetchingTransactions(true)
        const response = await fetch(`/api/transaction/buyer/${currentUser._id}`);

        if (response.status === 204) {
          setNoPurchases(true)
          return;
        }

        if (!response.ok) {
          const apiError = new ApiError(
            `Fetching purchases for userId: ${currentUser?._id ?? 'uknown user'} - ${response.statusText}`,
            response.status,
            null
          );

          Sentry.captureException(apiError);

          throw new Error(`Unexpected status: ${response.status}`);
        }

        const { totalTransactions } = await response.json();
       
        const transactionsWithFinalPrice = totalTransactions.map((transaction: Transaction) => {
          const { product, payment, discount } = transaction;

          let welcomeDiscountAmount = 0;
          let rewardsDiscountAmount = 0
          let priceAfterDiscount = product.price

          if (discount && discount.welcome) {
            welcomeDiscountAmount = discount.welcome
          }

          if (discount && discount.amount) {
            rewardsDiscountAmount = discount.amount
          }

          const totalDiscountAmount = Math.max(rewardsDiscountAmount, welcomeDiscountAmount);

          if (discount && discount.type === 'percent') {
            if (totalDiscountAmount > 100) {
              priceAfterDiscount = 0
            } else {
              priceAfterDiscount = product.price - ((totalDiscountAmount/100) * product.price)
            }

          } else if (discount && discount.type === 'dollar') {
            priceAfterDiscount = product.price - totalDiscountAmount
            if (priceAfterDiscount < 0) {
              priceAfterDiscount = 0
            }
          }
  
          const finalPrice =
            Number(priceAfterDiscount ?? 0) +
            Number(payment.tipAmount ?? 0) +
            Number(payment.salesTax ?? 0);
          
          return {
            ...transaction,
            finalPrice: finalPrice.toFixed(2), // Save the calculated final price
          };
        });



        // Sort totalTransactions by date in descending order
        const sortedTotalTransactions = transactionsWithFinalPrice.slice().sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setTotalTransactions(sortedTotalTransactions);

      } catch (err) {
        Sentry.captureException(err);

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
                                  <Table.RowHeaderCell>${transaction.finalPrice}</Table.RowHeaderCell>
                                  <Table.Cell>
                                    <Text wrap={'nowrap'}>
                                      {transaction.merchant.name}: {transaction.product?.name}
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
                        You haven&apos;t made any purchases yet.
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