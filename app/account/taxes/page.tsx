"use client";

import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { Merchant, Tax, Transaction, User } from "@/app/types/types";
import { format } from 'date-fns';
import { createSmartAccount } from "@/app/utils/createSmartAccount";
import { getAccessToken, getEmbeddedConnectedWallet, useLogin, useLogout, usePrivy, useWallets } from "@privy-io/react-auth";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Badge, Box, Button, Callout, Dialog, Flex, Link, RadioGroup, Spinner, Strong, Table, Text, VisuallyHidden } from "@radix-ui/themes";

import axios from "axios";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { NewTaxForm } from "./components/taxForm";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Taxes({ params }: { params: { userId: string } }) {
  const { ready, authenticated, user } = usePrivy();
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [isFetchingMerchant, setIsFetchingMerchant] = useState(false);
  const [merchant, setMerchant] = useState<Merchant>();
  const [transactiosnwithTaxes, setTransactiosnwithTaxes] = useState<Transaction[] | null>(null);
  const [totalTaxAmount, setTotalTaxAmount] = useState<number>(0);
  const [totalTaxAmountExcludingCash, setTotalTaxAmountExcludingCash] = useState<number>(0);
  const [taxes, setTaxes] = useState<Tax[] | null>(null);
  const [selectedTax, setSelectedTax] = useState<Tax | null>(null); 
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [newTaxMessage, setNewTaxMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

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

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  const handleAddTax = async (newTax: { name: string, rate: string }) => {
    if (!merchant) return;

    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          taxes: [...(merchant.taxes || []), newTax],
        }),
      });

      const updatedMerchant = await response.json();
      setMerchant(updatedMerchant.merchant);
      setTaxes(updatedMerchant.merchant.taxes);
      setIsDialogOpen(false);
  
    } catch (error) {
      if (isError(error)) {
        console.error('Error updating merchant taxes:', error.message);
        setNewTaxMessage('There was an error. Please try again.');
      } else {
        console.error('An unexpected error occurred:', error);
        setNewTaxMessage('There was an error. Please try again.');
      }
    }
  };

  const handleTaxSelection = async (selectedTaxId: string) => {
    if (!merchant || !taxes) return;

    const accessToken = await getAccessToken();

    const updatedTaxes = taxes.map((tax: Tax) => ({
      ...tax,
      default: tax._id === selectedTaxId,  // Set the selected tax as default
    }));

    try {
      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          taxes: updatedTaxes,
        }),
      });

      const updatedMerchant = await response.json();
      setMerchant(updatedMerchant.merchant);
      setTaxes(updatedMerchant.merchant.taxes);
      setSelectedTax(updatedMerchant.merchant.taxes.find((tax: Tax) => tax.default) || null);
      setConfirmMessage("Default tax set");

    } catch (error) {
      console.error('Error setting default tax:', error);
      setConfirmMessage('Failed to set default tax. Please try again.');
    }
  };

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
  }, [authenticated, ready, user]);

  useEffect(() => {
    const fetchMerchant = async (id: string) => {
      setIsFetchingMerchant(true);
      try {
        const privyId = id
        const response = await fetch(`/api/merchant/privyId/${privyId}`);
        const data = await response.json();
        setMerchant(data);
        setTaxes(data.taxes)
        const defaultTax = data.taxes.find((tax: Tax) => tax.default);
        setSelectedTax(defaultTax || null);
      } catch (err) {
        if (isError(err)) {
          console.error(`Error fetching merchant: ${err.message}`);
        } else {
          console.error('Error fetching merchant');
        }
      }
      setIsFetchingMerchant(false);
    }
    if (ready && authenticated && user?.id) {
      fetchMerchant(user.id)
    }
    

  }, [ready, authenticated, user]); 

  // Fetch taxes from transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!merchant) return;
      try {
        const response = await fetch(`/api/transaction/merchant/${merchant._id}`);
  
        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }
  
        const { totalTransactions } = await response.json();
  
        // Sort totalTransactions by date in descending order
        const sortedTotalTransactions = totalTransactions.slice().sort((a: Transaction, b: Transaction) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Filter transactions to get all the taxes
        console.log('sortedTotalTransactions', sortedTotalTransactions);
        const transactionsWithTaxes = sortedTotalTransactions
          .filter((transaction: Transaction) => transaction.payment.salesTax !== undefined && transaction.payment.salesTax !== null && transaction.payment.salesTax !== 0);

        const transactionsWithTaxesExcludingCash = sortedTotalTransactions
          .filter((transaction: Transaction) => transaction.payment.salesTax !== undefined && transaction.payment.salesTax !== null && transaction.payment.salesTax !== 0 && transaction.payment.paymentType !== "Cash");
        
        const totalTaxAmount = transactionsWithTaxes.reduce((sum: number, transaction: Transaction) => {
          return sum + (transaction.payment.salesTax || 0);
        }, 0);

        const totalTaxAmountExcludingCash = transactionsWithTaxesExcludingCash.reduce((sum: number, transaction: Transaction) => {
          return sum + (transaction.payment.salesTax || 0);
        }, 0);

        setTransactiosnwithTaxes(transactionsWithTaxes);
        setTotalTaxAmount(totalTaxAmount);
        setTotalTaxAmountExcludingCash(totalTaxAmountExcludingCash);

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
    <Flex direction={"column"} pt={"9"} pb={"4"} px={"4"} gap={"5"} maxHeight={'100vh'} overflow={'hidden'}>
      {ready && authenticated && currentUser && (
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
        </BalanceProvider>
      )}

      <Text size={"6"} weight={"bold"} style={{ color: "black" }}>
        Taxes
      </Text>
      <Text>
        Select a default tax or create a new one. 
      </Text>

      {ready && !isFetchingMerchant ? (
        authenticated && merchant ? (
          <>
            <Flex
              direction={"column"}
              gap={"4"}
              align={"center"}
              p={"4"}
              style={{
                boxShadow: "var(--shadow-2)",
                borderRadius: "10px",
              }}
            >
              {taxes && (
                <RadioGroup.Root
                  size={'3'}
                  value={selectedTax?._id || ""}
                  onValueChange={handleTaxSelection}
                  name="taxes"
                >
                  {taxes.map((tax) => (
                    <RadioGroup.Item key={tax._id} value={tax._id} disabled={!merchant}>
                      <Flex direction={'row'} gap={'4'} ml={'3'}>
                        <Text size={'5'} as="label">{tax.name}</Text>
                        <Text size={'5'}>{tax.rate}%</Text>
                      </Flex>
                    </RadioGroup.Item>
                  ))}
                </RadioGroup.Root>
              )}

              {confirmMessage && <Text color="green">{confirmMessage}</Text>}
          
              <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}> 
                <Dialog.Trigger>
                <Button variant="ghost" onClick={() => setIsDialogOpen(true)}>+ Create New Tax</Button>
                </Dialog.Trigger>
                  <Dialog.Content>
                    <Dialog.Title>Create New Tax</Dialog.Title>
                    <VisuallyHidden>
                      <Dialog.Description>
                        Create new sales tax
                      </Dialog.Description>
                    </VisuallyHidden>
                    <NewTaxForm
                      onMessageUpdate={() => {}} 
                      onAddTax={handleAddTax}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  </Dialog.Content>
              </Dialog.Root>

            </Flex>

            <Flex direction={'column'} gap={'4'} flexGrow={'1'} justify={'between'} width={'100%'} maxHeight={'50vh'} overflow={'auto'}>
              <Box>
                <Table.Root size="1">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Tax amount</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
        
                  <Table.Body>
                    {transactiosnwithTaxes?.map((transaction) => {
                      const { label, color } = getPaymentTypeInfo(transaction.payment.paymentType);
                      return (
                        <Table.Row key={transaction._id}>
                          <Table.RowHeaderCell>${transaction.payment.salesTax.toFixed(2)}</Table.RowHeaderCell>
                          <Table.Cell>
                            <Text wrap={'nowrap'}>
                              {transaction.product.name}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge radius="large" style={{ backgroundColor: color, color: 'white', padding: '3px 7px 3px 7px' }}>{label}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <Text wrap={'nowrap'}>
                              {transaction.createdAt ? format(new Date(transaction.createdAt), 'MMM dd, yyyy') : 'N/A'}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Flex>
            <Flex direction={'column'} width={'100%'} gap={'4'}>
              <Flex direction={'row'} justify={'between'} width={'100%'}>
                <Text weight={'bold'} size={'3'}>
                  Total sales tax collected:
                </Text>
                <Text>
                  ${totalTaxAmount.toFixed(2)}
                </Text>
              </Flex>
              <Flex direction={'row'} justify={'between'} width={'100%'} mb={'4'}>
                <Text weight={'bold'} size={'3'}>
                  Total sales tax collected (excluding cash):
                </Text>
                <Text>
                  ${totalTaxAmountExcludingCash.toFixed(2)}
                </Text>
              </Flex>
            </Flex>
            
          </>
        ) : authenticated && !merchant ? (
          <Flex direction={"column"} flexGrow={"1"} px={"5"} justify={"center"} align={"center"} gap={"9"}>
            <Callout.Root color="red" role="alert">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>
                <Strong>Unauthorized.</Strong> This page is for merchants only. You can{" "}
                <Link href="https://www.ongogh.com" target="_blank" rel="noopener noreferrer">
                  request access here.
                </Link>
                . If you think this is a mistake, please{" "}
                <Link href="mailto:hello@ongogh.com" target="_blank" rel="noopener noreferrer">
                  contact us.
                </Link>
              </Callout.Text>
            </Callout.Root>
            <Button onClick={logout} style={{ width: "250px" }} size={"4"}>
              Log out
            </Button>
          </Flex>
        ) : (
          <Flex direction={"column"} height={"80vh"} align={"center"} justify={"center"} gap={"5"}>
            <Text align={"center"}>Please log in to view this page</Text>
            <Button
              size={"4"}
              style={{
                width: "250px",
                backgroundColor: "#0051FD",
              }}
              onClick={login}
            >
              Log in
            </Button>
          </Flex>
        )
      ) : (
        <Spinner />
      )}
    </Flex>
  );
}