"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, User, Transaction } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeftIcon, ArrowTopRightIcon, BellIcon, ExclamationTriangleIcon, HeartFilledIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Table, Text, TextField } from "@radix-ui/themes";
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

  export default function Sales({ params }: { params: { userId: string } }) {
    const { ready, authenticated, login, logout, user } = usePrivy();
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

    const router = useRouter();

    const getPaymentTypeInfo = (paymentType: string) => {
      const types: { [key: string]: { label: string; color: string } } = {
        'sponsored crypto': { label: 'Crypto', color: '#4CAF50' },
        'crypto': { label: 'Crypto', color: '#4CAF50' },
        'mobile pay': { label: 'Mobile Pay', color: '#2196F3' }
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
        <Flex direction={'column'} pt={'9'} pb={'4'} px={'4'} gap={'5'}>
        <BalanceProvider walletForPurchase={walletForPurchase}>
            <Header
              embeddedWallet={embeddedWallet}
              authenticated={authenticated}
              walletForPurchase={walletForPurchase}
              currentUser={currentUser}
            />
          </BalanceProvider>
          <Button variant="ghost" size={'4'} style={{width: 'max-content'}} onClick={() => router.back()}>
            <ArrowLeftIcon style={{color: 'black'}}/>
              <Text size={'6'} weight={'bold'} style={{color: 'black'}}>Purchases</Text>
          </Button>
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
                              <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                            </Table.Row>
                          </Table.Header>

                          <Table.Body>
                            {totalTransactions?.map((transaction) => {
                              const { label, color } = getPaymentTypeInfo(transaction.paymentType);
                              return (
                                <Table.Row key={transaction._id}>
                                  <Table.RowHeaderCell>${transaction.productPrice.toFixed(2)}</Table.RowHeaderCell>
                                  <Table.Cell>
                                    <Text wrap={'nowrap'}>
                                      {transaction.merchant.name}: {transaction.productName}
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
                      You haven&apos;t made any purchases yet. Please note that purchases made when not
                      logged in will not show up in your account. If you would like to request a receipt for 
                      one of these purchases,{" "}<Link 
                        href='mailto:payments@ongogh.com?subject=Purchase%20receipt%20request&body=Hello%2C%0A%0AI%20would%20like%20to%20request%20a%20receipt%20for%20a%20past%20purchase.%20Here%20are%20the%20details%3A%0A%0AEmail%20address%3A%20%5B%20ENTER%20EMAIL%20%5D%0A%0APurchase%20method%3A%20%5B%20ENTER%20%22CREDIT%20CARD%22%2C%20%22APPLE%20PAY%22%2C%20%22GOOGLE%20PAY%22%2C%20%22CRYPTO%22%20%5D%20%0A%0ACrypto%20wallet%20address%3A%20%5B%20ENTER%20WALLET%20ADDRESS%20IF%20APPLICABLE%20%5D%0A%0A%5B%20ENTER%20ANY%20OTHER%20DETAILS%20%5D' 
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
              <Flex direction={'column'} height={'200px'} align={'center'} justify={'center'}>
                <Text align={'center'}>
                  Please log in to view this page
                </Text>
              </Flex>
            )
          ) : (
            <>
              <Text>Fetching purchases</Text>
              <Spinner />
            </>
          )}
        </Flex>
      </>
    );
  }