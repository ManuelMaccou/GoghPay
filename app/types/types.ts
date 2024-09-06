import { Payment } from "square";

enum DiscountType {
  Dollar = 'dollar',
  Percent = 'percent',
}

enum MilestoneType {
  DollarsSpent = 'dollars_spent',
  NumberOfVisits = 'number_of_visits',
}

enum PaymentProvider {
  Venmo = 'Venmo',
  Zelle = 'Zelle',
}

export enum PaymentTypes {
  Venmo = 'Venmo',
  Zelle = 'Zelle',
  Square = 'Square',
  ManualEntry = 'ManualEntry',
  SponsoredCrypto = 'sponsored crypto',
  crypto = 'crypto',
  MobilePay = 'mobile pay',
  Cash = 'Cash',
}

enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
}

export enum PaymentType {
  None = 'None',
  Venmo = 'Venmo',
  Zelle = 'Zelle',
  Square = 'Square',
  ManualEntry = 'ManualEntry',
  Cash = 'Cash'
}

export interface User {
  _id: string;
  privyId?: string;
  squareCustomerId?: string;
  shopifyCustomerId?: string;
  walletAddress: string;
  name?: string;
  email?: string;
  merchant?: boolean;
  creationType: string;
  smartAccountAddress: string;
  coinbaseAddress: string;
}

export interface Merchant {
  _id: string;
  name: string;
  walletAddress?: string;
  storeImage?: string;
  privyId?: string;
  stripeConnectedAccountId?: string;
  promo?: boolean;
  admin: boolean;
  taxes: Tax[];
  shopify?: Shopify;
  square?: Square;
  paymentMethods: PaymentMethod;
  rewards?: Rewards;
  branding: Branding;
}

export interface Square {
  access_token?: string;
  merchant_id?: string;
  refresh_token?: string;
  token_expires_at?: string;
  location_id?: string;
  location_name?: string;
}

export interface Transaction {
  _id: string;
  merchant: Merchant;
  buyer: User;
  productName: string;
  productPrice: number;
  tipAmount: number;
  salesTax: number;
  transactionHash: string;
  paymentType: PaymentTypes;
  status?: TransactionStatus;
  createdAt: Date;
}

export interface Transfer {
  _id: string;
  user: User;
  amount: number;
  fromGoghAddress: string;
  toCoinbaseAddress: string;
  transactionHash: string;
  createdAt: Date;
}

export interface Tax {
  _id: string;
  name: string;
  rate: number;
  default: boolean;
}

export interface  CryptoElementsContextType {
  onramp: any | null;
};
export interface Location {
  id: string;
  name: string;
}

export interface SquareCatalog {
  id: string;
  name: string;
}

export interface Shopify {
  shopName: string;
  accessToken: string;
}

export interface RewardsTier {
  _id?: string;
  name: string;
  discount: number;
  milestone: number; // dollars or visits
}

export interface Rewards {
  discount_type: DiscountType;  // Using enum
  milestone_type: MilestoneType;  // Using enum
  tiers: RewardsTier[];  // Array of RewardsTier objects
}

export interface Branding {
  primary_color: string;
  secondary_color: string;
  logo: string;
}

export interface UserReward {
  _id: string;
  customerId: string;
  merchantId: string;
  totalSpent: number;
  purchaseCount: number;
  lastVisit: Date;
  currentDiscount: {
    type: DiscountType;
    amount: number;
  }
  nextTier: string;
}

export interface RewardsCustomer {
  totalSpent: number,
  purchaseCount: number,
  lastVisit: Date,
  userInfo: {
    _id: string,
    name: string,
    email: string,
    squareCustomerId: string,
    privyId: string,
  }
}

export interface PaymentMethod {
  types: PaymentType[];
  venmoQrCodeImage?: string;
  zelleQrCodeImage?: string;
}

export interface QrCodeImage {
  paymentProvider: PaymentProvider
  contentType: string;
  data: Buffer
}

export interface FileData {
  url: string;
  contentType: string;
}

export interface SaleFormData {
  product: string;
  price: string;
  tax: number;
  merchant: string;
  customer: RewardsCustomer | null;
  sellerMerchant: Merchant | null;
  paymentMethod: PaymentType;
}