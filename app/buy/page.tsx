'use client';

import { useSearchParams, useRouter, redirect } from "next/navigation"
import { useState, useEffect, Suspense, useCallback } from 'react'
import { CoinbaseButton } from "./components/coinbaseOnramp";
import { getEmbeddedConnectedWallet, useLogin, usePrivy, useWallets } from '@privy-io/react-auth';
import { Merchant } from "../types/types";
import { Box, Button, Flex, Heading, Text, Spinner, Badge, Callout, Card, AlertDialog, Link, Dialog, VisuallyHidden, Separator, TextField, IconButton, RadioCards } from "@radix-ui/themes";
import * as Avatar from '@radix-ui/react-avatar';
import NotificationMessage from "../components/Notification";
import { User } from "../types/types";
import {createWalletClient, custom, encodeFunctionData, erc20Abi, createPublicClient, http, parseAbiItem, Chain} from 'viem';
import {createSmartAccountClient, ENTRYPOINT_ADDRESS_V07, walletClientToSmartAccountSigner} from 'permissionless';
import {signerToSafeSmartAccount} from 'permissionless/accounts';
import {createPimlicoBundlerClient} from 'permissionless/clients/pimlico';
import { base, baseSepolia } from "viem/chains";
import axios from "axios";
import { InfoCircledIcon, AvatarIcon, CopyIcon, CrossCircledIcon, TrashIcon } from "@radix-ui/react-icons";
import { pimlicoPaymasterActions } from "permissionless/actions/pimlico";
import { BalanceProvider } from "../contexts/BalanceContext";
import { Header } from "../components/Header";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWallet } from "@fortawesome/free-solid-svg-icons";
import { checkAndRefreshToken } from "../lib/refresh-tokens";
import * as Sentry from '@sentry/nextjs';

interface PurchaseParams {
  merchantId: string | null;
  product: string | null;
  price: number;
  walletAddress?: string | null;
}

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function BuyContent() {
  const { ready, authenticated } = usePrivy();
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
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [onrampError, setOnrampError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [prettyAlert, setPrettyAlert] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [copyConfirmMessage, setCopyConfirmMessage] = useState<string | null>(null);
  const [showCoinbaseOnramp, setShowCoinbaseOnramp] = useState(false);
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [showPayButton, setShowPayButton] = useState(false);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [isEmbeddedWallet, setIsEmbeddedWallet] = useState(false);
  const [redirectURL, setRedirectURL] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isFetchingMerchant, setIsFetchingMerchant] = useState(true);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

  const router = useRouter();

  const {user} = usePrivy();
  const {getAccessToken} = usePrivy();

  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const product = searchParams.get('product');   
  const walletAddress = searchParams.get('walletAddress');
  const signature = searchParams.get('signature')

  const priceString = searchParams.get('price');
  const price = parseFloat(priceString || "0");
  if (isNaN(price)) {
    console.error('Price is not a valid number');
    setError('Provided price is invalid');
  }

  const salesTax = searchParams.get('salesTax');

  const salesTaxNum = parseFloat(salesTax || "0");
  if (isNaN(salesTaxNum)) {
    console.error('sales tax is not a valid number');
    setError('Provided sales tax is invalid');
  }

  const calculatedSalesTax = (salesTaxNum/100) * price; 


   

  const [selectedTip, setSelectedTip] = useState<string>('0');
  const [tipAmount, setTipAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(price);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setFinalPrice(price + tipAmount + calculatedSalesTax);
  }, [price, tipAmount, calculatedSalesTax]);

  const handleValueChange = (value:string) => {
    setError(null);
    setSelectedTip(value);
    if (value === '4') {
      setIsDialogOpen(true);
      return;
    }
    let tipPercentage = 0;
    switch (value) {
      case '1':
        tipPercentage = 0.15;
        break;
      case '2':
        tipPercentage = 0.20;
        break;
      case '3':
        tipPercentage = 0.25;
        break;
      default:
        tipPercentage = 0;
    }
    setTipAmount(price * tipPercentage);
  };

  const handleCustomTipChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const value = parseFloat(event.target.value);
    setTipAmount(isNaN(value) ? 0 : value);
  };

  const resetTipAmount = () => {
    setError(null);
    setTipAmount(0);
    setSelectedTip('0');
  };
  
  
  const wallet = wallets[0]
  const activeWalletAddress = wallet?.address
  const merchantWalletAddress = walletAddress
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : 8453;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

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

  const disableLogin = !ready || (ready && authenticated);
  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      setError(null);

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
    if (!currentUser.smartAccountAddress && smartWallet) {
      updateUserWithSmartWalletAddress(smartWallet)
    }
  }, [currentUser, setCurrentUser, user, getAccessToken])

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
            params: { merchantId, product, price: priceString, salesTax, walletAddress },
            signature: signature
          })
        });

        const data = await response.json();
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
  }, [merchantId, product, walletAddress, price, priceString, salesTax, getAccessToken, signature]);

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
        const walletAddress = userData.user.smartAccountAddress || userData.user.walletAddress;
        setWalletForPurchase(walletAddress);
        
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
      console.log('fetching user from use effect');
    }
  }, [activeWalletAddress, authenticated, ready, user ]);
  
  const handleMobilePay = async () => {
    setIsLoading(true);
    setError(null);

    const requestData = {
      ...purchaseParams,
      finalPrice: finalPrice,
      stripeConnectedAccountId: merchant?.stripeConnectedAccountId,
      redirectURL: window.location.href,
      merchantObject: merchant
    };

    try {
      const response = await fetch('/api/stripe/checkout/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to process checkout');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No URL provided for redirect');
      }
    } catch (error) {
      if (isError(error)) {
        console.error('Error initiating mobile pay checkout:', error.message);
        setError(`Creating mobile pay checkout failed: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  async function sendUSDC(merchantWalletAddress: `0x${string}`, finalPrice: number) {
    setError(null);
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

    if (!walletForPurchase) {
      console.error('Error: Users wallet address is missing.');
      setError('There was an error. Please log in again.');
      return;
    }
    
    const amountInUSDC = BigInt(finalPrice * 1_000_000);

    setPurchaseStarted(true)
    setPendingMessage('Please wait...');

    if (embeddedWallet) {
      console.log("wallet address for pimlico:", wallet.address)
      try {
        const erc20PaymasterAddress = process.env.NEXT_PUBLIC_ERC20_PAYMASTER_ADDRESS as `0x${string}`;
        const eip1193provider = await wallet.getEthereumProvider();
  
        const privyClient = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
          transport: custom(eip1193provider)
        });
  
        const customSigner = walletClientToSmartAccountSigner(privyClient);
  
        const publicClient = createPublicClient({
          chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
          transport: http(),
        });
  
        const bundlerClient = createPimlicoBundlerClient({
          transport: http(rpcUrl),
          entryPoint: ENTRYPOINT_ADDRESS_V07
        }).extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))
  
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

        console.log('smart account address:', account.address);
  
        const smartAccountClient = createSmartAccountClient({
          account,
          entryPoint: ENTRYPOINT_ADDRESS_V07,
          chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
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
          args: [merchantWalletAddress, amountInUSDC]
        })

        console.log('smart account client address:', smartAccountClient.account.address);
    
        const transactionHash = await smartAccountClient.sendTransaction({
          // account: smartAccountClient.account,
          to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS as `0x${string}`,
          data: data,
          value: BigInt(0),
          maxFeePerGas: BigInt(1000000000), // 1 Gwei
          maxPriorityFeePerGas: BigInt(1000000000), // 1 Gwei
          gas: BigInt(1000000000),
        });
        setPendingMessage(null);
        setPurchaseStarted(false)
        console.log('Transaction sent! Hash:', transactionHash);
  
        await saveTransaction({
          merchantId: merchant?._id,
          buyerId: currentUser?._id,
          buyerPrivyId: currentUser?.privyId,
          productName: purchaseParams.product,
          productPrice: price,
          tipAmount: tipAmount,
          salesTax: calculatedSalesTax,
          transactionHash: transactionHash,
          paymentType: 'sponsored crypto'
        });
  
        const params = new URLSearchParams({
          merchantId: merchant?._id ?? '',
          productName: purchaseParams?.product?.toString() ?? 'undefined',
          price: finalPrice.toString(),
          transactionHash: transactionHash.toString(),
          checkout_method: "wallet",
        });
    
        router.push(`/checkout/success/crypto?${params.toString()}`);
  
      } catch (error) {
        if (isError(error)) {
          console.error('Error sending USDC:', error.message); // REMOVE THIS FOR PRODUCTION. IT LOGS SENSITIVE INFO
          setError(`Transaction failed: ${error.message}`);
        } else {
          console.error('An unexpected error occurred:', error);
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false); // Set loading state to false
        setPendingMessage(null);
      }

    } else {
      try {
        const provider = await wallet.getEthereumProvider();

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [merchantWalletAddress, amountInUSDC]
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
        setPurchaseStarted(false)
        console.log('Transaction sent! Hash:', transactionHash);

        await saveTransaction({
          merchantId: merchant?._id,
          buyerId: currentUser?._id,
          buyerPrivyId: currentUser?.privyId,
          productName: purchaseParams.product,
          productPrice: price,
          tipAmount: tipAmount,
          salesTax: calculatedSalesTax,
          transactionHash: transactionHash,
          paymentType: 'crypto'
        });
  
        const params = new URLSearchParams({
          merchantId: merchant?._id ?? '',
          productName: purchaseParams?.product?.toString() ?? 'undefined',
          price: finalPrice.toString(),
          transactionHash: transactionHash.toString(),
          checkout_method: "wallet",
        });
    
        router.push(`/checkout/success/crypto?${params.toString()}`);
  
      } catch (error) {
        if (isError(error)) {
          console.error('Error sending USDC:', error.message); // REMOVE THIS FOR PRODUCTION. IT LOGS SENSITIVE INFO
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
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  }

  // Stripe onramp
  const createOnrampSession = async () => {
    console.log('wallet for purchase:', walletForPurchase);
    setIsLoading(true);
    setOnrampError(null);
    setFallbackLink(null);

    if (!walletForPurchase) {
      setOnrampError('Error: Destination account is missing. Try refreshing the page.')
      return;
    }

    try {
      const res = await fetch(`/api/stripe/createOnrampSession?amount=${encodeURIComponent(finalPrice + 1)}&address=${walletForPurchase}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!res.ok) {
        throw new Error('Failed to create onramp session');
      }
      const data = await res.json();
      const onrampUrl = new URL(data.redirect_url);

      // Create and submit a form to avoid pop-up blockers
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = onrampUrl.origin + onrampUrl.pathname;
      form.target = '_blank';  // Opens in a new tab
      console.log('onrampUrl:', onrampUrl.href);  // Log the full URL

      // Append all query parameters as hidden fields
      for (const [key, value] of onrampUrl.searchParams.entries()) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = key;
        hiddenInput.value = value;
        form.appendChild(hiddenInput);
      }

      document.body.appendChild(form);

      try {
        form.submit();
      } catch (submitError) {
        // If the form submission fails for any reason, set the fallback link
        setOnrampError("Redirect failed. Please click the link below to proceed:");
        setFallbackLink(onrampUrl.href);
      } finally {
        document.body.removeChild(form);  // Clean up
      }

    } catch (err: any) {
      setOnrampError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if(ready && authenticated && isValid && walletForPurchase) {
      const fetchBalance = async () => {
        console.log('is fetching balance');
        setIsBalanceLoading(true);
        try {
          const response = await fetch(`/api/crypto/get-usdc-balance?address=${walletForPurchase}`);
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

      if (balance < (price + 1)){
        setShowPayButton(false);
        setShowCoinbaseOnramp(true);
      } else {
        setShowPayButton(true);
        setShowCoinbaseOnramp(false);
      }
    };
    
  },[ready, authenticated, walletForPurchase, isValid, balance, price, currentUser]);

  useEffect(() => {
    if (!balance) return;

    if (balance < (finalPrice + 1)){
      setShowPayButton(false);
      setShowCoinbaseOnramp(true);
    } else {
      setShowPayButton(true);
      setShowCoinbaseOnramp(false);
    }
  },[balance, finalPrice]);

  useEffect(() => {
    if (merchant) {
      checkAndRefreshToken(merchant._id)
    }
  }, [merchant]);

  const copyToClipboard = useCallback(() => {
    if (walletForPurchase) {
    navigator.clipboard.writeText(walletForPurchase)
      .then(() => {
        setCopyConfirmMessage('Address copied to clipboard');
        setTimeout(() => setCopyConfirmMessage(''), 3000); // Clear message after 3 seconds
      })
      .catch(() => {
        setCopyConfirmMessage('Failed to copy address');
        setTimeout(() => setCopyConfirmMessage(''), 3000); // Clear message after 3 seconds
      });
    }
  }, [walletForPurchase]);

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
      {/* <Heading size={'7'} align={'center'}>Confirm details</Heading> */}
      <Flex height={'100%'} flexGrow={'1'} direction={'column'} justify={'center'} align={'center'}>
       {/* The button to launch the embedded experience. Must not be in a dialog. It seems to not work. Maybe I can fix that?
   
      <Flex
        <StripeOnrampButton />
      </Flex>
      */}

        {!isFetchingMerchant ? (
          <Box width={'100%'}>
            <Flex justify={'center'}>

              <Avatar.Root>
                <Avatar.Image 
                className="MerchantLogo"
                src={merchant?.storeImage }
                alt="Merchant Logo"
                style={{objectFit: "contain", maxWidth: '200px'}}
                />
                
              </Avatar.Root>

            
              </Flex>
              <Flex direction={'column'} align={'center'} mb={'2'}>
                <Text size={'9'} my={'4'}>
                  ${price.toFixed(2)}
                </Text>
                <Flex direction={'column'} gap={'4'} width={'100%'} mt={'3'}>
                  {calculatedSalesTax > 0 && (
                    <Flex direction={'row'} justify={'between'} width={'100%'}>
                      <Text align={'center'} size={'5'}>+ ${calculatedSalesTax.toFixed(2)}</Text>
                      <Text align={'center'} size={'5'}>sales tax</Text>
                    </Flex>
                  )}
                  {tipAmount > 0 && (
                    <Flex direction={'row'} justify={'between'} width={'100%'}>
                      <Text align={'center'} size={'5'}>+ ${tipAmount.toFixed(2)}</Text>
                      <Flex direction={'row'} gap={'3'}>
                        <Text align={'center'} size={'5'}>tip</Text>
                        <IconButton variant="ghost" color="red" onClick={resetTipAmount}>
                          <CrossCircledIcon width={'20'} height={'20'}/>
                        </IconButton>
                      </Flex>
                    </Flex>
                  )}
                </Flex>
                
              </Flex>
            </Box>
          ) : (
            <Spinner />
          )}
        </Flex>

        <Box width={'100%'}>
        <Flex direction={'column'} align={'center'}>
        {authenticated ? (
          <>
          {pendingMessage && (
            <Box mx={'3'}>
              <NotificationMessage message={pendingMessage} type="pending" />
            </Box>
          )}
          {error && (
            <Box mx={'3'}>
              <NotificationMessage message={error} type="error" />
            </Box>
          )}
          
          <Flex direction={'column'} width={'100%'} mt={'4'} mb={'7'} align={'center'} gap={'3'}>
            <Text size={'4'} align={'center'}>Add a tip?</Text>
            <RadioCards.Root columns={'4'} gap={'3'} size={'1'} value={selectedTip} onValueChange={handleValueChange}>
              <RadioCards.Item value="1">
                <Flex direction="column" width="100%">
                  <Text align={'center'} weight="bold">15%</Text>
                  <Text align={'center'}>${(price * .15).toFixed(2)}</Text>
                </Flex>
              </RadioCards.Item>
              <RadioCards.Item value="2">
                <Flex direction="column" width="100%">
                  <Text align={'center'} weight="bold">20%</Text>
                  <Text align={'center'}>${(price * .20).toFixed(2)}</Text>
                </Flex>
              </RadioCards.Item>
              <RadioCards.Item value="3">
                <Flex direction="column" width="100%">
                  <Text align={'center'} weight="bold">25%</Text>
                  <Text align={'center'}>${(price * .25).toFixed(2)}</Text>
                </Flex>
              </RadioCards.Item>
              <RadioCards.Item value="4">
                <Flex direction="column" width="100%">
                  <Text size={'1'} align={'center'} weight="bold">Custom</Text>
                </Flex>
              </RadioCards.Item>
            </RadioCards.Root>
          </Flex>

          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Trigger>
              <Button style={{ display: 'none' }} />
            </Dialog.Trigger>

            <Dialog.Content maxWidth="450px">
              <VisuallyHidden>
                <Dialog.Title>Enter tip amount</Dialog.Title>
              </VisuallyHidden>
              <VisuallyHidden>
                <Dialog.Description size="2" mb="4">
                  Enter a tip amount.
                </Dialog.Description>
              </VisuallyHidden>

              <Flex direction="column" gap="3">
                <label>
                  <Text as="div" size="2" mb="1" weight="bold">
                    Enter dollar amount
                  </Text>
                  <TextField.Root placeholder="Enter amount" type="number" value={tipAmount} onChange={handleCustomTipChange}>
                  <TextField.Slot>
                    <Text>$</Text>
                  </TextField.Slot>
                  </TextField.Root>
                </label>
              </Flex>

              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button>Ok</Button>
                </Dialog.Close>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
          {showCoinbaseOnramp && (
            isBalanceLoading ? (
              <>
                <Text>Fetching balance...</Text>
                <Spinner />
              </>
            ) : (
              <Flex direction={'column'} align={'center'} mx={'4'}>
              {/*
              {embeddedWallet ? (
                !isBalanceLoading && (
                  <Callout.Root color="red" mb={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You don&apos;t have enough funds in your account to complete this purchase. Continue with crypto or use mobile pay.
                    </Callout.Text>
                  </Callout.Root>
                )
              ) : (
                !isBalanceLoading && (
                  <Callout.Root color="red" mb={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You don&apos;t have enough funds in your wallet to complete this purchase. Transfer funds from your Coinbase account or obtain USDC on Base.
                    </Callout.Text>
                  </Callout.Root>
                )
              )}
              */}

              <Flex direction={'column'} gap={'4'} align={'center'}>
              {onrampError && (
                <Callout.Root color="red">
                  <Callout.Icon>
                    <InfoCircledIcon />
                  </Callout.Icon>
                  <Flex direction={'column'} maxWidth={'100%'}>
                    <Callout.Text mb={'4'} size={'3'}>
                      {onrampError}
                    </Callout.Text>
                    {fallbackLink && (
                      <Callout.Text size={'4'}>
                        {/* Render as a link */}
                        <Link wrap={'wrap'} href={fallbackLink} target="_blank" rel="noopener noreferrer">
                          Continue to Stripe
                        </Link>
                        </Callout.Text>
                    )}
                  </Flex>
                </Callout.Root>
              )}
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button size={'4'} style={{
                      backgroundColor: '#0051FD',
                      width: '250px'
                    }}>Pay with crypto</Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="450px">
                    <AlertDialog.Title>Low funds</AlertDialog.Title>
                    {/* <AlertDialog.Description size="2">
                      Paying in crypto supports local merchants by saving them money and eliminating bank fees.
                      If you have a Coinbase account, you can sign in and transfer money to your Gogh account.
                      If you don&apos;t, we recommend using mobile pay for now, and <Link href="https://coinbase.com/" size='2' target="_blank" rel="noopener noreferrer">
                      signing up later</Link>. It takes about 5 minutes.
                    </AlertDialog.Description> */}

                    <AlertDialog.Description size="2">
                      A minimum balance of $1 is required. Please transfer funds to your address below or buy crypto.
                    </AlertDialog.Description>
                    <Flex direction={'column'} py={'5'}>
                      <TextField.Root value={walletForPurchase || ''} disabled placeholder="Enter Base USDC address from Coinbase">
                        <TextField.Slot side="right">
                          <IconButton size="1" variant="ghost" onClick={copyToClipboard}>
                            <CopyIcon height="20" width="20" />
                          </IconButton>
                        </TextField.Slot>
                      </TextField.Root>
                      {copyConfirmMessage && (
                        <Text size={'2'}>
                          {copyConfirmMessage}
                        </Text>
                      )}

                    </Flex>
                    

                    <Flex gap="3" mt="4" justify="end">
                      <AlertDialog.Cancel>
                        <Button variant="soft" color="gray">
                          Cancel
                        </Button>
                      </AlertDialog.Cancel>

                      {/* 
                      <AlertDialog.Action>
                        temporarily removing Coinbase and doing Stripe onramp
                        <Flex>
                          <CoinbaseButton
                            destinationWalletAddress={walletForPurchase || ""}
                            price={finalPrice || 0}
                            redirectURL={redirectURL}
                          />
                        </Flex>
                      </AlertDialog.Action>
                       */}

                      <AlertDialog.Action>
                        <Flex>
                        <Button onClick={createOnrampSession} style={{backgroundColor: '#0051FD', width: '200px'}}>
                          Buy crypto
                        </Button>
                        </Flex>
                      </AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
                
                {/*
                {merchant && merchant.stripeConnectedAccountId && (
                  <Button size={'4'} variant="surface" loading={isLoading} style={{
                    width: '250px'
                  }}
                  onClick={() => {
                    setError(null);
                    handleMobilePay();
                  }}>
                    Mobile pay
                </Button>
                )} 
                */}
                

                {/*<div id="cbpay-container"></div>*/}
              </Flex>
            </Flex>
            )
            
          )}

          {showPayButton && (
            isBalanceLoading ? (
              <>
                <Text>Fetching balance...</Text>
                <Spinner />
              </>
            ) : (
              <>
                
                
                <Flex direction={'column'} gap={'4'}>

                  <Dialog.Root>
                    <Dialog.Trigger>
                      <Button size={'4'} loading={isLoading} disabled={purchaseStarted} style={{
                        width: '250px',
                        backgroundColor: '#0051FD'
                        }}
                        onClick={() => {
                          setError(null);
                        }}>
                        Pay with crypto
                      </Button>
                    </Dialog.Trigger>
                    <Dialog.Content width={'90vw'}>
                      <Flex direction={'column'} width={'100%'}>
                      <Dialog.Title align={'center'}>Confirm purchase</Dialog.Title>
                      <VisuallyHidden asChild>
                        <Dialog.Description size="2" mb="4">
                          Confirm transaction details
                        </Dialog.Description>
                      </VisuallyHidden>
                      <Separator size={'4'} mb={'5'}/>
                      <Text align={'center'} size={'8'} weight={'bold'}>${finalPrice.toFixed(2)}</Text>
                      <Flex direction={'column'} my={'3'} p={'3'} style={{border: '1px solid #e0e0e0', borderRadius: '5px'}}>
                        <Flex direction={'row'} justify={'between'}>
                          <Text size={'4'} weight={'bold'}>From:</Text>
                          <Flex direction={'column'} gap={'2'} maxWidth={'70%'}>
                            <Flex direction={'row'} gap={'2'} align={'center'}>
                              <FontAwesomeIcon icon={faWallet} />
                              {embeddedWallet ? (
                                <Text>Wallet</Text>
                              ) : (
                                <Text>Your Gogh account</Text>
                              )}
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
                              <Text>{merchant?.name}</Text>
                            </Flex>
                            <Text size={'2'} align={'right'} wrap={'wrap'}>{merchantWalletAddress?.slice(0, 6)}...{merchantWalletAddress?.slice(-4)}</Text>
                          </Flex>
                        </Flex>
                      </Flex>
                      <Callout.Root color="orange">
                        <Callout.Icon>
                          <InfoCircledIcon />
                        </Callout.Icon>
                        <Callout.Text>
                          Crypto transactions are not eligible for refunds.
                        </Callout.Text>
                      </Callout.Root>
                      <Flex direction={'column'} align={'center'} gap={'7'} mt={'5'}>
                        <Dialog.Close>
                          <Button size={'4'} loading={isLoading} style={{width: '200px'}} 
                            onClick={() => {
                            if (finalPrice !== null && walletForPurchase) {
                              sendUSDC(merchantWalletAddress as `0x${string}`, finalPrice);
                              setError(null);
                            } else {
                              console.error("Invalid price or wallet address.");
                              setError("Invalid price or wallet address. Unable to process the transaction.");
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

                {/*
                {merchant && merchant.stripeConnectedAccountId && (
                  <Button size={'4'} variant="surface" loading={isLoading} style={{
                    width: '250px'
                  }}
                  onClick={() => {
                    setError(null);
                    handleMobilePay();
                  }}>
                    Mobile pay
                </Button>
                )}
                */}
                
              </Flex>
            </>
            )
          )}
          </>
        ) : (
          <>
           <Flex direction={'column'} gap={'4'} align={'center'} justify={'center'}>
            <Button size={'4'} disabled={disableLogin}
              style={{
                width: 'max-content',
                backgroundColor: '#0051FD'
              }}
              onClick={login}>
              Log in to pay with crypto
            </Button>

            {/*
            <Button size={'4'} variant="surface" loading={isLoading} style={{
              width: '250px'
              }}
              onClick={() => {
                setError(null);
                handleMobilePay();
              }}>
              Mobile pay
            </Button>
            */}

            </Flex>
          </>
        )}
      </Flex>
    </Box>
  </Flex>
  );
}

export default function Buy() {
  return (
    <Suspense fallback={<Spinner />}>
      <BuyContent />
    </Suspense>
  );
}