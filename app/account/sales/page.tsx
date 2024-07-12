"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, User, Transaction } from "@/app/types/types";
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeftIcon, ArrowTopRightIcon, ExclamationTriangleIcon, HeartFilledIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
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
  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [ isDeterminingMerchantStatus, setIsDeterminingMerchantStatus ] = useState(true);
  const [ merchantVerified, setMerchantVerified ] = useState(false);
  const [ merchant, setMerchant ] = useState<Merchant>();
  const [totalTransactions, setTotalTransactions] = useState<Transaction[] | null>(null);
  const [todaysTransactions, setTodaysTransactions] = useState<Transaction[] | null>(null);
  const [totalSale, setTotalSale] = useState<number>(0);
  const [todaysTotalSale, setTodaysTotalSale] = useState<number>(0);

  const { wallets } = useWallets();
  const wallet = wallets[0]
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const router = useRouter();
  const visitingUser = params.userId

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
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
    }
  }, [authenticated, ready, user, visitingUser]);

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
    if (!ready || !authenticated) {
      setIsLoading(false);
      return;
    }
    
    if (!user) {
      setIsLoading(false);
      return
    }
    const userId = user.id

    async function verifyMerchantStatus() {
      setIsDeterminingMerchantStatus(true);
      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/merchant/verifyMerchantStatus/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        if (response.status === 404) {
          setMerchantVerified(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const data = await response.json();
        setMerchantVerified(true);
        setMerchant(data);

      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      } finally {
        setIsLoading(false);
        setIsDeterminingMerchantStatus(false);
      }
    }

    verifyMerchantStatus();
  }, [user, ready, authenticated]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!merchant) return;
      try {
        const response = await fetch(`/api/transaction/merchant/${merchant._id}`);
  
        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }
  
        const { totalTransactions, todaysTransactions } = await response.json();
        console.log('totalTransactions:', totalTransactions);
        console.log('todaysTransactions:', todaysTransactions);
  
        // Sort totalTransactions by date in descending order
        const sortedTotalTransactions = totalTransactions.slice().sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
  
        // Calculate total sale for all transactions
        const total = sortedTotalTransactions.reduce((acc: number, transaction: Transaction) => acc + transaction.productPrice, 0);
        setTotalSale(total);
        setTotalTransactions(sortedTotalTransactions);
  
        // Sort todaysTransactions by date in descending order
        const sortedTodaysTransactions = todaysTransactions.slice().sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
  
        // Calculate total sale for today's transactions
        const todayTotal = sortedTodaysTransactions.reduce((acc: number, transaction: Transaction) => acc + transaction.productPrice, 0);
        setTodaysTotalSale(todayTotal);
        setTodaysTransactions(sortedTodaysTransactions);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching transactions: ${err.message}`);
        } else {
          setError('Error fetching transactions');
        }
      }
    };
  
    if (merchant) {
      fetchTransactions();
    }
  }, [merchant]);
  

  return (
    <>
    <Flex direction={'column'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'}>
      <BalanceProvider walletForPurchase={walletForPurchase}>
        <Header
          merchant={currentUser?.merchant}
          embeddedWallet={embeddedWallet}
          authenticated={authenticated}
          walletForPurchase={walletForPurchase}
          currentUser={currentUser}
        />
      </BalanceProvider>
      <Button variant="ghost" size={'4'} style={{width: 'max-content'}} onClick={() => router.back()}>
        <ArrowLeftIcon style={{color: 'black'}}/>
          <Text size={'6'} weight={'bold'} style={{color: 'black'}}>Sales</Text>
      </Button>
      {ready ? (
        authenticated ? (
          isDeterminingMerchantStatus ? (
            <Spinner />
          ) : merchantVerified ? (
            <>
            <Flex direction={'row'} width={'100%'} gap={'5'} px={'4'} align={'center'} justify={'center'}>
              <Box width={'100%'}>
                <Card size="1" style={{backgroundColor: 'lightgrey'}}>
                  <Flex height={'100%'} width={'100%'} direction={'column'} gap={'3'} align={'center'} justify={'center'}>
                    <Text size={'4'} weight={'bold'} align={'center'}>
                    Today
                    </Text>
                    <Text size={'3'} color="gray" align={'center'}>
                    ${todaysTotalSale.toFixed(2)}
                    </Text>
                  </Flex>
                </Card>
              </Box>
              <Box width={'100%'}>
              <Card size="1" style={{backgroundColor: 'lightgrey'}}>
                <Flex height={'100%'} width={'100%'} direction={'column'} gap={'3'} align={'center'} justify={'center'}>
                  <Text size={'4'} weight={'bold'} align={'center'}>
                    Total
                  </Text>
                  <Text size={'3'} color="gray" align={'center'}>
                    ${totalSale.toFixed(2)}
                  </Text>
                </Flex>
              </Card>
              </Box>
            </Flex>
            <Flex direction={'row'} gap={'2'} align={'center'}>
            <Link href="https://dashboard.stripe.com/payments" highContrast>
              View sales facilitated by Stripe
            </Link>
            <ArrowTopRightIcon />
          </Flex>
          <Flex direction={'column'} gap={'4'} flexGrow={'1'} justify={'between'} width={'100%'}>
            <Box overflow={'scroll'} maxHeight={'50vh'}>
            <Table.Root size="1">
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
                          {transaction.productName}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge radius="large" style={{ backgroundColor: color, color: 'white', padding: '3px 7px 3px 7px' }}>{label}</Badge>
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
            {merchant?.promo && (
              <Callout.Root color="green">
              <Callout.Icon>
                <HeartFilledIcon />
              </Callout.Icon>
              <Callout.Text>
                You are currently earning 2% more on all crypto and USD transactions!
              </Callout.Text>
            </Callout.Root>
            )}
          </Flex>
         </>
          ) : (
            <Flex direction={'column'} flexGrow={'1'} px={'5'} justify={'center'} align={'center'} gap={'9'}>
              <Callout.Root color='red' role='alert'>
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>
                  <Strong>Unauthorized.</Strong> This page is for merchants only. You can{' '}
                  <Link href='https://www.ongogh.com' target='_blank' rel='noopener noreferrer'>
                    request access here.
                  </Link>
                    If you think this is a mistake, please{' '}
                  <Link href='mailto: hello@ongogh.com' target='_blank' rel='noopener noreferrer'>
                    contact us.
                  </Link>
                </Callout.Text>
              </Callout.Root>
              <Button onClick={logout} style={{ width: '250px' }} size={'4'}>
                Log out
              </Button>
            </Flex>
          )
        ) : (
          <Flex direction={'column'} height={'200px'} align={'center'} justify={'center'}>
            <Text align={'center'}>
              Please log in to view this page
            </Text>
          </Flex>
        )
      ) : (
        <Spinner />
      )}
      
    </Flex>
    </>
  );
}