import { Client, Environment } from 'square';

// Function to create and configure the Square client
export function createSquareClient(accessToken: string): Client {
  if (!accessToken) {
    throw new Error('Access token is required to create a Square client');
  }

  return new Client({
    bearerAuthCredentials: {
      accessToken: accessToken
    },
    environment: process.env.SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
    httpClientOptions: {
      timeout: 5000, // 5 seconds timeout for requests
      retryConfig: {
        maxNumberOfRetries: 3,  // Retry up to 3 times
        maximumRetryWaitTime: 20000, // Maximum retry wait time of 20 seconds
      },
    },
  });
}
