// Replace `vi` with `jest` and remove unnecessary imports
import { parseTransactionDetailsFromQuery } from '../route';
import * as Sentry from '@sentry/nextjs';
import { cookies } from 'next/headers';
import { PaymentType, SaleFormData, DiscountType, MilestoneType } from '@/app/types/types';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

const fixedDate = '2024-10-10T02:01:52.920Z';

const saleFormDataMock: SaleFormData = {
  product: 'Test Product',
  price: '100.00',
  tax: 10,
  merchant: 'Test Merchant',
  customer: {
    totalSpent: 500,
    purchaseCount: 5,
    lastVisit: new Date(fixedDate),
    currentDiscount: {
      type: "percentage",
      amount: 10,
    },
    userInfo: {
      _id: 'customer-id',
      name: 'John Doe',
      email: 'john@example.com',
      squareCustomerId: 'sq-customer-id',
      privyId: 'privy-id',
    },
  },
  sellerMerchant: {
    _id: 'merchant-id',
    name: 'Test Merchant',
    privyId: 'privy-id',
    taxes: [],
    paymentMethods: {
      venmoQrCodeImage: "https://example.com/venmo-qr-code",
      zelleQrCodeImage: "https://example.com/zelle-qr-code",
    },
    rewards: {
      discount_type: DiscountType.Percent,
      milestone_type: MilestoneType.DollarsSpent,
      welcome_reward: 10,
      tiers: [
        {
          name: 'Tier 1',
          discount: 10,
          milestone: 100,
        },
        {
          name: 'Tier 2',
          discount: 20,
          milestone: 200,
        },
      ],
    },
  },
  paymentMethod: PaymentType.Venmo,
};

describe('parseTransactionDetailsFromQuery', () => {

  it('should return null and log error if no data parameter is found', () => {
    const searchParams = new URLSearchParams();
    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toBeNull();
    expect(Sentry.captureMessage).toHaveBeenCalledWith('No data parameter found in Square iOS response.');
  });

  it('should return parsed transaction details if data parameter is valid', () => {
    const data = JSON.stringify({
      transaction_id: '123',
      client_transaction_id: '456',
      status: 'success',
      state: JSON.stringify({ cookieName: 'testCookie', goghTransactionId: '789' }),
    });
    const searchParams = new URLSearchParams({ data: encodeURI(data) });

    const mockCookieStore = {
      get: jest.fn().mockReturnValue({ value: JSON.stringify(saleFormDataMock) }),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      transactionId: '123',
      clientTransactionId: '456',
      error: undefined,
      saleFormData: {
        product: 'Test Product',
        price: '100.00',
        tax: 10,
        merchant: 'Test Merchant',
        customer: {
          totalSpent: 500,
          purchaseCount: 5,
          lastVisit: fixedDate,
          currentDiscount: {
            type: "percentage",
            amount: 10,
          },
          userInfo: {
            _id: 'customer-id',
            name: 'John Doe',
            email: 'john@example.com',
            squareCustomerId: 'sq-customer-id',
            privyId: 'privy-id',
          },
        },
        sellerMerchant: {
          _id: 'merchant-id',
          name: 'Test Merchant',
          privyId: 'privy-id',
          taxes: [],
          paymentMethods: {
            venmoQrCodeImage: "https://example.com/venmo-qr-code",
            zelleQrCodeImage: "https://example.com/zelle-qr-code",
          },
          rewards: {
            discount_type: DiscountType.Percent,
            milestone_type: MilestoneType.DollarsSpent,
            welcome_reward: 10,
            tiers: [
              {
                name: 'Tier 1',
                discount: 10,
                milestone: 100,
              },
              {
                name: 'Tier 2',
                discount: 20,
                milestone: 200,
              },
            ],
          },
        },
        paymentMethod: PaymentType.Venmo,
      },
      goghTransactionId: '789',
    });
  });


  it('should handle errors during parsing and log them', () => {
    const searchParams = new URLSearchParams({ data: '%E0%A4%A' }); // Invalid URI component

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('should log error if cookie name is not included in state', () => {
    const data = JSON.stringify({
      transaction_id: '123',
      client_transaction_id: '456',
      status: 'success',
      state: JSON.stringify({ goghTransactionId: '789' }),
    });
    const searchParams = new URLSearchParams({ data: encodeURI(data) });

    parseTransactionDetailsFromQuery(searchParams);

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Cookie name was not included in iOS callback data");
  });

  it('should log error if sale data cookie is not retrieved from storage', () => {
    const data = JSON.stringify({
      transaction_id: '123',
      client_transaction_id: '456',
      status: 'success',
      state: JSON.stringify({ cookieName: 'testCookie', goghTransactionId: '789' }),
    });
    const searchParams = new URLSearchParams({ data: encodeURI(data) });

    const mockCookieStore = {
      get: jest.fn().mockReturnValue(null),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    parseTransactionDetailsFromQuery(searchParams);

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Sale data cookie was not retrieved from storage.");
  });
});