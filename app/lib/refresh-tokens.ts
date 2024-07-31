'use server'

import Merchant from '@/app/models/Merchant';
import axios from 'axios';
import connectToDatabase from '../utils/mongodb';
import AdminError from '../models/AdminError';
import { encrypt, decrypt } from './encrypt-decrypt';

const SQUARE_OBTAIN_TOKEN_URL = `https://connect.${process.env.NEXT_PUBLIC_SQUARE_ENV}.com/oauth2/token`;
const SQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_SQUARE_APP_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;

const DAYS_TO_REFRESH = [40, 14, 7]; // Days before expiration to attempt token refresh

export const checkAndRefreshToken = async (merchantId: string) => {
  try {
    await connectToDatabase();
    const merchant = await Merchant.findById(merchantId);

    if (!merchant) {
      console.error('Merchant not found');
      return;
    }

    console.log('Found merchant in refresh token flow:', merchant);

    const { square_refresh_token, square_token_expires_at, square_merchant_id } = merchant;

    if (!square_refresh_token || !square_token_expires_at) {
      console.log('Missing refresh token or token expiration date');
      return;
    }

    const today = new Date();
    const tokenExpiresAt = new Date(square_token_expires_at);
    const daysUntilExpiration = Math.floor((tokenExpiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Token expires at: ${tokenExpiresAt}`);
    console.log(`Days until token expiration: ${daysUntilExpiration}`);
    console.log('DAYS_TO_REFRESH:', DAYS_TO_REFRESH);

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
          refresh_token: decrypt(square_refresh_token),
        }, {
          headers: {
            'Square-Version': '2022-04-20',
            'Content-Type': 'application/json',
          },
        });

        const data = response.data;

        merchant.square_access_token = encrypt(data.access_token);
        merchant.square_token_expires_at = new Date(data.expires_at);
        await merchant.save();

        console.log('Token refreshed successfully for merchant:', square_merchant_id);

        // Remove this after testing
        await AdminError.create({
          merchantId: square_merchant_id,
          attemptedTask: 'Check refresh token',
          errorMessage: 'Token refresh successful',
          timestamp: new Date(),
        });

      } catch (error) {
        logAdminError(square_merchant_id, 'Check refresh token', error);
      }
    } else {
      console.log('No need to refresh token at this time.');
    }
  } catch (error) {
    logAdminError(merchantId, 'Initial check and connection', error);
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