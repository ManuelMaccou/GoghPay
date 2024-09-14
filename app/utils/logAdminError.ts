'use server';

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
  error: any // Accept any type of error to ensure flexibility
) => {
  try {
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);

    console.error(`Failed during ${attemptedTask} for merchant ${merchantId}:`, errorMessage);

    // Store the error in the database (async operation)
    await AdminError.create({
      merchantId,
      attemptedTask,
      errorMessage: errorMessage || "Unknown error", // Ensure the message is not null
      timestamp: new Date(),
    });
  } catch (logError) {
    console.error(`Failed to log admin error for merchant ${merchantId}: ${logError instanceof Error ? logError.message : String(logError)}`);
  }
};

/**
 * Serializes an error object to ensure all details are captured.
 * Although it does not perform async tasks, it must still be async due to Next.js server requirements.
 */
export const serializeError = async (error: any) => {
  if (error instanceof Error) {
    const { message, stack, name, ...otherProperties } = error;

    return {
      message,
      stack,
      name,
      ...otherProperties // Spread remaining properties
    };
  }

  // If it's not an instance of Error, return a string or JSON.
  return typeof error === 'object' ? JSON.stringify(error) : String(error);
};