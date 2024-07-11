export interface User {
  _id: string;
  privyId?: string;
  walletAddress?: string;
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
}

export interface Transaction {
  _id: string;
  merchant: Merchant;
  buyer: User;
  productName: string;
  productPrice: number;
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