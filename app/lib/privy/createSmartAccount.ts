import { usePrivy, useWallets } from '@privy-io/react-auth';
import {Chain, createWalletClient, custom} from 'viem';
import {createSmartAccountClient, ENTRYPOINT_ADDRESS_V06, walletClientToSmartAccountSigner} from 'permissionless';
import {signerToSimpleSmartAccount} from 'permissionless/accounts';
import {createPimlicoPaymasterClient} from 'permissionless/clients/pimlico';
import {createPublicClient, http} from 'viem';


async function setupSmartAccount() {
    try {
        // Find the embedded wallet and get its EIP1193 provider
        const {wallets} = useWallets();
        const embeddedWallet = wallets.find((wallet) => (wallet.walletClientType === 'privy'));
        const eip1193provider = await embeddedWallet.getEthereumProvider();

        // Create a viem WalletClient from the embedded wallet's EIP1193 provider
        // This will be used as the signer for the user's smart account
        const privyClient = createWalletClient({
            account: embeddedWallet.address,
            chain: process.env.NEXT_PUBLIC_PAYMASTER_CHAIN as unknown as Chain,
            transport: custom(eip1193provider)
        });


        // Create a viem public client for RPC calls
        const publicClient = createPublicClient({
            chain: process.env.NEXT_PUBLIC_PAYMASTER_CHAIN as unknown as Chain,
            transport: http(),
        });

        // Initialize the smart account for the user
        const customSigner = walletClientToSmartAccountSigner(privyClient);
        const simpleSmartAccount = await signerToSimpleSmartAccount(publicClient, {
            entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
            signer: customSigner,
            factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454',
        });

        // Create the Paymaster for gas sponsorship 
        const rpcUrl = process.env.PAYMASTER_COINBASE_RPC
        const cloudPaymaster = createPimlicoPaymasterClient({
            chain: process.env.NEXT_PUBLIC_PAYMASTER_CHAIN as unknown as Chain,
            transport: http(rpcUrl),
            entryPoint: ENTRYPOINT_ADDRESS_V06,
        });


        // Create the SmartAccountClient for requesting signatures and transactions (RPCs)
        const smartAccountClient = createSmartAccountClient({
            account: simpleSmartAccount,
            chain: process.env.NEXT_PUBLIC_PAYMASTER_CHAIN as unknown as Chain,
            bundlerTransport: http(rpcUrl),
            middleware: {
                sponsorUserOperation: cloudPaymaster.sponsorUserOperation,
            },
        });

        return simpleSmartAccount;
    } catch (error) {
      console.error("Failed to setup smart account:", error);
      // Handle or propagate the error appropriately
    }
  }
