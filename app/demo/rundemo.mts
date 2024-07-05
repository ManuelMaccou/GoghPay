// Smart account address: https://sepolia.etherscan.io/address/0xd3eD0f6FC1aB90550dFF210F6D0Be6B1906986BC

import "dotenv/config"
import { writeFileSync } from 'fs'
import {
    ENTRYPOINT_ADDRESS_V07, 
    GetUserOperationReceiptReturnType, 
    UserOperation,
    bundlerActions, 
    createSmartAccountClient, 
    getAccountNonce, 
    getSenderAddress, 
    getUserOperationHash, 
    signUserOperationHashWithECDSA, 
    waitForUserOperationReceipt,
		walletClientToSmartAccountSigner
} from "permissionless"
import { 
    privateKeyToSafeSmartAccount, 
    privateKeyToSimpleSmartAccount, 
    signerToSafeSmartAccount 
} from "permissionless/accounts"
import { pimlicoBundlerActions, pimlicoPaymasterActions } from "permissionless/actions/pimlico"
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico"
import { 
    Address, 
    Hash, 
    Hex, 
    concat, 
    createClient, 
    createPublicClient, 
    encodeFunctionData, 
    http, 
    parseAbiItem,
		custom,
		createWalletClient
} from "viem"
import { generatePrivateKey, privateKeyToAccount, signMessage } from "viem/accounts"
import { lineaTestnet, polygonMumbai, sepolia } from "viem/chains"
import { useLogin, usePrivy } from '@privy-io/react-auth';
import { base, baseSepolia } from "viem/chains";
import pkg from '@privy-io/react-auth';
const { useWallets } = pkg;

console.log("Hello world!")

const erc20PaymasterAddress = "0x000000000041F3aFe8892B48D88b6862efe0ec8d"
const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
 
/*
const privateKey =
	(process.env.PRIVATE_KEY as Hex) ??
	(() => {
		const pk = generatePrivateKey()
		writeFileSync(".env", `PRIVATE_KEY=${pk}`)
		return pk
	})()
*/
const { wallets } = useWallets();
const wallet = wallets[0]
const activeWalletAddress = wallet?.address

const eip1193provider = await wallet.getEthereumProvider();

const privyClient = createWalletClient({
	account: activeWalletAddress as `0x${string}`,
	// chain: baseSepolia,
	chain: base,
	transport: custom(eip1193provider)
});

const customSigner = walletClientToSmartAccountSigner(privyClient);

const publicClient = createPublicClient({
	transport: http("https://rpc.ankr.com/eth_sepolia"),
})
 
const apiKey = "a6a37a31-d952-430e-a509-8854d58ebcc7"
const bundlerUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`
 
const bundlerClient = createPimlicoBundlerClient({
	transport: http(bundlerUrl),
	entryPoint: ENTRYPOINT_ADDRESS_V07,
}).extend(pimlicoPaymasterActions(ENTRYPOINT_ADDRESS_V07))

const account = await signerToSafeSmartAccount(publicClient, {
	// signer: privateKeyToAccount(privateKey),
	signer: customSigner,
	entryPoint: ENTRYPOINT_ADDRESS_V07, // global entrypoint
	safeVersion: "1.4.1",
	setupTransactions: [
		{
			to: usdcAddress,
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
 
console.log(`Smart account address: https://sepolia.etherscan.io/address/${account.address}`)

const senderUsdcBalance = await publicClient.readContract({
	abi: [parseAbiItem("function balanceOf(address account) returns (uint256)")],
	address: usdcAddress,
	functionName: "balanceOf",
	args: [account.address],
})
 
if (senderUsdcBalance < 1_000_000n) {
	throw new Error(
		`insufficient USDC balance for counterfactual wallet address ${account.address}: ${
			Number(senderUsdcBalance) / 1000000
		} USDC, required at least 1 USDC. Load up balance at https://faucet.circle.com/`,
	)
}
 
console.log(`Smart account USDC balance: ${Number(senderUsdcBalance) / 1000000} USDC`)