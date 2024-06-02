import { usePrivy } from '@privy-io/react-auth';
import type { UnsignedTransactionRequest, SendTransactionModalUIOptions } from '@privy-io/react-auth';
import { useState } from 'react';
import { encodeFunctionData, erc20Abi } from 'viem';
import { Button } from "@radix-ui/themes";

type SendUsdcButtonProps = {
  activeWalletAddress: `0x${string}`;
  merchantWalletAddress: `0x${string}`;
  price: number;
};

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export function SendUsdcButton({ activeWalletAddress, merchantWalletAddress, price }: SendUsdcButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const { sendTransaction } = usePrivy();

  if (!activeWalletAddress) {
    console.error('Error: Users wallet address is missing.');
    setError('There was an error. Please log in again.');
    return null;
  }

  console.log('active wallet address while paying:', activeWalletAddress);
  const amountInUSDC = BigInt(price * 1_000_000);
  console.log('amountInUSDC:', amountInUSDC);

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [merchantWalletAddress, amountInUSDC],
  });

  const requestData: UnsignedTransactionRequest = {
    from: activeWalletAddress,
    to: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS!,
    data: data,
    value: '0x0',
  };

  const uiConfig: SendTransactionModalUIOptions = {
    header: 'Transaction Confirmation',
    description: 'Please confirm the USDC transfer.',
    buttonText: 'Confirm',
  };

  const handleClick = async () => {
    try {
      const txReceipt = await sendTransaction(requestData, uiConfig);
      console.log('Transaction receipt:', txReceipt);
    } catch (error) {
      if (isError(error)) {
        console.error('Error sending USDC:', error.message);
        setError(`Transaction failed: ${error.message}`);
      } else {
        console.error('An unexpected error occurred:', error);
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <Button onClick={handleClick}>
        Purchase
      </Button>
    </div>
  );
}
