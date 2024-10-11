import React from 'react';
import { usePrivy, useLogin, useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';
import { Button, Flex } from "@radix-ui/themes";
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { ENTRYPOINT_ADDRESS_V07, walletClientToSmartAccountSigner } from 'permissionless';
import { signerToSafeSmartAccount } from 'permissionless/accounts';


function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

type ButtonVariant = "solid" | "outline" | "ghost" | "classic" | "soft" | "surface";
type ButtonSize = '1' | '2' | '3' | '4'; 
type ButtonJustify = "end" | "center" | "start" | "between";

interface LoginProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: string;
  justify?: ButtonJustify;
}
const Login: React.FC<LoginProps> = ({ variant = 'outline', size = '3', width = 'fit-content', justify = 'end' }) => {
  const {wallets} = useWallets();
  const wallet = wallets[0];
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
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

  const { authenticated, logout } = usePrivy();
  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {
      if (isNewUser) {
        console.log("is new user")
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
            phone: user.phone?.number,
            creationType: 'privy',
            smartAccountAddress: smartAccountAddress,
          };

          console.log('creating new user');
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
  return (
    <>
      {authenticated ? (
        <Button style={{width: '250px'}} onClick={logout}>
          Log out
        </Button>
      ) : (
        <Flex direction={'row'} justify={justify} width={'100%'} mx={'4'}>
           <Button size={size} variant={variant} style={{width: width}} onClick={login}>
            Log in
          </Button>
        </Flex>
      )}
    </>
  );
};

export default Login;