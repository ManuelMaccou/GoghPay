"use server";

import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { SaleFormData } from '../types/types';

export async function setSaleDataCookie(saleFormData: SaleFormData) {
  try {
    const cookieStore = cookies();
    const uniqueId = uuidv4();

    // Extract only essential data to minimize cookie size
    const reducedSaleFormData = {
      customer: {
        userInfo: {
          _id: saleFormData.customer?.userInfo?._id,  // Customer ID for rewards
        },
        currentDiscount: saleFormData.customer?.currentDiscount,  // Discount info if any
      },
      sellerMerchant: {
        _id: saleFormData.sellerMerchant?._id,  // Seller's Merchant ID
        rewards: {
          welcome_reward: saleFormData.sellerMerchant?.rewards?.welcome_reward,  // Welcome reward, if any
        },
      },
      price: saleFormData.price,  // Original price of the transaction
    };

    // Serialize the minimal data for the cookie
    const saleFormDataJson = JSON.stringify(reducedSaleFormData);

    // Set the cookie with minimal data
    cookieStore.set({
      name: uniqueId,
      value: saleFormDataJson,
      httpOnly: true,
      secure: process.env.SECURE_ENV === 'true',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { success: true, cookieName: uniqueId };
  } catch (error) {
    console.error("Failed to set cookie:", error);
    return { success: false };
  }
}
