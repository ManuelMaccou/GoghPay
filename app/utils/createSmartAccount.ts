"use client"

import { ConnectedWallet, getEmbeddedConnectedWallet, useWallets } from "@privy-io/react-auth";
import { ENTRYPOINT_ADDRESS_V07, walletClientToSmartAccountSigner } from "permissionless";
import { signerToSafeSmartAccount } from "permissionless/accounts";
import { Chain, createPublicClient, createWalletClient, custom, encodeFunctionData, http, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";

const chainMapping: { [key: string]: Chain } = {
  'baseSepolia': baseSepolia,
  'base': base,
};

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

export async function createSmartAccount(embeddedWallet: ConnectedWallet) {
  console.log("embedded wallet object within function:", embeddedWallet);
  if (!embeddedWallet) {
    console.error("No embedded wallet found.");
    return;
  }

  const eip1193provider = await embeddedWallet.getEthereumProvider();
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
  
  const smartAccountAddress = account.address;

  return smartAccountAddress;
}