import crypto from 'crypto';

export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};