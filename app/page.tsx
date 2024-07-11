"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { usePrivy, useLogin, useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth';
import axios from 'axios';
import { Button, Flex, Separator, Spinner } from "@radix-ui/themes";
import { User } from './types/types';
import styles from './components/styles.module.css';
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { walletClientToSmartAccountSigner,ENTRYPOINT_ADDRESS_V07 } from 'permissionless';
import { createPimlicoBundlerClient } from 'permissionless/clients/pimlico';
import { pimlicoPaymasterActions } from 'permissionless/actions/pimlico';
import { signerToSafeSmartAccount } from 'permissionless/accounts';
import MobileMenu from './components/MobileMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faMoneyBillTransfer, faPlus, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import Login from './components/Login';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { ready, getAccessToken, authenticated, logout, user } = usePrivy();
  const {wallets} = useWallets();
  const router = useRouter();

  const wallet = wallets[0];
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

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
  
/*
  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      console.log('login successful');

      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      console.log("wallet object:", wallet);

      if (isNewUser) {
        let smartAccountAddress;
        
        if (embeddedWallet) {
          const eip1193provider = await wallet.getEthereumProvider();
          const erc20PaymasterAddress = process.env.NEXT_PUBLIC_ERC20_PAYMASTER_ADDRESS as `0x${string}`;

          const privyClient = createWalletClient({
            account: embeddedWallet.address as `0x${string}`,
            chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
            transport: custom(eip1193provider)
          });

          const customSigner = walletClientToSmartAccountSigner(privyClient);

          const publicClient = createPublicClient({
            chain: getChainFromEnv(process.env.NEXT_PUBLIC_NETWORK),
            transport: http(),
          });
    
          const bundlerClient = createPimlicoBundlerClient({
            transport: http(
              "https://api.pimlico.io/v2/84532/rpc?apikey=a6a37a31-d952-430e-a509-8854d58ebcc7",
            ),
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
          console.log('account address:', account.address);
          
          if (account && account.address) {
            smartAccountAddress = account.address
          };
     
        };
        try {
          console.log('smart account address:', smartAccountAddress);
          const userPayload = {
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload);
          console.log('New user created:', response.data);
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
  */

  const handleNewSaleClick = () => {
    router.push('/sell');
  };

  useEffect(() => {
    if (!ready) return;
  
    const fetchUser = async () => {
      if (!user) return;
      setIsFetchingUser(true)

      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setCurrentUser(userData.user);
      } catch (error: unknown) {
        if (isError(error)) {
          console.error('Error fetching user:', error.message);
        } else {
          console.error('Unknown error:', error);
        }
        setError('Error fetching user');
      } finally {
        setIsFetchingUser(false);
        setIsLoading(false);
      }
    };

    if (ready && authenticated && user) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, [authenticated, ready, user]);

  return (
    <Flex direction={'column'} className={styles.section} position={'relative'} minHeight={'100vh'} width={'100%'}>
      <Image
        src="/bg_m.jpg"
        alt="background image"
        priority
        className={styles.fullBackgroundImage}
        fill
        sizes="100vw"
        style={{ objectFit: "cover" }} 
      />
   
      <Flex direction={'column'} justify={'center'} align={'center'}>
        <Image
          src="/logos/gogh_logo_white.svg"
          alt="Gogh"
          width={960}
          height={540}
          sizes="100vw"
          style={{
            width: "100%",
            height: "auto",
            marginBottom: "50px",
            maxWidth: "100%",
          }} 
        />

        {isLoading || (!ready && (
          <Flex direction={'column'} justify={'center'} align={'center'}>
            <Spinner />
          </Flex>
        ))}

        {!isLoading && ready && authenticated ? (
          isFetchingUser ? (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Spinner />
            </Flex>
          ) : (
            <Flex direction={'column'} justify={'between'}>
              <Flex direction={'column'} gap={'5'}>
                {currentUser?.merchant ? (
                  <>
                    <Button size={'4'} style={{width: "300px"}} onClick={handleNewSaleClick}>
                      New Sale
                    </Button>
                    <Button size={'4'} style={{width: "300px"}}
                      onClick={() => router.push(`/account/sales`)}>
                        Sales
                      </Button>
                    <Button size={'4'} style={{width: "300px"}}
                      onClick={() => router.push(`/account/purchases`)}>
                        Purchases
                    </Button>
                  </>
                ) : (
                  <Button size={'4'} style={{width: "300px"}}
                    onClick={() => router.push(`/account/purchases`)}>
                      Purchases
                  </Button>
                )}
              </Flex>
            </Flex>
          )
        ) : (
          !isLoading && (
            <Flex direction={'column'} justify={'center'} align={'center'}>
              <Login
                variant='solid'
                width='250px'
                justify='center' />
            </Flex>
          )
        )}
      </Flex>
      {ready && authenticated && !isFetchingUser && !isLoading && (
        <Flex direction={'column'} justify={'center'} align={'center'} position={'absolute'} bottom={'9'} width={'100%'}>
          <Button highContrast size={'4'} style={{width: "300px"}} onClick={logout}>
            Log out
          </Button>
        </Flex>
      )}
    </Flex>
  );
};
