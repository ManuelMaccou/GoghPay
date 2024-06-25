'use client';

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from 'react'
import { CoinbaseButton } from "./components/coinbaseOnramp";
import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth';
import { Merchant } from "../types/types";
import { Box, Button, Flex, Heading, Text, Spinner, Badge, Callout, Card, AlertDialog } from "@radix-ui/themes";
import Image from "next/image";
import NotificationMessage from "./components/Notification";
import { User } from "../types/types";
import {createWalletClient, custom, encodeFunctionData, erc20Abi, createPublicClient, http} from 'viem';
import {createSmartAccountClient, ENTRYPOINT_ADDRESS_V06, walletClientToSmartAccountSigner} from 'permissionless';
import {signerToSimpleSmartAccount} from 'permissionless/accounts';
import {createPimlicoPaymasterClient} from 'permissionless/clients/pimlico';
import { base, baseSepolia } from "viem/chains";
import axios from "axios";
import { InfoCircledIcon, AvatarIcon } from "@radix-ui/react-icons";

interface PurchaseParams {
  merchantId: string | null;
  product: string | null;
  price: number;
  walletAddress?: string | null;
}

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Buy() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const [isValid, setIsValid] = useState(false);
  const [purchaseParams, setPurchaseParams] = useState<PurchaseParams>({
    merchantId: '',
    product: '',
    price: 0,
    walletAddress: ''
  });
  const [merchant, setMerchant] = useState<Merchant>();
  const [currentUser, setCurrentUser] = useState<User>();
  const [balance, setBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [prettyAlert, setPrettyAlert] = useState<string | null>(null);
  const [showCoinbaseOnramp, setShowCoinbaseOnramp] = useState(false);
  const [showPayButton, setShowPayButton] = useState(false);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [isEmbeddedWallet, setIsEmbeddedWallet] = useState(false);
  const [redirectURL, setRedirectURL] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isFetchingMerchant, setIsFetchingMerchant] = useState(true);


  const {user} = usePrivy();
  const {getAccessToken} = usePrivy();

  // Get params to verify signed URL
  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const priceString = searchParams.get('price');
  const price = parseFloat(priceString || "0");
  const priceBigInt = !isNaN(price) ? BigInt(Math.round(price)) : null;
  const product = searchParams.get('product');    
  const walletAddress = searchParams.get('walletAddress');
  
  const wallet = wallets[0]
  const activeWalletAddress = wallet?.address
  const merchantWalletAddress = walletAddress  

  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : 8453;
  console.log('chainIdNum:', chainIdNum);


  const disableLogin = !ready || (ready && authenticated);
  const { login } = useLogin({
    onComplete: async (user) => {
      console.log('login successful');
      const accessToken = await getAccessToken();
      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };

      try {
        console.log('fetching/adding user');
        await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error('Error fetching user details:', error.response?.data?.message || error.message);
        } else if (isError(error)) {
          console.error('Unexpected error:', error.message);
        } else {
          console.error('Unknown error:', error);
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

  useEffect(() => {
    const currentURL = window.location.href;
    setRedirectURL(currentURL);
  }, []);
  
  // Verify URL and get merchant details.
  useEffect(() => {
    if (!merchantId || !product || !walletAddress || !price) {
      setIsValid(false);
      setPrettyAlert('Please scan a valid QR code to make a purchase.');
      return;
    }

    async function verify() {
      setIsVerifying(true);
      try {
        const accessToken = await getAccessToken();
        const response = await fetch('/api/verifySignature', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
          body: JSON.stringify({
            params: { merchantId, product, price, walletAddress },
            signature: searchParams.get('signature')
          })
        });

        const data = await response.json();
        console.log('data:', data)
        setIsVerifying(false);

        if (data.isValid) {
          setIsValid(true);
          setPurchaseParams({ merchantId, product, price, walletAddress });
        } else {
          setIsVerifying(false);
          setIsValid(false);
          setPrettyAlert('Please scan a valid QR code to make a purchase.');
        }
      } catch (error) {
        console.error('Error verifying signature:', error);
        setIsVerifying(false);
        setIsValid(false);
        setPrettyAlert('Please scan a valid QR code to make a purchase.');
      }
    }

    verify();
  }, [merchantId, product, walletAddress, price, getAccessToken, searchParams]);

  useEffect(() => {
    if (isValid && merchantId) {
      setIsFetchingMerchant(true);
      const fetchMerchant = async () => {
        try {
          const response = await fetch(`/api/merchant/${merchantId}`);
          const data = await response.json();
          setMerchant(data);
        } catch (err) {
          if (isError(err)) {
            setError(`Error fetching merchant: ${err.message}`);
          } else {
            setError('Error fetching merchant');
          }
        }
      };
      setIsFetchingMerchant(false);
      fetchMerchant();
    }
  }, [isValid, merchantId]);

  // Determine if the user has an embedded wallet
  useEffect(() => {
    if (wallet && wallet.walletClientType === 'privy') {
      setIsEmbeddedWallet(true);
    } else {
      setIsEmbeddedWallet(false);
    }
  }, [wallet]);


  // Fetch current user
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
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
    }
  }, [authenticated, ready, user]);

  async function sendUSDC(activeWalletAddress: `0x${string}`, merchantWalletAddress: `0x${string}`, price: number) {
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

    console.log('current chain:', wallet.chainId);
    console.log('active wallet address', activeWalletAddress);
    if (!activeWalletAddress) {
      console.error('Error: Users wallet address is missing.');
      setError('There was an error. Please log in again.');
      return;
    }
    
    const amountInUSDC = BigInt(price * 1_000_000);
    console.log('amount in USDC:', amountInUSDC)

    setIsLoading(true);
    setPendingMessage('Please wait...');

    try {
      const smartAccountClient = await setupSmartAccountClient(activeWalletAddress);
      
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [merchantWalletAddress, amountInUSDC]
      })

      console.log("amount to send:", amountInUSDC);
      console.log('data object:', data);

      const transactionHash = await smartAccountClient.sendTransaction({
        account: smartAccountClient.account,
        to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS as `0x${string}`,
        data: data,
        value: BigInt(0),
        maxFeePerGas: BigInt(20000000),
        maxPriorityFeePerGas: BigInt(12000000),
      });
      setPendingMessage(null);
      setSuccess('Purchase successful!');
      console.log('Transaction sent! Hash:', transactionHash);

      await saveTransaction({
        merchantId: merchant?._id,
        buyerId: currentUser?._id,
        buyerPrivyId: currentUser?.privyId,
        productName: purchaseParams.product,
        productPrice: price,
        transactionHash: transactionHash,
      });

    } catch (error) {
      if (isError(error)) {
        console.error('Error sending USDC:', error.message);
        setError(`Transaction failed: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false); // Set loading state to false
      setPendingMessage(null);
    }
  }

  // Setup smart account client
  async function setupSmartAccountClient(activeWalletAddress: `0x${string}`) {
    const eip1193provider = await wallet.getEthereumProvider();
    console.log("eip1193provider:", eip1193provider)

    // Create a viem WalletClient from the embedded wallet's EIP1193 provider
    // This will be used as the signer for the user's smart account
    const privyClient = createWalletClient({
      account: activeWalletAddress,
      chain: base,
      transport: custom(eip1193provider)
    });

    console.log("privyClient:", privyClient)

    // Create a viem public client for RPC calls
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    console.log("publicClient:", publicClient)

    // Initialize the smart account for the user
    const customSigner = walletClientToSmartAccountSigner(privyClient);
    const simpleSmartAccount = await signerToSimpleSmartAccount(publicClient, {
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      signer: customSigner,
      factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454',
    });

    console.log("customSigner:", customSigner)

    // Create the Paymaster for gas sponsorship 
    const rpcUrl = process.env.NEXT_PUBLIC_PAYMASTER_COINBASE_RPC
    const cloudPaymaster = createPimlicoPaymasterClient({
      chain: base,
      transport: http("https://api.developer.coinbase.com/rpc/v1/base/G5DZoWOhz4SitN8faJSQvTSyllBnh3YE"),
      entryPoint: ENTRYPOINT_ADDRESS_V06,
    });

    // Create the SmartAccountClient for requesting signatures and transactions (RPCs)
    return createSmartAccountClient({
      account: simpleSmartAccount,
      chain: base,
      bundlerTransport: http("https://api.developer.coinbase.com/rpc/v1/base/G5DZoWOhz4SitN8faJSQvTSyllBnh3YE"),
      middleware: {
        sponsorUserOperation: cloudPaymaster.sponsorUserOperation,
      },
    });
  }


  // Save transaction
  async function saveTransaction(transactionData: any) {
    const accessToken = await getAccessToken();
    try {
      const response = await fetch('/api/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 

        },
        body: JSON.stringify(transactionData),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save transaction');
      }
  
      const data = await response.json();
      console.log('Transaction saved:', data);
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  }

// check the experience for non embedded wallets. Is it good?
// Make sure to change the chainID.
  useEffect(() => {
    if(ready && authenticated && isValid && activeWalletAddress) {
      const fetchBalance = async () => {
        setIsBalanceLoading(true);
        try {
          const response = await fetch(`/api/crypto/get-usdc-balance?address=${activeWalletAddress}`);
          if (!response.ok) {
            throw new Error('Failed to fetch balance');
          }
          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          } else {
            setBalance(parseFloat(data.balance));
          }
        } catch (error) {
          if (isError(error)) {
            console.error('Error checking balance:', error.message);
            setError(`Balance check failed: ${error.message}`);
          } else {
            console.error('An unexpected error occurred:', error);
            setError('An unexpected error occurred');
          }
        } finally {
          setIsBalanceLoading(false);
        }
      };
      fetchBalance();

      // const isSufficientBalance = balance >= price + 1;

      if (balance < price){
        setShowPayButton(false);
        setShowCoinbaseOnramp(true);
      } else {
        setShowPayButton(true);
        setShowCoinbaseOnramp(false);
      }
    };
    
  },[ready, authenticated, activeWalletAddress, isEmbeddedWallet, isValid, balance, price]);

  if (ready && !isValid && !isVerifying) {
    return (
      <Flex height={'100vh'} direction={'column'} align={'center'} justify={'center'} flexGrow={'1'}>
        <Text m={'100'}>Invalid or tampered link.</Text>
      </Flex>
    );
  }

  if (!ready) {
    return (
      <Flex height={'100vh'} direction={'column'} align={'center'} justify={'center'} flexGrow={'1'}>
        <Spinner />
      </Flex>
    );
  }

  return (
    <Flex direction={'column'} minHeight={'100vh'} width={'100%'} align={'center'} justify={'between'} pb={'9'} pt={'6'} px={'5'}>
      <Box width={'100%'}>
        {isEmbeddedWallet && authenticated ? (
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
        ) : (!isEmbeddedWallet && authenticated ? (
          <Card variant="ghost" mb={'3'}>
          <Flex gap="3" align="center" justify={'end'}>
            <AvatarIcon />
            <Box>
              <Text as="div" size="2" color="gray">
                {activeWalletAddress?.slice(0, 6)}
              </Text>
            </Box>
          </Flex>
        </Card>
        ): null)}
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
        <Heading size={'7'} align={'center'}>Confirm details</Heading>
      </Box>
      {!isFetchingMerchant ? (
        <Box width={'100%'}>
          <Flex justify={'center'}>
            <Image
              src={merchant?.storeImage || "" }
              alt="merchant logo"
              width={960}
              height={540}
              priority
              placeholder='empty'
              sizes="100vw"
              style={{
                width: "40%",
                height: "auto",
                marginBottom: "50px",
                maxWidth: "100%",
              }} 
            /> 
            </Flex>
            <Flex direction={'column'} align={'center'} mb={'2'}>
              <Text size={'9'} my={'4'}>
                ${price}
              </Text>
              <Text size={'8'}>
                {product}
              </Text>
            </Flex>
          </Box>
        ) : (
          <Spinner />
        )}

        <Box width={'100%'}>
        <Flex direction={'column'} align={'center'}>
        {authenticated ? (
          <>
          {pendingMessage && 
            <Box mx={'3'}>
              <NotificationMessage message={pendingMessage} type="pending" />
            </Box>
          }
          {error && 
            <Box mx={'3'}>
              <NotificationMessage message={error} type="error" />
            </Box>
          }
          {success && 
            <Box mx={'3'}>
              <NotificationMessage message={success} type="success" />
            </Box>
          }
          {showCoinbaseOnramp && (
            <Flex direction={'column'} align={'center'} mx={'4'}>
              {isEmbeddedWallet ? (
                <>
                {!isBalanceLoading && (
                  <Callout.Root color="red" mb={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You don&apos;t have enough funds in your account to complete this purchase. Continue with crypto or use mobile pay.
                    </Callout.Text>
                  </Callout.Root>
                )}
                </>
              ) : (
                <>
                {!isBalanceLoading && (
                  <Callout.Root color="red" mb={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You don&apos;t have enough funds in your wallet to complete this purchase. Transfer funds from your Coinbase account or obtain USDC on Base.
                    </Callout.Text>
                  </Callout.Root>
                )}
                </>
              )}


              <AlertDialog.Root>
                <AlertDialog.Trigger>
                  <Button style={{
                    backgroundColor: '#0051FD',
                    width: '200px'
                  }}>Pay with crypto</Button>
                </AlertDialog.Trigger>
                <AlertDialog.Content maxWidth="450px">
                  <AlertDialog.Title>Pay with crypto</AlertDialog.Title>
                  <AlertDialog.Description size="2">
                    Paying in crypto supports local merchants by saving them money and eliminating bank fees.
                    If you have a Coinbase account, you can sign in and transfer money to your Gogh account.
                    If you don&apos;t, we recommend using mobile pay for now, and signing up later. 
                    It takes about 5 minutes.
                  </AlertDialog.Description>

                  <Flex gap="3" mt="4" justify="end">
                    <AlertDialog.Cancel>
                      <Button variant="soft" color="gray">
                        Cancel
                      </Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action>
                      <CoinbaseButton
                        destinationWalletAddress={activeWalletAddress || ""}
                        price={purchaseParams.price || 0}
                        redirectURL={redirectURL}
                      />
                    </AlertDialog.Action>
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>

              {/*<div id="cbpay-container"></div>*/}
            </Flex>
          )}

          {showPayButton && (
            <Button size={'4'} loading={isLoading} disabled={!!success} style={{
              width: '200px'
              }} 
              onClick={() => {
              setShowConfirmButton(true);
              setShowPayButton(false);
              setError(null);
              setSuccess(null);
            }}>
              Purchase
            </Button>
          )}

          {showConfirmButton && (
            <Flex direction={'row'} gap={'3'}>
              <Button size={'4'} loading={isLoading} disabled={!!success} style={{
                width: '150px'
                }} 
                onClick={() => {
                if (price !== null && activeWalletAddress) {
                  sendUSDC(activeWalletAddress as `0x${string}`, merchantWalletAddress as `0x${string}`, price);
                  setError(null);
                  setSuccess(null);
                } else {
                  console.error("Invalid price or wallet address.");
                  setError("Invalid price or wallet address. Unable to process the transaction.");
                }
                }}>
                  Confirm
              </Button>
              <Button size={'4'} variant="surface" style={{
                width: '150px'
                }} 
                onClick={() => {
                setShowConfirmButton(false);
                setShowPayButton(true);
                setError(null);
                setSuccess(null);
              }}>
                Cancel
              </Button>
            </Flex>
          )}
          </>
        ) : (
          <Button mt={'9'} disabled={disableLogin} style={{
              width: '200px'
            }} onClick={login}>
            Log in to buy
          </Button>
        )}
        </Flex>
        </Box>
      </Flex>
    );
}