
import { createHmac } from 'crypto';

const secretKey = process.env.SECURE_URL_KEY!;

if (!secretKey) {
  throw new Error('Missing SECURE_URL_KEY environment variable');
}

function verifySignature(params: Record<string, string | undefined>, signature: string): boolean {
  const relevantParams = ['merchantId', 'product', 'price', 'salesTax', 'walletAddress'];
  const filteredEntries = Object.entries(params).filter(([key, value]) => relevantParams.includes(key) && value !== undefined) as [string, string][];
  const sortedFilteredEntries = filteredEntries.sort((a, b) => a[0].localeCompare(b[0]));
  const sortedQueryString = new URLSearchParams(sortedFilteredEntries).toString();
  console.log('second sorted query string:', sortedQueryString);

  const computedSignature = createHmac('sha256', secretKey).update(sortedQueryString).digest('hex');
  console.log('computed sig:', computedSignature);

  return signature === computedSignature;
}

export async function POST(req: Request) {
  const { params, signature } = await req.json();

  if (!params || !signature) {
    return Response.json({ isValid: false }, { status: 400 });
  }

  const isValid = verifySignature(params, signature);
  return Response.json({ isValid });
}