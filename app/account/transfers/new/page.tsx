'use client'

import { User } from "@/app/types/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/app/components/Header";
import { ConnectedWallet, getAccessToken, getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { Badge, Box, Button, Callout, Card, Dialog, Flex, Heading, IconButton, Link, Separator, Spinner, Text, TextField, VisuallyHidden } from '@radix-ui/themes';
import { ArrowLeftIcon, AvatarIcon, ExclamationTriangleIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { CoinbaseButton } from "@/app/buy/components/coinbaseOnramp";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, erc20Abi, http, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";
import { ENTRYPOINT_ADDRESS_V07, createSmartAccountClient, walletClientToSmartAccountSigner } from "permissionless";
import { createPimlicoBundlerClient } from "permissionless/clients/pimlico";
import { pimlicoPaymasterActions } from "permissionless/actions/pimlico";
import { signerToSafeSmartAccount } from "permissionless/accounts";
import { BalanceProvider, useBalance } from "@/app/contexts/BalanceContext";
import NotificationMessage from "@/app/components/Notification";
import NoWalletForPurchaseError from "@/app/components/NoWalletForPurchaseError";

export default function NewTransfer() {
  const [error, setError] = useState<string | null>(null);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string | null>(null);
  const [tranferSuccessMessage, setTransferSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [noWalletForPurchase, setNoWalletForPurchase] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [address, setAddress] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [editAddressMode, setEditAddressMode] = useState(false);
  const [addressUpdated, setAddressUpdated] = useState(false);
  const [walletUpdateMessage, setWalletUpdateMessage] = useState<string | null>(null);
  const [transferInputValue, setTransferInputValue] = useState('');
  const [transferValueIsValid, setTransferValueIsValid] = useState(false);
  const [transferStarted, setTransferStarted] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [redirectURL, setRedirectURL] = useState('');

  const { user, ready, authenticated, logout, login } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const wallet = wallets[0]
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : 8453;

  const { fetchBalance } = useBalance();


  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

  const router = useRouter();

  const isError = (error: any): error is Error => error instanceof Error && typeof error.message === "string";

  const chainMapping: { [key: string]: Chain } = {
    'baseSepolia': baseSepolia,
    'base': base,
  };

 // Utility function to get Chain object from environment variable
  const getChainFromEnv = (envVar: string | undefined): Chain => {
    if (!envVar) {
      throw new Error('Environment variable for chain is not defined');
    }
    
    const chain = chainMapping[envVar];
    
    if (!chain) {
      throw new Error(`No chain found for environment variable: ${envVar}`);
    }

    return chain;
  };

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

  async function sendUSDC(coinbaseAddress: `0x${string}`, amount: number) {
    setTransferStarted(true)
    if (chainIdNum !== null && chainId !== `eip155:${chainIdNum}`) {
      try {
        await wallet.switchChain(chainIdNum);
      } catch (error: unknown) {
        console.error('Error switching chain:', error);
        setTransferStarted(false)
    
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
        setTransferStarted(false)
        return;
      }
    };

    if (!walletForPurchase) {
      console.error('Error: Users wallet address is missing.');
      setTransferErrorMessage('There was an error. Please log in again.');
      setTransferStarted(false)
      return;
    }
    
    const amountInUSDC = BigInt(amount * 1_000_000);

    setIsLoading(true);
    setPendingMessage('Please wait...');

    if (embeddedWallet) {
      try {
        const erc20PaymasterAddress = process.env.NEXT_PUBLIC_ERC20_PAYMASTER_ADDRESS as `0x${string}`;
        const eip1193provider = await wallet.getEthereumProvider();
  
        console.log('Creating privy client...');
        const privyClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
          transport: custom(eip1193provider)
        });
  
        console.log('Creating custom signer...');
        const customSigner = walletClientToSmartAccountSigner(privyClient);
  
        console.log('Creating public client...');
        const publicClient = createPublicClient({
          chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
          transport: http(),
        });
  
        console.log('Creating bundler client...');
        const bundlerClient = createPimlicoBundlerClient({
          transport: http(rpcUrl),
          entryPoint: ENTRYPOINT_ADDRESS_V07
        }).extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))
  
        console.log('Creating smart account...');
        const account = await signerToSafeSmartAccount(publicClient, {
          signer: customSigner,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          safeVersion: "1.4.1",
          setupTransactions: [
            {
              to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS as `0x${string}`,
              value: 0n,
              data: encodeFunctionData({
                abi: [parseAbiItem("function approve(address spender, uint256 amount)")],
                args: [
                  erc20PaymasterAddress,
                  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
                ],
              }),
            },
          ],
        })
  
        const smartAccountClient = createSmartAccountClient({
          account,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          chain: baseSepolia,
          bundlerTransport: http(rpcUrl),
          middleware: {
            gasPrice: async () => {
              return (await bundlerClient.getUserOperationGasPrice()).fast
            },
            sponsorUserOperation: async (args) => {
              const gasEstimates = await bundlerClient.estimateUserOperationGas({
                userOperation: {
                  ...args.userOperation,
                  paymaster: erc20PaymasterAddress,
                },
              })
         
              return {
                ...gasEstimates,
                paymaster: erc20PaymasterAddress,
              };
            },
          },
        })
  
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [coinbaseAddress, amountInUSDC]
        })
  
        const transactionHash = await smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS as `0x${string}`,
          data: data,
          value: BigInt(0),
          maxFeePerGas: BigInt(1000000000), // 1 Gwei
          maxPriorityFeePerGas: BigInt(1000000000), // 1 Gwei
          gas: BigInt(1000000000),
  
        });
        setPendingMessage(null);
        setTransferSuccessMessage('Transfer complete')
        setTransferStarted(false)
        fetchBalance();
        console.log('Transaction sent! Hash:', transactionHash);
  
        await saveTransfer({
          privyId: user?.id,
          user: currentUser?._id,
          amount: transferInputValue,
          fromGoghAddress: walletForPurchase,
          toCoinbaseAddress: currentUser?.coinbaseAddress,
          transactionHash: transactionHash,
        });
  
  
      } catch (error) {
        if (isError(error)) {
          console.error('Error sending USDC transfer');
          setTransferErrorMessage('USDC transfer failed. Please try again or contact us if the issue persists.');
          setTransferStarted(false)
        } else {
          console.error('An unexpected error occurred:', error);
          setTransferErrorMessage('An unexpected error occurred');
          setTransferStarted(false)
        }
      } finally {
        setIsLoading(false);
        setPendingMessage(null);
        setTransferStarted(false)
      }

    } else {
      try {
        const provider = await wallet.getEthereumProvider();

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [coinbaseAddress, amountInUSDC]
        })
  
        const transactionRequest = {
          to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS as `0x${string}`,
          from: walletForPurchase,
          data: data,
          value: 0x0,
        };
  
        const transactionHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [transactionRequest],
        });
        setPendingMessage(null);
        setTransferSuccessMessage('Transfer complete')
        setTransferStarted(false)
        fetchBalance();
        console.log('Transaction sent! Hash:', transactionHash);
  
        await saveTransfer({
          privyId: user?.id,
          user: currentUser?._id,
          amount: transferInputValue,
          fromGoghAddress: walletForPurchase,
          toCoinbaseAddress: currentUser?.coinbaseAddress,
          transactionHash: transactionHash,
        });
  
  
      } catch (error) {
        if (isError(error)) {
          console.error('Error sending USDC transfer');
          setTransferErrorMessage('USDC transfer failed. Please try again or contact us if the issue persists.');
          setTransferStarted(false)
        } else {
          console.error('An unexpected error occurred:', error);
          setTransferErrorMessage('An unexpected error occurred');
          setTransferStarted(false)
        }
      } finally {
        setIsLoading(false);
        setPendingMessage(null);
        setTransferStarted(false)
      }
    }
  }
    

  async function saveTransfer(transferData: any) {
    const accessToken = await getAccessToken();
    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 

        },
        body: JSON.stringify(transferData),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save transfer');
      }
  
      const data = await response.json();
      console.log('Transfer saved:', data);
    } catch (error) {
      console.error('Error saving Transfer:', error);
    }
  }

  useEffect(() => {
    const numericTransferInputValue = Number(transferInputValue);
    if (transferInputValue && numericTransferInputValue > 0) {
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
        
        if (userData.user.coinbaseAddress) {
          setAddress(userData.user.coinbaseAddress);
        }

      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to fetch user data');
        setNoWalletForPurchase(true);
      }
    };

    if (ready && authenticated && !editAddressMode) {
      fetchUser();
    }
  }, [ready, authenticated, user?.id, editAddressMode]); 

  useEffect(() => {
    if (currentUser) {
      const { smartAccountAddress, walletAddress } = currentUser;
  
      if (!smartAccountAddress && !walletAddress) {
        setNoWalletForPurchase(true);
      } else {
        setNoWalletForPurchase(false);
      }
    }
  }, [currentUser]);

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
        setAddressUpdated(true);
        setCurrentUser(responseData.user)
   
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
    <Flex direction={'column'} gap={'4'} minHeight={'100vh'} width={'100%'} pb={'9'} pt={'6'} px={'5'}>  
     <NoWalletForPurchaseError condition={noWalletForPurchase} />  
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
        {address && addressUpdated && isValidAddress && (
          <Text mt={'-3'}>Address ready</Text>
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
          <Flex direction={'row'} align={'center'} style={{boxShadow: 'var(--shadow-1)'}} p={'3'}>
            <TextField.Root variant="soft" size="2" placeholder="0" value={transferInputValue} onChange={handleTransferInputChange} style={{backgroundColor: "white", fontSize: '30px', fontWeight: 'bold'}} />
            <Badge size={'3'} variant="soft">USDC</Badge>
          </Flex>
          <Flex direction={'column'} align={'center'} gap={'4'}>
            <Text size={'2'} align={'center'}>If this is your first deposit, we recommend making a test transaction of 1 USDC.</Text>
            {currentUser?.coinbaseAddress ? (
              <Dialog.Root>
                <Dialog.Trigger>
                  <Button highContrast style={{width: '200px'}} disabled={!transferValueIsValid || transferStarted}>Review transaction</Button>
                </Dialog.Trigger>
                <Dialog.Content width={'90vw'}>
                  <Flex direction={'column'} width={'100%'}>
                  <Dialog.Title align={'center'}>Confirm transfer</Dialog.Title>
                  <VisuallyHidden asChild>
                    <Dialog.Description size="2" mb="4">
                      Confirm transaction details
                    </Dialog.Description>
                  </VisuallyHidden>
                  <Separator size={'4'} mb={'5'}/>
                  <Text align={'center'} size={'7'} weight={'bold'}>${transferInputValue}.00</Text>
                  <Text size={'2'} align={'center'}>{transferInputValue} USDC @ $1.00</Text>
                  <Flex direction={'column'} mt={'3'} p={'3'} style={{border: '1px solid #e0e0e0', borderRadius: '5px'}}>
                    <Flex direction={'row'} justify={'between'}>
                      <Text size={'4'} weight={'bold'}>From:</Text>
                      <Flex direction={'column'} gap={'2'} maxWidth={'70%'}>
                        <Flex direction={'row'} gap={'2'} align={'center'}>
                          <FontAwesomeIcon icon={faWallet} />
                          <Text>Your Gogh account</Text>
                        </Flex>
                        <Text size={'2'} align={'right'} wrap={'wrap'}>{walletForPurchase?.slice(0, 6)}...{walletForPurchase?.slice(-4)}</Text>
                      </Flex>
                    </Flex>
                    <Separator size={'4'} my={'3'} />
                    <Flex direction={'row'} justify={'between'}>
                      <Text size={'4'} weight={'bold'}>To:</Text>
                      <Flex direction={'column'} gap={'2'} maxWidth={'70%'}>
                        <Flex direction={'row'} gap={'2'} align={'center'}>
                          <FontAwesomeIcon icon={faWallet} />
                          <Text>Your Coinbase account</Text>
                        </Flex>
                        <Text size={'2'} align={'right'} wrap={'wrap'}>{currentUser?.coinbaseAddress.slice(0, 6)}...{currentUser?.coinbaseAddress.slice(-4)}</Text>
                      </Flex>
                    </Flex>
                  </Flex>
                  <Flex direction={'column'} align={'center'} gap={'7'} mt={'5'}>
                    <Dialog.Close>
                      <Button size={'4'} style={{width: '200px'}} 
                      onClick={() => {
                        const numericTransferInputValue = Number(transferInputValue);
                        if (numericTransferInputValue > 0 && walletForPurchase && currentUser.coinbaseAddress) {
                          sendUSDC(currentUser.coinbaseAddress as `0x${string}`, numericTransferInputValue);
                          setError(null);
                          setPendingMessage(null);
                          setTransferErrorMessage(null);
                          setTransferSuccessMessage(null);
                        } else {
                          console.error("Invalid transfer amount or wallet address.");
                          setError("Invalid transfer amount or wallet address. Unable to process the transaction.");
                        }
                      }}>
                        Confirm and send
                      </Button>
                    </Dialog.Close>
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
            {pendingMessage && (
              <Box mx={'3'}>
                <NotificationMessage message={pendingMessage} type="pending" />
              </Box>
            )}
            {tranferSuccessMessage && (
              <Box mx={'3'}>
                <NotificationMessage message={tranferSuccessMessage} type="success" />
              </Box>
            )}
            {transferErrorMessage && (
              <Box mx={'3'}>
                <NotificationMessage message={transferErrorMessage} type="error" />
              </Box>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  )
}