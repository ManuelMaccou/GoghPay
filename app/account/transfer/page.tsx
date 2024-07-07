'use client'

import { User } from "@/app/types/types";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { Avatar, Badge, Box, Button, Callout, Card, Dialog, Flex, Heading, IconButton, Link, Separator, Spinner, Text, TextField } from '@radix-ui/themes';
import { AvatarIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { CoinbaseButton } from "@/app/buy/components/coinbaseOnramp";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Transfer() {
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [address, setAddress] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [editAddressMode, setEditAddressMode] = useState(false);
  const [walletUpdateMessage, setWalletUpdateMessage] = useState<string | null>(null);
  const [transferInputValue, setTransferInputValue] = useState<number>();
  const [transferErrorMessage, setTransferErrorMessage] = useState<string | null>(null);
  const [transferValueIsValid, setTransferValueIsValid] = useState(false);
  const [redirectURL, setRedirectURL] = useState('');

  const { user, ready, authenticated, logout, login } = usePrivy();
  const { wallets } = useWallets();
  const privyId = user?.id;
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const router = useRouter();

  const isError = (error: any): error is Error => error instanceof Error && typeof error.message === "string";

  const handleAddressChange = (event: any) => {
    const input = event.target.value;
    setAddress(input);
    // Check if the input starts with '0x' and has a total length of 42 characters
    setIsValidAddress(input.startsWith('0x') && input.length === 42);
  };

  const handleEditAddress = () => {
    setEditAddressMode(true);
    setAddress('');
    setIsValidAddress(false);
  };

  const handleTransferInputChange = (event: any) => {
    const value = event.target.value;

    // Validate that the input is a number
    if (!/^\d*$/.test(value)) {
      setTransferErrorMessage('Input must be a valid number with no symbols');
      return;
    }

    const numberValue = parseInt(value, 10);

    // Validate that the input does not exceed balance + 1
    if (numberValue > balance - 1) {
      setTransferErrorMessage(`Please input a value less than ${balance - 1} to cover possible network fees.`);
      return;
    }

    setTransferErrorMessage(null);
    setTransferInputValue(value);
  };

  useEffect(() => {
    if (transferInputValue && transferInputValue > 0) {
      setTransferValueIsValid(true);
    } else {
      setTransferValueIsValid(false);
    }
  }, [transferInputValue]);

  useEffect(() => {
    const currentURL = window.location.href;
    setRedirectURL(currentURL);
  }, []);
  

  useEffect(() => {
    const fetchUser = async () => {
      if (!ready || !user?.id) return;

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        const userData = await response.json();

        if (!response.ok) throw new Error(userData.message || 'Failed to fetch user');

        setCurrentUser(userData.user);
        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress;
        setWalletForPurchase(walletAddress);
        setAddress(userData.user.coinbaseAddress);
      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to fetch user data');
      }
    };

    if (ready && authenticated && !editAddressMode) {
      fetchUser();
    }
  }, [ready, authenticated, user?.id, address, editAddressMode]); 

  useEffect(() => {
    const getDefaultCoinbaseAddress = async () => {
      if (!ready) return;

      if (currentUser && currentUser.coinbaseAddress) {
        setAddress(currentUser.coinbaseAddress);
        setIsValidAddress(true);
        setWalletUpdateMessage(null);
      }
    }

    getDefaultCoinbaseAddress();
  }, [currentUser, ready])

  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletForPurchase) return;

      setIsBalanceLoading(true);
      try {
        const response = await fetch(`/api/crypto/get-usdc-balance?address=${walletForPurchase}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || 'Failed to fetch balance');
        
        setBalance(parseFloat(data.balance));
      } catch (error) {
        console.error('Error fetching balance:', error);
        setError('Failed to check balance');
      } finally {
        setIsBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [walletForPurchase]); 

  useEffect(() => {
    const updateUserAddress = async () => {
      if (!ready || !isValidAddress || !user?.id) return; 

      const accessToken = await getAccessToken();

      try {
        setWalletUpdateMessage(null)
        const response = await fetch('/api/user/update', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            coinbaseAddress: address,
            privyId: user.id
          }),
        });
      

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update the address');
        }

        const responseData = await response.json();
        console.log('Update successful:', responseData);
        setWalletUpdateMessage('Address ready')
   
      } catch (error) {
        if (isError(error)) {
          console.error('Error updating address:', error.message);
          setWalletUpdateMessage('There was an error. Please try again.')
        } else {
          console.error('An unexpected error occurred:', error);
          setWalletUpdateMessage('There was an error. Please try again.')
        }
      }
    };

    if (isValidAddress) {
      updateUserAddress();
    }
    
  }, [ready, address, isValidAddress, user?.id]);


  return (
    <Flex direction={'column'} gap={'4'} minHeight={'100vh'} width={'100%'} align={'center'} pb={'9'} pt={'6'} px={'5'}>
      <Box width={'100%'}>
        {embeddedWallet && authenticated ? (
          <Card variant="ghost" mb={'3'}>
            <Flex gap="3" align="center" justify={'end'}>
              <AvatarIcon />
              <Box>
                <Text as="div" size="2" color="gray">
                  {user?.email?.address || user?.google?.name}
                </Text>
              </Box>
            </Flex>
          </Card>
        ) : (
          !embeddedWallet && 
          authenticated && (
            <Card variant="ghost" mb={'3'}>
              <Flex gap="3" align="center" justify={'end'}>
                <AvatarIcon />
                <Box>
                  <Text as="div" size="2" color="gray">
                    {walletForPurchase?.slice(0, 6)}
                  </Text>
                </Box>
              </Flex>
            </Card>
          )
        )}
        <Flex justify={'between'} direction={'row'} pb={'9'}>
          {authenticated && (
            <>
              {!isBalanceLoading ? (
                <Badge size={'3'}>Balance: ${balance}</Badge>
              ) : (
                <Badge size={'3'}>
                  Balance: 
                  <Spinner loading />
                </Badge>
              )}
              <Button variant='outline' onClick={logout}>
                Log out
              </Button>
            </>
          )}
        </Flex>
      </Box>
      <Flex direction={'column'} justify={'center'} gap={'4'}>
      <Text>
        We integrate with Coinbase to offer quick, safe transfers to your bank.
      </Text>
      <TextField.Root value={address} onChange={handleAddressChange} disabled={isValidAddress} placeholder="Enter Base USDC address from Coinbase">
      <TextField.Slot side="right">
        <IconButton size="1" variant="ghost" onClick={handleEditAddress}>
          <Pencil2Icon height="14" width="14" />
        </IconButton>
      </TextField.Slot>
      </TextField.Root>
      {address && !isValidAddress && (
        <Text color="red" mt={'-3'}>Enter a valid address</Text>
      )}
      {walletUpdateMessage && isValidAddress && (
        <Text mt={'-3'}>{walletUpdateMessage}</Text>
      )}
      {!currentUser?.coinbaseAddress && (
        <Callout.Root color="orange">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>
            <Link href='https://www.ongogh.com/onboard' target='_blank' rel='noopener noreferrer'>
              Read this to get your address.
            </Link> 
          </Callout.Text>
        </Callout.Root>
      )}
    </Flex>
    <Flex direction={'column'} flexGrow={'1'} width={'100%'} justify={'center'} gap={'4'}>
      <Flex direction={'column'} flexGrow={'1'} gap={'4'} align={'center'} p={'4'} style={{
          boxShadow: 'var(--shadow-2)',
          borderRadius: '10px'
        }}>
        <Heading>Transfer from bank</Heading>
        <Text>
          Move funds for free from your bank to Gogh and make purchases at your favorite vendors
        </Text>
        <CoinbaseButton
          destinationWalletAddress={walletForPurchase || ""}
          price={0}
          redirectURL={redirectURL}
        />


       
      </Flex>
      <Flex direction={'column'} flexGrow={'1'} gap={'4'} align={'center'} p={'4'} style={{
          boxShadow: 'var(--shadow-2)',
          borderRadius: '10px'
        }}>
        <Heading>Deposit to Coinbase</Heading>
        <Text mt={'-3'}>Enter amount</Text>
        <Flex direction={'row'} align={'center'} style={{boxShadow: 'var(--shadow-2)'}} p={'3'}>
          <TextField.Root variant="soft" size="2" placeholder="0" value={transferInputValue} onChange={handleTransferInputChange} style={{backgroundColor: "white", fontSize: '30px', fontWeight: 'bold'}} />
          <Badge size={'3'} variant="soft">USDC</Badge>
        </Flex>
        {transferErrorMessage && (
        <Text color="red">{transferErrorMessage}</Text>
      )}
        <Flex direction={'column'} align={'center'} gap={'4'}>
          <Text size={'2'} align={'center'}>If this is your first deposit, we recommend making a test transaction of 1 USDC.</Text>
          {currentUser?.coinbaseAddress ? (
            <Dialog.Root>
            <Dialog.Trigger>
              <Button highContrast style={{width: '200px'}} disabled={!transferValueIsValid}>Review transaction</Button>
            </Dialog.Trigger>
            <Dialog.Content width={'90vw'}>
              <Flex direction={'column'} width={'100%'}>
                <Text align={'center'}>Confirm details</Text>
                <Separator size={'4'} mb={'5'}/>
                <Text align={'center'} size={'7'} weight={'bold'}>${transferInputValue}.00</Text>
                <Text size={'2'} align={'center'}>{transferInputValue} USDC @ $1.00</Text>
                <Flex direction={'column'} mt={'3'} p={'3'} style={{border: '1px solid #e0e0e0', borderRadius: '5px'}}>
                  <Flex direction={'row'} justify={'between'}>
                    <Text size={'4'} weight={'bold'}>From:</Text>
                    <Flex direction={'column'} gap={'2'} maxWidth={'70%'}>
                      <Flex direction={'row'} gap={'2'} align={'center'}>
                        <FontAwesomeIcon icon={faWallet} />
                        <Text>Gogh</Text>
                      </Flex>
                      <Text size={'2'} wrap={'wrap'}>{walletForPurchase?.slice(0, 6)}...{walletForPurchase?.slice(-4)}</Text>
                    </Flex>
                  </Flex>
                  <Separator size={'4'} my={'3'} />
                  <Flex direction={'row'} justify={'between'}>
                    <Text size={'4'} weight={'bold'}>To:</Text>
                    <Flex direction={'column'} gap={'2'} maxWidth={'70%'}>
                      <Flex direction={'row'} gap={'2'} align={'center'}>
                        <FontAwesomeIcon icon={faWallet} />
                        <Text>Coinbase</Text>
                      </Flex>
                      <Text size={'2'} wrap={'wrap'}>{currentUser?.coinbaseAddress.slice(0, 6)}...{currentUser?.coinbaseAddress.slice(-4)}</Text>
                    </Flex>
                  </Flex>
                </Flex>
                <Flex direction={'column'} align={'center'} gap={'7'} mt={'5'}>
                 
                    <Button size={'4'} style={{width: '200px'}}>
                      Confirm and send
                    </Button>
                  
                  <Dialog.Close>
                    <Button size={'4'} variant="ghost" color="gray" style={{width: '200px'}}>Cancel</Button>
                  </Dialog.Close>
                </Flex>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
          ) : (
            <Text color="red">Enter USDC address to Deposit.</Text>
          )}
          
        </Flex>

       
      </Flex>
    </Flex>




      
    </Flex>



  )
}