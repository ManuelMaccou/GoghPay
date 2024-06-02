import { NextRequest, NextResponse } from 'next/server';
import { Alchemy, Network } from "alchemy-sdk";

export async function GET(request: NextRequest) {
    const config = {
        apiKey: "lWkmBhjsnPCqgHDbSF1jb34Yq7QVVzxl",
        network: Network.ETH_MAINNET,
    };
    const alchemy = new Alchemy(config);

    const ownerAddress = "0x4A6737Da9668D09aCE702c3ff5e0dA33a84d28F7";
    const tokenContractAddresses = ["0xdAC17F958D2ee523a2206206994597C13D831ec7"];

    try {
        const balancesData = await alchemy.core.getTokenBalances(ownerAddress, tokenContractAddresses);
        if (!balancesData || !balancesData.tokenBalances || balancesData.tokenBalances.length === 0) {
            console.error('No balances data returned from the API');
            return NextResponse.json({ error: 'No balances data available' }, { status: 404 });
        }

        const metadata = await alchemy.core.getTokenMetadata(tokenContractAddresses[0]);
        if (!metadata || metadata.decimals === null) {
            console.error('No metadata returned from the API');
            return NextResponse.json({ error: 'Token metadata is incomplete' }, { status: 404 });
        }

        const tokenName = `${metadata.name} (${metadata.symbol})`;
        const balance = balancesData.tokenBalances[0].tokenBalance;
        const tokenBalance = balance ? Number(balance) / Math.pow(10, metadata.decimals) : 0;

        console.log("Token balance for", tokenName, "is", tokenBalance);
        return NextResponse.json({ tokenName, tokenBalance });
    } catch (error) {
        console.error('Failed to fetch token data:', error);
        return NextResponse.json({ error: 'Failed to fetch balance due to an error' }, { status: 500 });
    }
}
