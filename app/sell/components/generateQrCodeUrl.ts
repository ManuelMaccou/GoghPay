'use server'

import Merchant from '../../models/Merchant';
import connectToDatabase from '../../utils/mongodb';
import { z } from "zod";
import { createHmac } from 'crypto';
import { User } from '../../types/user';

interface Params {
  merchantId: string;
  product: string;
  price: string;
  walletAddress: string;
}

async function generateSignedURL(baseURL: string | URL, params: Params, secretKey: string) {
  const url = new URL(baseURL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const sortedParams = new URLSearchParams(Array.from(url.searchParams.entries()).sort());
  const sortedQueryString = sortedParams.toString();

  const signature = createHmac('sha256', secretKey)
                          .update(sortedQueryString)
                          .digest('hex');

  sortedParams.append('signature', signature);
  return `${url.origin}${url.pathname}?${sortedParams.toString()}`;
}

export async function generateQrCode(
  prevState: {
    message: string;
  },
  userId: string,
  formData: FormData
): Promise<{ message: string; error?: unknown; signedURL?: string }> {

  await connectToDatabase();

  const merchant = await Merchant.findOne({ privyId: userId });

  if (!merchant) {
    throw new Error('You are not authorized to generate QR Codes');
  }

  if (!merchant.walletAddress) {
    throw new Error('Required merchant wallet is missing from their account.');
  }

  const schema = z.object({
    product: z.string().min(1),
    price: z.string().min(1),
  });
  const parse = schema.safeParse({
    product: formData.get("product"),
    price: formData.get("price"),
  });

  if (!parse.success) {
    return { message: "Failed to create QR Code." };
  }

  const data = parse.data;

  const params = {
    walletAddress: merchant.walletAddress,
    product: data.product,
    price: data.price,
    merchantId: merchant._id,
  };

  const secretKey = process.env.NEXT_PUBLIC_SECURE_URL_KEY!;
  const baseURL = `${process.env.NEXT_PUBLIC_BASE_URL}/buy`;
  
  try {
    const signedURL = await generateSignedURL(baseURL, params, secretKey);
    console.log('Signed URL during QR Code creation:', signedURL);

    return { message: "QR Code generated successfully", signedURL };
  } catch (error) {
    console.error("Failed to generate signed URL:", error);
    return { message: "Failed to generate signed URL", error };
  }
}