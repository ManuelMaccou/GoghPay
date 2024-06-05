'use client';

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from 'react'
import { CoinbaseButton } from "./components/coinbaseOnramp";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Merchant } from "../types/types";
import Login from '../components/Login';
import { Box, Button, Flex, Heading, Strong, Text } from "@radix-ui/themes";
import { erc20Abi } from "viem";
import { encodeFunctionData } from "viem";
import Image from "next/image";
import NotificationMessage from "./components/Notification";
import { User } from "../types/types";

import {Chain, createWalletClient, custom} from 'viem';
import {createSmartAccountClient, ENTRYPOINT_ADDRESS_V06, walletClientToSmartAccountSigner} from 'permissionless';
import {signerToSimpleSmartAccount} from 'permissionless/accounts';
import {createPimlicoPaymasterClient} from 'permissionless/clients/pimlico';
import {createPublicClient, http} from 'viem';
import { base, baseSepolia } from "viem/chains";

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
  const [prettyAlert, setPrettyAlert] = useState<string | null>(null);
  const [showCoinbaseOnramp, setShowCoinbaseOnramp] = useState(false);
  const [showPayButton, setShowPayButton] = useState(false);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [isEmbeddedWallet, setIsEmbeddedWallet] = useState(false);
  const [redirectURL, setRedirectURL] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const product = searchParams.get('product');    
  const walletAddress = searchParams.get('walletAddress');
  const priceString = searchParams.get('price');
  const price = parseFloat(priceString || "0");
  const priceBigInt = !isNaN(price) ? BigInt(Math.round(price)) : null;
  const {user} = usePrivy();

  const {getAccessToken} = usePrivy();

  const wallet = wallets[0]
  const activeWalletAddress = wallet?.address
  const merchantWalletAddress = walletAddress  

  useEffect(() => {
    const currentURL = window.location.href;
    setRedirectURL(currentURL);
  }, []);
  
  // Verify URL and get merchant details
  useEffect(() => {
    if (!merchantId || !product || !walletAddress || !price) {
      setIsValid(false);
      setPrettyAlert('Please scan a valid QR code to make a purchase.');
      return;
    }

    async function verify() {
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
        if (data.isValid) {
          setIsValid(true);
          setPurchaseParams({ merchantId, product, price, walletAddress });

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

          fetchMerchant();
        } else {
          setIsValid(false);
          setPrettyAlert('Please scan a valid QR code to make a purchase.');
        }
      } catch (error) {
        console.error('Error verifying signature:', error);
        setIsValid(false);
        setPrettyAlert('Please scan a valid QR code to make a purchase.');
      }
    }

    verify();
  }, [merchantId, product, walletAddress, price, getAccessToken, searchParams]);

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
        maxPriorityFeePerGas: BigInt(10000000),
      });

      
  

      setSuccess('Transaction sent successfully!');
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
      chain: baseSepolia,
      transport: custom(eip1193provider)
    });

    console.log("privyClient:", privyClient)

    // Create a viem public client for RPC calls
    const publicClient = createPublicClient({
      chain: baseSepolia,
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
      chain: baseSepolia,
      transport: http("https://api.developer.coinbase.com/rpc/v1/base-sepolia/G5DZoWOhz4SitN8faJSQvTSyllBnh3YE"),
      entryPoint: ENTRYPOINT_ADDRESS_V06,
    });

    // Create the SmartAccountClient for requesting signatures and transactions (RPCs)
    return createSmartAccountClient({
      account: simpleSmartAccount,
      chain: baseSepolia,
      bundlerTransport: http("https://api.developer.coinbase.com/rpc/v1/base-sepolia/G5DZoWOhz4SitN8faJSQvTSyllBnh3YE"),
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
      if (isEmbeddedWallet) { // Eventually this will change when magic spend supports USDC. Then you wont need to check balance and magic spend will handle it if balance is low.
        const fetchBalance = async () => {
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
          }
        };
        fetchBalance();

        const isSufficientBalance = balance >= price + 1;

        if (!isSufficientBalance){
          setShowCoinbaseOnramp(true);
          setShowPayButton(false);
        } else {
          setShowPayButton(true);
          setShowCoinbaseOnramp(false);
        }
      } else {
        setShowPayButton(true);
        setShowCoinbaseOnramp(false);
      }
    };
    
  },[ready, authenticated, activeWalletAddress, isEmbeddedWallet, isValid, balance, price]);

  if (!authenticated) {
    return <Login />;
  }

  if (!isValid) {
    return <p>Invalid or tampered link.</p>;
  }

  return (
    <Flex direction={'column'} my={'6'} minHeight={'100vh'} align={'center'} justify={'center'}>
    {authenticated && (
      <>
      <Box maxWidth={'70%'} my={'5'}>
        <Heading size={'7'} align={'center'}>Confirm payment details</Heading>
        </Box>
        <Image
          src={merchant?.storeImage || "/logos/gogh_logo_black.png" }
          alt="Gogh"
          width={960}
          height={540}
          priority
          sizes="100vw"
          style={{
            width: "100%",
            height: "auto",
            marginBottom: "50px",
            maxWidth: "100%",
          }} /> 
        <Flex direction={'column'} width={'80%'} m={'6'}>
          <Flex direction={'row'} width={'100%'} justify={'between'}>
          <Text size={'6'}><Strong>Product: </Strong></Text>
          <Text size={'6'}>{product}</Text>
          </Flex>
          <Flex direction={'row'} width={'100%'} justify={'between'}>
          <Text size={'6'}><Strong>Price: </Strong></Text>
          <Text size={'6'}>${price}</Text>
          </Flex>
        </Flex>

        {showCoinbaseOnramp && (
          <>
          <Flex direction={'column'} align={'center'} mx={'4'}>
            <Text align={'center'}>You don&apos;t have enough in your account to cover this item plus fees.</Text>
            <Text mb={'4'} align={'center'}>Continue with Coinbase to transfer funds.</Text>
          <CoinbaseButton
            destinationWalletAddress={activeWalletAddress || ""}
            price={purchaseParams.price || 0}
            redirectURL={redirectURL}/>
            <div id="cbpay-container"></div>
            </Flex>
          </>
        )}
        {showPayButton && (
          <Button size={'4'} loading={isLoading} disabled={!!success} onClick={() => {
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
          <Button size={'4'} loading={isLoading} disabled={!!success} onClick={() => {
            if (price !== null && activeWalletAddress) {
              sendUSDC(activeWalletAddress as `0x${string}`, merchantWalletAddress as `0x${string}`, price);
              setError(null);
              setSuccess(null);
            } else {
              console.error("Invalid price or wallet address.");
              setError("Invalid price or wallet address. Unable to process the transaction.");
            }
          }}>Confirm</Button>
          <Button size={'4'} variant="surface" onClick={() => {
            setShowConfirmButton(false);
            setShowPayButton(true);
            setError(null);
            setSuccess(null);
          }}>
            Cancel
          </Button>

          </Flex>
        )}

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

        {isEmbeddedWallet && (
          <Text mt={'2'}>Current balance: ${balance}</Text>
        )}
        
        {/* REMOVE FOR PROD */}
        <Button variant='outline' mt={'9'} onClick={logout}>
          Log out
        </Button>
      </>
    )}
    </Flex>
  );
}