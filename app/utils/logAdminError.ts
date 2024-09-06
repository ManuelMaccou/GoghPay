'use server'

import AdminError from "../models/AdminError";

/**
 * Logs an admin error to the database.
 * @param merchantId - The merchant ID.
 * @param attemptedTask - The task that was attempted when the error occurred.
 * @param error - The error object or message (should be a plain object).
 */
export const logAdminError = async (
  merchantId: string | undefined,
  attemptedTask: string,
  error: { message: string; status?: number; stack?: string; responseBody?: any }
) => {
  try {
    const { message, stack } = error;
    
    console.error(`Failed during ${attemptedTask} for merchant ${merchantId}: ${message}`);

    // Store the error in the database
    await AdminError.create({
      merchantId,
      attemptedTask,
      errorMessage: message,
      errorStack: stack,
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error(`Failed to log admin error for merchant ${merchantId}: ${logError instanceof Error ? logError.message : String(logError)}`);
  }
};

