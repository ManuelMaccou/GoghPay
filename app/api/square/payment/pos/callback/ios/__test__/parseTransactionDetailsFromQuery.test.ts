// app/api/square/payment/pos/callback/ios/__test__/parseTransactionDetailsFromQuery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseTransactionDetailsFromQuery } from '../route';

// Mocking next/headers to mock cookie behavior
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(() => ({ value: JSON.stringify({ test: 'cookieData' }) }))
  }),
}));

describe('parseTransactionDetailsFromQuery', () => {
  it('should return null if no data parameter is found', () => {
    const searchParams = new URLSearchParams();  // No "data" parameter
    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toBeNull();
  });

  it('should parse transaction details correctly with valid data', () => {
    const data = {
      transaction_id: '12345',
      client_transaction_id: '67890',
      state: JSON.stringify({
        cookieName: 'test_cookie',
        goghTransactionId: 'gogh123',
      }),
    };

    const searchParams = new URLSearchParams({
      data: JSON.stringify(data),
    });

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      transactionId: '12345',
      clientTransactionId: '67890',
      error: undefined,
      saleFormData: { test: 'cookieData' },  // Mocked cookie data
      goghTransactionId: 'gogh123',
    });
  });

  it('should handle missing state gracefully', () => {
    const data = {
      transaction_id: '12345',
      client_transaction_id: '67890',
      // Missing state
    };

    const searchParams = new URLSearchParams({
      data: JSON.stringify(data),
    });

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      transactionId: '12345',
      clientTransactionId: '67890',
      error: undefined,
      saleFormData: null,  // No state, so no cookie data
      goghTransactionId: '',  // Empty because state is missing
    });
  });
});
