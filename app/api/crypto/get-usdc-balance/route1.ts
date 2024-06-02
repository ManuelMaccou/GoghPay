import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { erc20Abi } from 'viem';
import { Alchemy, Network } from "alchemy-sdk";

const ALCHEMY_API_KEY = 'lh1UwjJi13tTLQRQym_eVEUxSlm0e5Ai';
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    console.log('address:', address)
    if (!address) {
      console.log("address not found")
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }
    if (!ethers.isAddress(address)) {
      console.log("Invalid Ethereum address")
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    // Connect to the Ethereum network via Alchemy
    const provider = new ethers.AlchemyProvider('homestead', ALCHEMY_API_KEY);

    // Create a contract instance
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);

    // Get the balance
    const balance = await usdcContract.balanceOf("0x4A6737Da9668D09aCE702c3ff5e0dA33a84d28F7");
    if (!balance) {
      console.log("No balance returned")
      return NextResponse.json({ error: 'No balance data returned from contract' }, { status: 400 });
    }
    console.log('Raw balance data:', balance);

    // USDC has 6 decimals, so convert the balance accordingly
    const balanceInUSDC = ethers.formatUnits(balance, 6);
    console.log('blanceInUSDC:', balanceInUSDC);

    return NextResponse.json({ balance: balanceInUSDC });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while fetching the balance' }, { status: 500 });
  }
}
