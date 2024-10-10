import { describe, it, expect, vi } from 'vitest';
import { parseTransactionDetailsFromQuery } from '../route';
import * as Sentry from '@sentry/nextjs';
import { cookies } from 'next/headers';
import { PaymentType, SaleFormData, DiscountType, MilestoneType } from '@/app/types/types';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
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

  it('should log error if no metadata parameter is found', () => {
    const searchParams = new URLSearchParams();
    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      clientTransactionId: null,
      transactionId: null,
      error: null,
      saleFormData: null,
      goghTransactionId: "",
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('No metadata found in query parameters');
  });

  it('should return parsed transaction details if metadata parameter is valid', () => {
    const metadata = {
      cookieName: 'testCookie',
      goghTransactionId: '789',
    };
    const searchParams = new URLSearchParams({
      'com.squareup.pos.CLIENT_TRANSACTION_ID': '456',
      'com.squareup.pos.SERVER_TRANSACTION_ID': '123',
      'com.squareup.pos.REQUEST_METADATA': encodeURIComponent(JSON.stringify(metadata)),
    });

    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: JSON.stringify(saleFormDataMock) }),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      clientTransactionId: '456',
      transactionId: '123',
      error: null,
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

  it('should handle errors during metadata parsing and log them', () => {
    const searchParams = new URLSearchParams({
      'com.squareup.pos.REQUEST_METADATA': '%E0%A4%A', // Invalid URI component
    });

    const result = parseTransactionDetailsFromQuery(searchParams);

    expect(result).toEqual({
      clientTransactionId: null,
      transactionId: null,
      error: null,
      saleFormData: null,
      goghTransactionId: "",
    });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('should log error if cookie name is not included in metadata', () => {
    const metadata = {
      goghTransactionId: '789',
    };
    const searchParams = new URLSearchParams({
      'com.squareup.pos.CLIENT_TRANSACTION_ID': '456',
      'com.squareup.pos.SERVER_TRANSACTION_ID': '123',
      'com.squareup.pos.REQUEST_METADATA': encodeURIComponent(JSON.stringify(metadata)),
    });

    parseTransactionDetailsFromQuery(searchParams);

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Cookie name was not included in iOS callback data");
  });

  it('should log error if sale data cookie is not retrieved from storage', () => {
    const metadata = {
      cookieName: 'testCookie',
      goghTransactionId: '789',
    };
    const searchParams = new URLSearchParams({
      'com.squareup.pos.CLIENT_TRANSACTION_ID': '456',
      'com.squareup.pos.SERVER_TRANSACTION_ID': '123',
      'com.squareup.pos.REQUEST_METADATA': encodeURIComponent(JSON.stringify(metadata)),
    });

    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    parseTransactionDetailsFromQuery(searchParams);

    expect(Sentry.captureMessage).toHaveBeenCalledWith("Sale data cookie was not retrieved from storage.");
  });
});