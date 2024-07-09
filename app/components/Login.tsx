import React from 'react';
import { usePrivy, useLogin, useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';
import { Button, Flex } from "@radix-ui/themes";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { ENTRYPOINT_ADDRESS_V07, walletClientToSmartAccountSigner } from 'permissionless';
import { signerToSafeSmartAccount } from 'permissionless/accounts';


function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function Login() {
  const {wallets} = useWallets();
  const wallet = wallets[0];
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  
  const chainId = wallet?.chainId;
  const chainIdNum = process.env.NEXT_PUBLIC_DEFAULT_CHAINID ? Number(process.env.NEXT_PUBLIC_DEFAULT_CHAINID) : null;

  const { getAccessToken, authenticated, logout, ready } = usePrivy();
  const { login } = useLogin({
    onComplete: async (user, isNewUser) => {

      if (isNewUser) {
        let smartAccountAddress;
        
        if (embeddedWallet) {
          const eip1193provider = await wallet.getEthereumProvider();
          const erc20PaymasterAddress = process.env.NEXT_PUBLIC_ERC20_PAYMASTER_ADDRESS as `0x${string}`;

          const privyClient = createWalletClient({
            account: embeddedWallet.address as `0x${string}`,
            chain: baseSepolia,
            transport: custom(eip1193provider)
          });

          const customSigner = walletClientToSmartAccountSigner(privyClient);

          const publicClient = createPublicClient({
            chain: baseSepolia,
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
  return (
    <>
      {authenticated ? (
        <Button style={{width: '250px'}} onClick={logout}>
          Log out
        </Button>
      ) : (
        <Flex direction={'row'} justify={'end'} width={'100%'} mx={'4'}>
          <Button size={'3'} variant='outline' onClick={login}>
            Log in
          </Button>
        </Flex>
      )}
    </>
  );
};
