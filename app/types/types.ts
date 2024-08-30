enum DiscountType {
  Dollar = 'dollar',
  Percent = 'percent',
}

enum MilestoneType {
  DollarsSpent = 'dollars_spent',
  NumberOfVisits = 'number_of_visits',
}

export interface User {
  _id: string;
  privyId?: string;
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
  square_access_token?: string;
  square_merchant_id?: string;
  square_refresh_token?: string;
  square_token_expires_at?: string;
  square_location_id?: string;
  square_location_name?: string;
  rewards?: Rewards;
  branding: Branding;
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
  paymentType: string; // 'sponsored crypto', 'crypto', 'mobile pay'
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
  userId: string;
  merchantId: string;
  totalSpent: number;
  visitsCount: number;
  lastVisit: Date;
  currentTier: string;
  nextTier: string;
}