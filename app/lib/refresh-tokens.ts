'use server'

import Merchant from '@/app/models/Merchant';
import axios from 'axios';
import connectToDatabase from '../utils/mongodb';
import AdminError from '../models/AdminError';
import { encrypt, decrypt } from './encrypt-decrypt';

const SQUARE_OBTAIN_TOKEN_URL = `https://connect.${process.env.NEXT_PUBLIC_SQUARE_ENV}.com/oauth2/token`;
const SQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;

const DAYS_TO_REFRESH = [22, 14, 7]; // Days before expiration to attempt token refresh

export const checkAndRefreshToken = async (merchantId: string): Promise<boolean> => {
  try {
    await connectToDatabase();
    const merchant = await Merchant.findById(merchantId);

    if (!merchant) {
      console.error('Merchant not found');
      return false;
    }

    if (!merchant.square) {
      console.log('Square details missing for merchant');
      return false;
    }

    const { refresh_token, token_expires_at, merchant_id } = merchant.square;

    if (!refresh_token || !token_expires_at) {
      console.log('Missing refresh token or token expiration date');
      return false;
    }

    const today = new Date();
    const tokenExpiresAt = new Date(token_expires_at);
    const daysUntilExpiration = Math.floor((tokenExpiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check if daysUntilExpiration is less than or equal to any value in DAYS_TO_REFRESH
    const shouldRefresh = DAYS_TO_REFRESH.some(days => daysUntilExpiration <= days);
    console.log(`Should refresh token: ${shouldRefresh}`);

    if (shouldRefresh && daysUntilExpiration > 0) {
      console.log('Attempting to refresh token...');

      try {
        const response = await axios.post(SQUARE_OBTAIN_TOKEN_URL, {
          client_id: SQUARE_CLIENT_ID,
          client_secret: SQUARE_APP_SECRET,
          grant_type: 'refresh_token',
          refresh_token: decrypt(refresh_token),
        }, {
          headers: {
            'Square-Version': '2022-04-20',
            'Content-Type': 'application/json',
          },
        });

        const data = response.data;

        merchant.square.access_token = encrypt(data.access_token);
        merchant.square.token_expires_at = new Date(data.expires_at);
        merchant.square.merchant_id = data.merchant_id;
        merchant.square.refresh_token = encrypt(data.refresh_token);
        await merchant.save();

        return true;

      } catch (error) {
        logAdminError(merchant_id, 'Check refresh token', error);
        return false;
      }
    } else {
      console.log('No need to refresh token at this time.');
      return true;
    }
  } catch (error) {
    logAdminError(merchantId, 'Initial check and connection', error);
    return false;
  }
};

const logAdminError = async (merchantId: string, attemptedTask: string, error: unknown) => {
  try {
    if (error instanceof Error) {
      console.error(`Failed during ${attemptedTask} for merchant ${merchantId}: ${error.message}`);
      await AdminError.create({
        merchantId,
        attemptedTask,
        errorMessage: error.message,
        timestamp: new Date(),
      });
    } else {
      console.error(`Failed during ${attemptedTask} for merchant ${merchantId}: ${String(error)}`);
      await AdminError.create({
        merchantId,
        attemptedTask,
        errorMessage: String(error),
        timestamp: new Date(),
      });
    }
  } catch (logError) {
    console.error(`Failed to log admin error for merchant ${merchantId}: ${logError instanceof Error ? logError.message : String(logError)}`);
  }
};