"use client"

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { User, Transfer } from "@/app/types/types";
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeftIcon, ArrowTopRightIcon, BellIcon, ExclamationTriangleIcon, HeartFilledIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Box, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Table, Text, TextField } from "@radix-ui/themes";
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

  export default function Transfers({ params }: { params: { userId: string } }) {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const [isLoading, setIsLoading] = useState(true); 
    const [error, setError] = useState<string | null>(null);
    const [ isFetchingCurrentUser, setIsFetchingCurrentUser ] = useState(true);
    const [currentUser, setCurrentUser] = useState<User>();
    const [ isFetchingTransfers, setIsFetchingTransfers ] = useState(true);
    const [allTransfers, setAllTransfers] = useState<Transfer[] | null>(null);
    const [noPurchases, setNoPurchases] = useState(false); 
    const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
    const { wallets } = useWallets();
    
    const embeddedWallet = getEmbeddedConnectedWallet(wallets);

    const router = useRouter();

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
      const fetchTransfers = async () => {
        if (!currentUser) return;
        try {
          setIsFetchingTransfers(true)
          const response = await fetch(`/api/transfer/${currentUser._id}`);
  
          if (!response.ok) {
            if (response.status === 404) {
              setNoPurchases(true)
            }
            throw new Error(`Unexpected status: ${response.status}`);
          }
  
          const { allTransfers } = await response.json();
          console.log('allTransfers:', allTransfers);

          // Sort allTransfers by date in descending order
          const sortedTotalTransfers = allTransfers.slice().sort((a: Transfer, b: Transfer) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setAllTransfers(sortedTotalTransfers);
  
        } catch (err) {
          if (isError(err)) {
            setError(`Error fetching buyer transfers: ${err.message}`);
          } else {
            setError('Error fetching buyer transfers');
          }
        } finally {
          setIsFetchingTransfers(false);
        }
      };
  
      if (currentUser) {
        fetchTransfers();
      }
    }, [currentUser]);

    return (
      <>
        <Flex direction={'column'} pt={'6'} pb={'4'} px={'4'} gap={'5'}>
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
            <Text size={'6'} weight={'bold'} style={{color: 'black'}}>Transfers</Text>
          </Button>
    
          {ready ? (
            authenticated ? (
              <>
                <Button size={'3'} onClick={() => router.push(`/account/transfers/new`)}>Start transfer</Button>
                {isFetchingTransfers ? (
                  <>
                    <Text>Fetching transfers</Text>
                    <Spinner />
                  </>
                ) : !noPurchases ? (
                  <Flex direction={'column'} gap={'4'} justify={'start'} width={'100%'}>
                    <Box overflow={'scroll'}>
                      <Table.Root>
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
    
                        <Table.Body>
                          {allTransfers?.map((transfer) => (
                            <Table.Row key={transfer._id}>
                              <Table.RowHeaderCell>${transfer.amount.toFixed(2)}</Table.RowHeaderCell>
                              <Table.Cell>
                                <Text wrap={'nowrap'}>
                                  {format(new Date(transfer.createdAt), 'MMM dd, yyyy')}
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Box>
                  </Flex>
                ) : (
                  <>
                    <Heading size={'5'}>No transfers yet</Heading>
                    <Callout.Root color="yellow">
                      <Callout.Icon>
                        <BellIcon />
                      </Callout.Icon>
                      <Callout.Text>
                        You haven&apos;t made any transfers yet. If you think this is a mistake,{" "}
                        <Link 
                          href='mailto:payments@ongogh.com?subject=Transfers%20inquiry&body=Hello%2C%0A%0AI%20don%27t%20see%20expected%20transfers%20listed%20in%20my%20account.%0ACoinbase%20USDC%20Address%3A%20%5B%20ENTER%20WALLET%20ADDRESS%20%5D%0A%0AEnter%20the%20following%20details%20that%20you%20used%20to%20log%20into%20your%20Gogh%20account.%0AEmail%20Address%3A%20%5B%20ENTER%20EMAIL%20ADDRESS%20IF%20APPLICABLE%20%5D%0AWallet%20Address%3A%20%5B%20ENTER%20WALLET%20ADDRESS%20IF%20APPLICABLE%20%5D%0A%0A%5B%20ENTER%20ANY%20OTHER%20DETAILS%20%5D' 
                          target='_blank' 
                          rel='noopener noreferrer'
                        >
                          please contact us.
                        </Link>
                      </Callout.Text>
                    </Callout.Root>
                  </>
                )}
              </>
            ) : (
              <Flex direction={'column'} height={'200px'} align={'center'} justify={'center'}>
                <Text align={'center'}>
                  Please log in to view this page
                </Text>
              </Flex>
            )
          ) : (
            <>
              <Text>Fetching transfers</Text>
              <Spinner />
            </>
          )}
        </Flex>
      </>
    );
  }