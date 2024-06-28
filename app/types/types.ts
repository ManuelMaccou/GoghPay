export interface User {
  _id: string;
  privyId?: string;
  walletAddress?: string;
  name?: string;
  email?: string;
  merchant?: boolean;
  creationType: string;
}

export interface Merchant {
  _id: string;
  walletAddress?: string;
  storeImage?: string;
  privyId?: string;
  stripeConnectedAccountId?: string;
}

export interface Transaction {
  _id: string;
  merchant: Merchant;
  buyer: User;
  productName: string;
  productPrice: number;
  transactionHash: string;
}