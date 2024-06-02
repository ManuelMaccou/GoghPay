'use client';

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from 'react'
import { CoinbaseButton } from "./components/coinbaseOnramp";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Merchant } from '../types/merchant';
import Login from '../components/Login';
import CustomLogin from "../components/CustomLogin";
import { createHmac } from 'crypto';
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { erc20Abi } from "viem";
import { encodeFunctionData } from "viem";
import Image from "next/image";
import NotificationMessage from "./components/Notification";

interface PurchaseParams {
  merchantId: string | null;
  product: string | null;
  price: number;
  walletAddress?: string | null;
}

interface VerificationParams {
  [key: string]: string | undefined;
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
  const [balance, setBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prettyAlert, setPrettyAlert] = useState<string | null>(null);
  const [showCoinbaseOnramp, setShowCoinbaseOnramp] = useState(false);
  const [showPayButton, setShowPayButton] = useState(false);
  const [isEmbeddedWallet, setIsEmbeddedWallet] = useState(false);
  const [redirectURL, setRedirectURL] = useState('');

  const searchParams = useSearchParams();
  const router = useRouter();
  const secretKey = process.env.SECURE_URL_KEY!;
  const merchantId = searchParams.get('merchantId');
  const product = searchParams.get('product');    
  const walletAddress = searchParams.get('walletAddress');
  const priceString = searchParams.get('price');
  const price = parseFloat(priceString || "0");
  const priceBigInt = !isNaN(price) ? BigInt(Math.round(price)) : null;

  const wallet = wallets[0]
  const activeWalletAddress = wallet?.address
  const merchantWalletAddress = walletAddress

  console.log('merchant wallet address:', merchantWalletAddress)
  

  useEffect(() => {
    const currentURL = window.location.href;
    console.log('currentURL:', currentURL)
    setRedirectURL(currentURL);
  }, []);
  
  console.log("redirectURL:", redirectURL)

  useEffect(() => {
    if (!merchantId || !product || !walletAddress || !price) {
      setIsValid(false);
      setPrettyAlert('Please scan a valid QR code to make a purchase.');
      return;
    }

    async function verify() {
      try {
        const response = await fetch('/api/verifySignature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
              const response = await fetch(`/api/merchant/${merchantId}`); // Getting merchant details to display on page
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
  }, [merchantId, product, walletAddress, price, searchParams]);

  useEffect(() => {
    if (wallet && wallet.walletClientType === 'privy') {
      setIsEmbeddedWallet(true);
    } else {
      setIsEmbeddedWallet(false);
    }
  }, [wallet]);

  async function sendUSDC(activeWalletAddress: `0x${string}`, merchantWalletAddress: `0x${string}`, price: number) {
    console.log('current chain:', wallet.chainId)
    if (!activeWalletAddress) {
      console.error('Error: Users wallet address is missing.');
      setError('There was an error. Please log in again.');
      return;
    }
    
    console.log('active wallet address while paying:', activeWalletAddress);
    const amountInUSDC = BigInt(price * 1_000_000);
    console.log('amountInUSDC:', amountInUSDC);

    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [merchantWalletAddress, amountInUSDC]
      })

      const transactionRequest = {
        from: activeWalletAddress,
        to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS!,
        data: data,
        value: 0x0,
      };

      const provider = await wallet.getEthereumProvider();
      const transactionHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [transactionRequest],
      });

      setSuccess('Transaction sent successfully!');
      console.log('provider:', provider)

      console.log('Transaction sent! Hash:', transactionHash);
    } catch (error) {
      if (isError(error)) {
        console.error('Error sending USDC:', error.message);
        setError(`Transaction failed: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
        setError('An unexpected error occurred');
      }
    }
  }
  
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
        console.log("balance:", balance);
        console.log('sufficient balance:', isSufficientBalance);

        if (!isSufficientBalance){
          setShowCoinbaseOnramp(true);
          setShowPayButton(false);
        } else {
          setShowPayButton(true);
          setShowCoinbaseOnramp(false);
        }
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
    <Flex direction={'column'} height={'100vh'} align={'center'} justify={'center'}>
    {authenticated && (
      <>
        <Heading size={'8'}>Confirm payment details</Heading>
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
            height: "auto"
          }} />

        {showCoinbaseOnramp && (
          <>
          <Flex direction={'column'} align={'center'} mx={'4'}>
            <Text align={'center'}>You don&apos;t have enough in your account to cover this item plus fees.</Text>
            <Text mb={'4'} align={'center'}>Continue with Coinbase to transfer funds.</Text>
          <CoinbaseButton
            destinationWalletAddress={activeWalletAddress || ""}
            price={purchaseParams.price || 0}
            redirectURL={redirectURL}/>
            <Text mt={'2'}>Current balance: ${balance}</Text>
            <div id="cbpay-container"></div>
            </Flex>
          </>
        )}
        {showPayButton && (
          <Button onClick={() => {
            if (price !== null && activeWalletAddress) {
              sendUSDC(activeWalletAddress as `0x${string}`, merchantWalletAddress as `0x${string}`, price);
            } else {
              console.error("Invalid price or wallet address.");
              setError("Invalid price or wallet address. Unable to process the transaction.");
            }
          }}>Purchase</Button>
        )}

        {/* REMOVE FOR PROD */}
        <Button variant='outline' mt={'9'} onClick={logout}>
          Log out
        </Button>
        {error && <NotificationMessage message={error} type="error" />}
          {success && <NotificationMessage message={success} type="success" />}
      </>
    )}
    </Flex>
  );
}