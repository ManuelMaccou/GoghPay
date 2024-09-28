"use server";

import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { SaleFormData } from '../types/types';

export async function setSaleDataCookie(saleFormData: SaleFormData) {
  try {
    const cookieStore = cookies();

    const uniqueId = uuidv4();

    const saleFormDataJson = JSON.stringify(saleFormData);

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
