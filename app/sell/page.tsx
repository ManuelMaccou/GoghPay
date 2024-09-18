'use client'

import React, { useState, FormEvent, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import * as Avatar from '@radix-ui/react-avatar';
import { AlertDialog, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Text, VisuallyHidden } from '@radix-ui/themes';
import { ExclamationTriangleIcon, InfoCircledIcon, RocketIcon } from '@radix-ui/react-icons';
import { Location, Merchant, RewardsCustomer, SquareCatalog, User, PaymentType, SaleFormData } from '../types/types';
import { BalanceProvider } from '../contexts/BalanceContext';
import { Header } from '../components/Header';
import { useUser } from '../contexts/UserContext';
import { logAdminError } from '../utils/logAdminError';
import { ApiError } from '../utils/ApiError';
import { useDeviceType } from '../contexts/DeviceType';
import { useSearchParams } from 'next/navigation';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function SellContent() {
  const { appUser} = useUser();
  const { ready, authenticated, user, login } = usePrivy();
  const deviceType = useDeviceType();

  const [currentUser, setCurrentUser] = useState<User>();

  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  
  const [signedUrl, setSignedUrl] = useState('');
  const [merchant, setMerchant] = useState<Merchant>();
  const [ merchantVerified, setMerchantVerified ] = useState(false);

  const [newSaleFormData, setNewSaleFormData] = useState<SaleFormData | null>(null);
  const [showNewSaleForm, setShowNewSaleForm] = useState<boolean>(true);

  const [currentRewardsCustomers, setCurrentRewardsCustomers] = useState<RewardsCustomer[]>([]);
  const [isFetchingCurrentRewardsCustomers, setIsFetchingCurrentRewardsCustomers] = useState<boolean>(true);
  const [errorFetchingRewards, setErrorFetchingRewards] = useState<string | null>(null);

  const [ isDeterminingMerchantStatus, setIsDeterminingMerchantStatus ] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingCatelog, setLoadingCatalog] = useState<boolean>(false);
  const [squareCatalog, setSquareCatalog] = useState<SquareCatalog[]>([]);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [isFetchingLocations, setIsFetchingLocations] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentType | null>(null);

  const [rewardsDiscount, setRewardsDiscount] = useState<number | 0>(0);
  const [welcomeDiscount, setWelcomeDiscount] = useState<number | 0>(0);
  const [finalPriceCalculated, setFinalPriceCalculated] = useState<boolean>(false);
  const [finalPrice, setFinalPrice] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [successMessage1, setSuccessMessage1] = useState<string | null>(null);
  const [successMessage2, setSuccessMessage2] = useState<string | null>(null);
  const [discountUpgradeMessage, setDiscountUpgradeMessage] = useState<string | null>(null);
  const [squarePosError, setSquarePosError] = useState<string | null>(null);
  const [squarePosSuccessMessage, setSquarePosSuccessMessage] = useState<string | null>(null);
  const [squarePosErrorMessage, setSquarePosErrorMessage] = useState<string | null>(null);

  const [showVenmoDialog, setShowVenmoDialog] = useState<boolean>(false);
  const [showZelleDialog, setShowZelleDialog] = useState<boolean>(false);
  const [showCashDialog, setShowCashDialog] = useState<boolean>(false);
  const [showSquareDialog, setShowSquareDialog] = useState<boolean>(false);

  const paymentMethods: PaymentType[] = [
    PaymentType.Venmo,
    PaymentType.Zelle,
    PaymentType.Square,
    PaymentType.Cash,
  ];

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {

    if (appUser && !currentUser) {
      setCurrentUser(appUser);
    }
  }, [appUser, currentUser]);

  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress;
      setWalletForPurchase(walletAddress);
    }
  }, [appUser]);

  const { logout } = useLogout ({
    onSuccess: async () => {
      router.push('/');
    }
  })

  const resetUrl = (newUrl: string) => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", newUrl);
    }
  };
  
  const updateTransactionDetails = useCallback(async (
    squarePaymentId: string | null,
    clientTransactionId: string,
    transactionIdToUpdate: string,
    statusToSave: string
  ) => {
    try {
      console.log('squarepaymentId at updateTransactionDetails:', squarePaymentId)

      const accessToken = await getAccessToken();
      const response = await fetch('/api/transaction/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: user?.id,
          transactionId: transactionIdToUpdate,
          clientTransactionId,
          status: statusToSave,
          squarePaymentId,
        }),
      });
      const responseData = await response.json();
  
      if (!response.ok) {
        const apiError = new ApiError(
          `API Error11: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );

        console.error('Transaction update failed:', apiError);
      }
    } catch (error) {
      console.error(error);
    }
  }, [user])

  const updateRewards = useCallback(async (newSaleFormData: SaleFormData) => {
    const accessToken = await getAccessToken();

    try {
      const response = await fetch(`/api/rewards/userRewards/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          purchaseData: newSaleFormData,
          finalPrice,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
          response.status,
          responseData
        );
        console.error(apiError);
        return false;
      } else {
        setSuccessMessage1('Customer rewards have been saved.');

        if (responseData.discountUpgradeMessage) {
          setDiscountUpgradeMessage(responseData.discountUpgradeMessage)
        }

        return true;
      }
    } catch (error) {
      // Catch any other errors and log them with their full details
      await logAdminError(newSaleFormData.sellerMerchant?._id, `Updating user rewards during ${newSaleFormData.paymentMethod} transaction. User: ${newSaleFormData.customer?.userInfo._id}. Amount: ${newSaleFormData.price}.`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    
      console.error(error);
      return false;
    }
  }, [finalPrice, user?.id])

  const fetchAndUpdatePaymentDetails = useCallback(
    async (
      serverTransactionId: string | null,
      clientTransactionId: string,
      merchantId: string,
      transactionIdToUpdate: string,
      statusToSave: string,
      rewardsCustomer: string
    ) => {  
      try {
        console.log('fetchAndUpdatePaymentDetails is running');
        let squarePaymentId = '';

        if (serverTransactionId) {
          // Fetch Square payment ID using the server transaction ID
          const fetchedSquarePaymentId = await fetchSquarePaymentId(
            serverTransactionId,
            merchantId
          );

          console.log('fetchedSquarePaymentId:', fetchedSquarePaymentId)

          if (fetchedSquarePaymentId) {
            squarePaymentId = fetchedSquarePaymentId;
          }
        }

        await updateTransactionDetails(
          squarePaymentId,
          clientTransactionId,
          transactionIdToUpdate,
          statusToSave
        );
        if (newSaleFormData && rewardsCustomer && rewardsCustomer !== '') {
          await updateRewards(newSaleFormData)
        } 

        sessionStorage.removeItem('newSaleFormData');
        resetUrl("/sell");
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
      } catch (error) {
        console.error('Error updating payment details:', error);
      }
    },
  [newSaleFormData, updateTransactionDetails, updateRewards]
);

  useEffect(() => {
    if (!currentUser) return;
    // Extract query parameters from the URL
    const statusParam = searchParams.get('status');
    const statusToSave = searchParams.get('statusToSave') || 'PENDING';
    const clientTransactionId = searchParams.get('clientTransactionId') || '';
    const serverTransactionId = searchParams.get('serverTransactionId');
    console.log('servertransactionId:', serverTransactionId);

    const messageParam = searchParams.get('message') || '';
    const merchantId = searchParams.get('merchantId');
    const transactionIdToUpdate = searchParams.get('goghTransactionId');
    const rewardsCustomer = searchParams.get('rewardsCustomer') || '';

    // If the transaction is successful and we have a transaction ID, fetch payment details
    if (statusParam === 'success' && merchantId && transactionIdToUpdate && currentUser) {
      setShowNewSaleForm(false);
      setSuccessMessage1(null);
      setSuccessMessage2(null);
      setErrorMessage(null);
      setDiscountUpgradeMessage(null)

      setSquarePosSuccessMessage(messageParam);

      fetchAndUpdatePaymentDetails(serverTransactionId, clientTransactionId, merchantId, transactionIdToUpdate, statusToSave, rewardsCustomer);
    } else if (statusParam === 'error' && messageParam) {
      setShowNewSaleForm(true);
      setSquarePosErrorMessage(messageParam);
    }
  }, [searchParams, currentUser, fetchAndUpdatePaymentDetails]);

  const fetchSquarePaymentId = async (
    serverTransactionId: string,
    merchantId: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(
        `/api/square/orders?transactionId=${serverTransactionId}&merchantId=${merchantId}`
      );
      const data = await response.json();
      
      if (response.ok) {
       
        if (data.paymentId) {
          console.log('paymentId:', data.paymentId)
         
          return data.paymentId;
        } else if (data.message) {
          // Handle valid cash transaction (no order)
          console.log('Message:', data.message);
          return null;
        } else {
          setError('Failed to fetch payment details from Square.');
          return null;
        }
      } else {
        if (data.message) {
          setError(data.message);
        } else {
          setError('Failed to fetch payment details from Square.');
        }
        return null;
      }
    } catch (err) {
      console.error('Error fetching payment details:', err);
      setError('An error occurred while fetching payment details.');
      return null
    }
  };

  const handleMessageUpdate = (msg: string) => {
    setMessage(msg);
  };

  const fetchCheckedInCustomers = useCallback(async (merchantId: string) => {
    if (!currentUser) return;
    setIsFetchingCurrentRewardsCustomers(true)
    const accessToken = await getAccessToken();
    try {
      const response = await fetch(`/api/rewards/userRewards/customers/?merchantId=${merchantId}&privyId=${user?.id}`, {
        next: {revalidate: 1},
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
      });

      if (response.ok) {
        const rewardsCustomers = await response.json();
        setCurrentRewardsCustomers(rewardsCustomers);

      } else if (response.status === 401) {
        setErrorFetchingRewards('Unauthorized access. Please log in again.');
      } else if (response.status === 404) {
        setErrorFetchingRewards('No customers found. Please refresh the page.');
      } else {
        setErrorFetchingRewards('Error searching for customers. Please refresh the page.');
      }

    } catch (error: unknown) {
      if (isError(error)) {
        console.error('Error fetching reward customers:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      setError('Error fetching user');
    } finally {
      setIsFetchingCurrentRewardsCustomers(false);
    }
  }, [currentUser, user?.id]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setIsLoading(false);
      return;
    }
    
    if (!user) {
      setIsLoading(false);
      return
    }
    const userId = user.id

    async function verifyMerchantStatus() {
      setIsDeterminingMerchantStatus(true);
      const accessToken = await getAccessToken();
      try {
        const response = await fetch(`/api/merchant/verifyMerchantStatus/${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`, 
          },
        });

        const data = await response.json()

        if (response.status === 404) {
          setMerchantVerified(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        } else {
          setMerchant(data);
          setMerchantVerified(true);
        }

        setMerchant(data);
        setMerchantVerified(true);

      } catch (err) {
        if (isError(err)) {
          console.error(`Error fetching merchant: ${err.message}`);
        } else {
          console.error('Error fetching merchant');
        }
      } finally {
        setIsLoading(false);
        setIsDeterminingMerchantStatus(false);
      }
    }

    verifyMerchantStatus();
  }, [user, ready, authenticated]);

  useEffect(() => {
    if (ready && authenticated && currentUser && merchant) {
      fetchCheckedInCustomers(merchant._id);
    }
  }, [authenticated, ready, currentUser, merchant, fetchCheckedInCustomers]);

  const handleSquarePosPayment = async (newSaleFormData: SaleFormData | null) => {
    if (!finalPrice || !finalPriceCalculated) {
      setSquarePosError('Missing payment details. Please refresh the page and try again.')
      return;
    } 

    if (!newSaleFormData) {
      setSquarePosError('Missing sale details. Please refresh the page and try again.')
      return;
    } 

    let goghTransactionId;

    const priceNum = parseFloat(newSaleFormData.price);
    const calculatedSalesTax = parseFloat(((newSaleFormData.tax/100) * priceNum).toFixed(2));

    const squareClientId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!;
    const priceInCents = Math.round(parseFloat(finalPrice) * 100);
    const rewardsCustomer = newSaleFormData.customer?.userInfo._id || ""

    if (deviceType === 'iPhone') {


      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/transaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            privyId: user?.id,
            buyerPrivyId: user?.id,
            buyerId: newSaleFormData.customer?.userInfo._id,
            merchantId: newSaleFormData.sellerMerchant?._id,
            productName: newSaleFormData.product,
            productPrice: newSaleFormData.price,
            discountType: newSaleFormData.customer?.currentDiscount.type,
            discountAmount: newSaleFormData.customer?.currentDiscount.amount,
            welcomeDiscount: welcomeDiscount,
            salesTax: newSaleFormData.tax,
            paymentType: newSaleFormData.paymentMethod,
            status: 'PENDING',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
        
          const apiError = new ApiError(
            `API Error: ${response.status} - ${response.statusText} - ${data.message || 'Unknown Error'}`,
            response.status,
            data
          );
      
          await logAdminError(merchant?._id, `Saving a ${newSaleFormData.paymentMethod} transaction`, {
            message: apiError.message,
            status: apiError.status,
            responseBody: apiError.responseBody,
            stack: apiError.stack,
          });
      
          console.error(error);
        } else {
          goghTransactionId = data.transaction._id
          console.log('Transaction from POS saved successfully:', data);
        }
      } catch (error) {
  
        await logAdminError(merchant?._id, `Attempting to save a ${newSaleFormData.paymentMethod} transaction`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }


      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/ios`;
      const state = {
        merchantId: newSaleFormData.sellerMerchant?._id,
        goghTransactionId: goghTransactionId,
        rewardsCustomer: rewardsCustomer,
      };
      
      let dataParameter;

      if (newSaleFormData?.customer?.userInfo.squareCustomerId) {
        dataParameter = {
          amount_money: {
            amount: priceInCents,
            currency_code: 'USD',
          },
          callback_url: callbackUrl,
          client_id: squareClientId,
          version: "1.3",
          notes: `Gogh on behalf of ${newSaleFormData.sellerMerchant?.name}. ReferenceID: ${goghTransactionId}`,
          customer_id: newSaleFormData?.customer?.userInfo.squareCustomerId,
          state: JSON.stringify(state),
          options: {
            supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE"],
            auto_return: true,
            clear_default_fees: true,
          },
        };
      } else {
        dataParameter = {
          amount_money: {
            amount: priceInCents,
            currency_code: 'USD',
          },
          callback_url: callbackUrl,
          client_id: squareClientId,
          version: "1.3",
          notes: `Gogh on behalf of ${newSaleFormData.sellerMerchant?.name}. ReferenceID: ${goghTransactionId}`,
          state: JSON.stringify(state),
          options: {
            supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE"],
            auto_return: true,
            clear_default_fees: true,
          },
        };
      }
      
      const url = `square-commerce-v1://payment/create?data=${encodeURIComponent(
        JSON.stringify(dataParameter)
      )}`;

      console.log('ios POS url:', url);

      window.location.href = url;

    } else if (deviceType === 'Android') {

      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/transaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            privyId: user?.id,
            buyerPrivyId: user?.id,
            buyerId: newSaleFormData.customer?.userInfo._id,
            merchantId: newSaleFormData.sellerMerchant?._id,
            productName: newSaleFormData.product,
            productPrice: newSaleFormData.price,
            discountType: newSaleFormData.customer?.currentDiscount.type,
            discountAmount: newSaleFormData.customer?.currentDiscount.amount,
            welcomeDiscount: welcomeDiscount,
            salesTax: newSaleFormData.tax,
            paymentType: newSaleFormData.paymentMethod,
            status: 'PENDING',
          }),
        });
  
        const data = await response.json();
    
        if (!response.ok) {
        
          const apiError = new ApiError(
            `API Error: ${response.status} - ${response.statusText} - ${data.message || 'Unknown Error'}`,
            response.status,
            data
          );
      
          await logAdminError(merchant?._id, `Saving a ${newSaleFormData.paymentMethod} transaction`, {
            message: apiError.message,
            status: apiError.status,
            responseBody: apiError.responseBody,
            stack: apiError.stack,
          });
      
          console.error(error);
        } else {
          goghTransactionId = data.transaction._id
          console.log('Transaction from POS saved successfully:', data);
        }
      } catch (error) {
  
        await logAdminError(merchant?._id, `Attempting to save a ${newSaleFormData.paymentMethod} transaction`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      //const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/android?merchantId=${merchantId}&goghTransactionId=${goghTransactionId}`;
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/android`;
      const sdkVersion = "v1.3";
      const currencyCode = "USD";
      const customerId = newSaleFormData?.customer?.userInfo.squareCustomerId;
      const tenderTypes = [
        "com.squareup.pos.TENDER_CARD",
        "com.squareup.pos.TENDER_CARD_ON_FILE",
      ].join(",");

      let posUrl
      if (customerId) {
        posUrl =
        "intent:#Intent;" +
        "action=com.squareup.pos.action.CHARGE;" +
        "package=com.squareup;" +
        "l.com.squareup.pos.AUTO_RETURN_TIMEOUT_MS=3200;" +
        `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)};` +
        `S.com.squareup.pos.CLIENT_ID=${squareClientId};` +
        `S.com.squareup.pos.API_VERSION=${sdkVersion};` +
        `i.com.squareup.pos.TOTAL_AMOUNT=${priceInCents};` + 
        `S.com.squareup.pos.CURRENCY_CODE=${currencyCode};` +
        `S.com.squareup.pos.TENDER_TYPES=${tenderTypes};` +
        `S.com.squareup.pos.CUSTOMER_ID=${customerId};` +
        `S.com.squareup.pos.REQUEST_METADATA={"merchantId":"${newSaleFormData.sellerMerchant?._id}","goghTransactionId":"${goghTransactionId}","rewardsCustomer":"${rewardsCustomer}"};` +
        `S.com.squareup.pos.NOTE=${encodeURIComponent(`Gogh on behalf of ${newSaleFormData.sellerMerchant?.name}. ReferenceID: ${goghTransactionId}`)};` +
        "end;";

      } else {
        posUrl =
          "intent:#Intent;" +
          "action=com.squareup.pos.action.CHARGE;" +
          "package=com.squareup;" +
          "l.com.squareup.pos.AUTO_RETURN_TIMEOUT_MS=3200;" +
          `S.com.squareup.pos.WEB_CALLBACK_URI=${encodeURIComponent(callbackUrl)};` +
          `S.com.squareup.pos.CLIENT_ID=${squareClientId};` +
          `S.com.squareup.pos.API_VERSION=${sdkVersion};` +
          `i.com.squareup.pos.TOTAL_AMOUNT=${priceInCents};` + 
          `S.com.squareup.pos.CURRENCY_CODE=${currencyCode};` +
          `S.com.squareup.pos.TENDER_TYPES=${tenderTypes};` +
          `S.com.squareup.pos.REQUEST_METADATA={"merchantId":"${newSaleFormData.sellerMerchant?._id}","goghTransactionId":"${goghTransactionId}","rewardsCustomer":"${rewardsCustomer}"};` +
          `S.com.squareup.pos.NOTE=${encodeURIComponent(`Gogh on behalf of ${newSaleFormData.sellerMerchant?.name}. ${goghTransactionId}`)};` +
          "end;";
      }
        console.log('url:', posUrl)

        window.location.href = posUrl;
    }
  };

  /*
  useEffect(() => {
    const fetchInventory = async () => {
      if (merchant?.square?.access_token) {
        await fetchLocations(merchant._id);
        if (locations) {
          await fetchSquareCatelog();
        }
      }
    }

    fetchInventory();
    
  }, [locations, merchant]);
  

  const fetchSquareCatelog = async () => {
    setLoadingCatalog(true);
    
    // PLACEHOLDER FOR FETCHING CATELOG

  } 
    */

  const fetchLocations = async (merchantId: string) => {
    setIsFetchingLocations(true);
    try {
      const response = await fetch(`/api/square/locations?merchantId=${merchantId}`);
      if (response.status === 401) {
        const errorText = await response.text();
        if (errorText.includes('expired')) {
          setError('Token expired. Please reconnect.');
        } else if (errorText.includes('revoked')) {
          setError('Token revoked. Please reconnect.');
        } else if (errorText.includes('No access token')) {
          setError(null);
        } else {
          setError('Unauthorized. Please reconnect.');
        }
        setLocations([]);
      } else if (response.status === 403) {
        setError('Insufficient permissions. Please contact us.');
        setLocations([]);
      } else if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      } else {
        setError('Process failed. Please try again.');
        setLocations([]);
      }
    } catch (err) {
      if (isError(err)) {
        setLocationError(`Error fetching locations: ${err.message}`);
      } else {
        setLocationError('Error fetching locations. Please contact us.');
      }
    } finally {
      setIsFetchingLocations(false);
    }
  };

  const handlePaymentMethodChange = (method: PaymentType, newSaleForm: SaleFormData) => {
    setSelectedPaymentMethod(method);

    if (method === 'Venmo') {
      setShowVenmoDialog(true);
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Zelle') {
      setShowZelleDialog(true);
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Cash') {
      setShowCashDialog(true);
      sessionStorage.removeItem('newSaleFormData');

    } else if (method === 'Square') {
      setShowSquareDialog(true);
      sessionStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));
      console.log('session storage:', sessionStorage)
      router.replace('/sell?status=square');

    } else if (method === 'ManualEntry') {
      sessionStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));
      router.push('/checkout/manual');
    }
  };

  useEffect(() => {
    const storedData = sessionStorage.getItem('newSaleFormData');
    
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setNewSaleFormData(parsedData);
    }
    console.log('session data:', sessionStorage)
  }, []);

  useEffect(() => {
    setRewardsDiscount(0);
    setWelcomeDiscount(0);
    setFinalPriceCalculated(false)
    setFinalPrice(null);

    if (!newSaleFormData) return;
    if (!newSaleFormData.price) return;

    const priceNum = parseFloat(newSaleFormData.price)

    let rewardsDiscountAmount = 0;
    let welcomeDiscountAmount = 0;
    let priceAfterDiscount = priceNum;

    let finalPriceCalculation = priceNum;

    if (newSaleFormData.sellerMerchant?.rewards?.welcome_reward && newSaleFormData.customer?.purchaseCount === 1) {
      welcomeDiscountAmount = newSaleFormData.sellerMerchant?.rewards?.welcome_reward
    }

    if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.amount) {
      rewardsDiscountAmount = newSaleFormData.customer.currentDiscount.amount
    }
    

    const totalDiscountAmount = rewardsDiscountAmount + welcomeDiscountAmount

    if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.type === 'percent') {
      if (totalDiscountAmount > 100) {
        priceAfterDiscount = 0

      } else {
        priceAfterDiscount = priceNum - ((totalDiscountAmount/100) * priceNum)
      }

    } else if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount.type === 'dollar') {
      priceAfterDiscount = priceNum - totalDiscountAmount
      if (priceAfterDiscount < 0) {
        priceAfterDiscount = 0
      }
    }
    
    if (newSaleFormData.tax > 0) {
      finalPriceCalculation = priceAfterDiscount + ((newSaleFormData.tax / 100) * priceAfterDiscount);
    } else {
      finalPriceCalculation = priceAfterDiscount
    }

    setRewardsDiscount(rewardsDiscountAmount);
    setWelcomeDiscount(welcomeDiscountAmount);
    setFinalPriceCalculated(true);
    setFinalPrice(finalPriceCalculation.toFixed(2));

  }, [newSaleFormData])
  
  const handleQrCodeGenerated = (url: string) => {
    setSignedUrl(url);
  };

  const handleResetMessages = () => {
    setSuccessMessage1(null);
    setSuccessMessage2(null);
    setErrorMessage(null);
    setSquarePosErrorMessage(null);
    setDiscountUpgradeMessage(null);
  };

  const handleSavePaymentAndUpdateRewards = async (newSaleFormData: SaleFormData) => {
    const accessToken = await getAccessToken();
    console.log('newsaleformdata:', newSaleFormData);

    const priceNum = parseFloat(newSaleFormData.price);
    const calculatedSalesTax = parseFloat(((newSaleFormData.tax/100) * priceNum).toFixed(2));

    if (newSaleFormData.customer) {
      try {
        const response = await fetch(`/api/rewards/userRewards/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            privyId: user?.id,
            purchaseData: newSaleFormData,
            finalPrice,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          setNewSaleFormData(null);
          setShowNewSaleForm(true);
          setErrorMessage('There was an error updating the customer rewards. We have received the error and are looking into it.');
    
          const apiError = new ApiError(
            `API Error: ${response.status} - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
            response.status,
            responseData
          );
      
          await logAdminError(merchant?._id, `Updating user rewards during ${newSaleFormData.paymentMethod} transaction`, {
            message: apiError.message,
            status: apiError.status,
            responseBody: apiError.responseBody,
            stack: apiError.stack,
          });
      
          console.error(apiError);
        } else {
          if (merchant) {
            fetchCheckedInCustomers(merchant._id)
          }
          setSuccessMessage1('Customer rewards have been saved.');
          setNewSaleFormData(null);
          setShowNewSaleForm(true);

          if (responseData.discountUpgradeMessage) {
            setDiscountUpgradeMessage(responseData.discountUpgradeMessage)
          }

          console.log('Rewards updated successfully:', responseData);
        }
      } catch (error) {
        // Catch any other errors and log them with their full details
        await logAdminError(merchant?._id, `Attempting to update user rewards`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      
        console.error(error);
      }
    }
    try {
      const response = await fetch(`/api/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          privyId: user?.id,
          buyerPrivyId: user?.id, // Needs to be the current user for auth purposes. Special case since the merchant is triggering the purchase for the buyer
          buyerId: newSaleFormData.customer?.userInfo._id,
          merchantId: newSaleFormData.sellerMerchant?._id,
          productName: newSaleFormData.product,
          productPrice: newSaleFormData.price,
          discountType: newSaleFormData.customer?.currentDiscount.type,
          discountAmount: newSaleFormData.customer?.currentDiscount.amount,
          welcomeDiscount: welcomeDiscount,
          salesTax: newSaleFormData.tax,
          paymentType: newSaleFormData.paymentMethod,
          status: (newSaleFormData.paymentMethod === 'Venmo' || newSaleFormData.paymentMethod === 'Zelle' || newSaleFormData.paymentMethod === 'Cash') ? "COMPLETE" : "PENDING",
        }),
      });

      const data = await response.json();
  
      if (!response.ok) {
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
        setErrorMessage('There was an error saving the transaction. We have received the error and are looking into it.');
        
        const apiError = new ApiError(
          `API Error: ${response.status} - ${response.statusText} - ${data.message || 'Unknown Error'}`,
          response.status,
          data
        );
    
        await logAdminError(merchant?._id, `Saving a ${newSaleFormData.paymentMethod} transaction`, {
          message: apiError.message,
          status: apiError.status,
          responseBody: apiError.responseBody,
          stack: apiError.stack,
        });
    
        console.error(error);
      } else {
        setSuccessMessage2('Transaction saved.');
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
        sessionStorage.removeItem('newSaleFormData');
        console.log('Transaction saved successfully:', data);
      }
    } catch (error) {

      await logAdminError(merchant?._id, `Attempting to save a ${newSaleFormData.paymentMethod} transaction`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  return (
    <Flex
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'linear-gradient(to bottom, #1e5799 0%,#2989d8 50%,#207cca 51%,#7db9e8 100%)'
      }}
    >
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
        <Heading size={'8'} style={{color: "white"}}>New Sale</Heading>
        
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            color={"white"}
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
        </BalanceProvider>
      </Flex>
      <Flex
        flexGrow={'1'}
        py={'7'}
        direction={'column'}
        justify={'between'}
        align={'center'}
        height={'100%'}
        style={{
          backgroundColor: 'white',
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)'
        }}
      >
       {ready && authenticated ? (
          user && merchant ? (
            merchantVerified ? (
              <>         
                {newSaleFormData && selectedPaymentMethod === 'Venmo' && (
                  newSaleFormData.sellerMerchant?.paymentMethods?.venmoQrCodeImage ? (
                    <AlertDialog.Root open={showVenmoDialog} onOpenChange={setShowVenmoDialog}>
                      <AlertDialog.Trigger>
                        <Button style={{ display: 'none' }} />
                      </AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="450px">
                        <VisuallyHidden>
                          <AlertDialog.Title>Venmo QR code</AlertDialog.Title>
                        </VisuallyHidden>
                        <VisuallyHidden>
                          <AlertDialog.Description size="2" mb="4">
                          Venmo QR code
                          </AlertDialog.Description>
                        </VisuallyHidden>
                        
                        <Flex direction={'column'} width={'100%'} justify={'center'} align={'center'} gap={'6'}>
                          
                          {newSaleFormData && finalPriceCalculated && finalPrice && (
                            <Flex direction={'column'} justify={'center'}>
                              <Text size={'9'} align={'center'}>${finalPrice}</Text>
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                                <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                              </Flex>
                              {rewardsDiscount > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                                  ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                                  )}
                                </Flex>
                              )}

                              {welcomeDiscount > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                                  ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                                  )}
                                </Flex>
                              )}
                          
                              {newSaleFormData.tax > 0 && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Sales tax:</Text>
                                  <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                                </Flex>
                              )}
                            </Flex>
                          )}

                          <Avatar.Root>
                            <Avatar.Image 
                              src={ newSaleFormData.sellerMerchant?.paymentMethods?.venmoQrCodeImage }
                              alt="Venmo QR code"
                            style={{objectFit: "contain", maxWidth: '100%'}}
                            />
                          </Avatar.Root>
                          <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                        </Flex>
                       
                        <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                          <AlertDialog.Cancel>
                            <Button size={'4'} variant="ghost" 
                              onClick={() => {
                                setSelectedPaymentMethod(null);
                                setShowNewSaleForm(true);
                              }}>
                              Cancel
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button size={'4'} 
                              onClick={() => {
                                handleSavePaymentAndUpdateRewards(newSaleFormData);
                                setShowVenmoDialog(false);
                              }}>
                              Confirm
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  ) : newSaleFormData && !newSaleFormData.sellerMerchant?.paymentMethods?.venmoQrCodeImage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        Venmo has not been configured. Please add your QR code in {" "} <Link href='/account/integrations'> <Strong>settings</Strong></Link>
                      </Callout.Text>
                    </Callout.Root>
                  )
                )}

                {newSaleFormData && selectedPaymentMethod === 'Zelle' && (
                  newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage ? (
                    <AlertDialog.Root open={showZelleDialog} onOpenChange={setShowZelleDialog}>
                      <AlertDialog.Trigger>
                        <Button style={{ display: 'none' }} />
                      </AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="450px">
                        <VisuallyHidden>
                          <AlertDialog.Title>Zelle QR code</AlertDialog.Title>
                        </VisuallyHidden>
                        <VisuallyHidden>
                          <AlertDialog.Description size="2" mb="4">
                          Zelle QR code
                          </AlertDialog.Description>
                        </VisuallyHidden>
                        
                        <Flex direction={'column'} width={'100%'} align={'center'} gap={'6'}>

                          {newSaleFormData && finalPriceCalculated && (
                            <Flex direction={'column'} justify={'center'}>
                            <Text size={'9'} align={'center'}>${finalPrice}</Text>
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                              <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                            </Flex>
                            {rewardsDiscount > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                  <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                                ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                  <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                                )}
                              </Flex>
                            )}

                            {welcomeDiscount > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                  <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                                ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                  <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                                )}
                              </Flex>
                            )}
                        
                            {newSaleFormData.tax > 0 && (
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} align={'left'}>Sales tax:</Text>
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                              </Flex>
                            )}
                            </Flex>
                          )}
                         
                          <Avatar.Root>
                            <Avatar.Image 
                            src={ newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage }
                            alt="Zelle QR code"
                            style={{objectFit: "contain", maxWidth: '100%'}}
                            />
                          </Avatar.Root>
                          <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                        </Flex>
                       
                        <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                          <AlertDialog.Cancel>
                            <Button size={'4'} variant="ghost" 
                              onClick={() => {
                                setSelectedPaymentMethod(null);
                                setShowNewSaleForm(true);
                              }}>
                              Cancel
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button size={'4'} 
                              onClick={() => {
                                handleSavePaymentAndUpdateRewards(newSaleFormData);
                                setShowZelleDialog(false);
                              }}>
                              Confirm
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  ) : newSaleFormData && !newSaleFormData.sellerMerchant?.paymentMethods.zelleQrCodeImage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        Zelle has not been configured. Please add your QR code in {" "} <Link href='/account/integrations'> <Strong>settings</Strong></Link>
                      </Callout.Text>
                    </Callout.Root>
                  )
                )} 

                {newSaleFormData && selectedPaymentMethod === 'Cash' && (
                  <AlertDialog.Root open={showCashDialog} onOpenChange={setShowCashDialog}>
                    <AlertDialog.Trigger>
                      <Button style={{ display: 'none' }} />
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <VisuallyHidden>
                        <AlertDialog.Title>Cash payment</AlertDialog.Title>
                      </VisuallyHidden>
                      <VisuallyHidden>
                        <AlertDialog.Description size="2" mb="4">
                          Cash payment
                        </AlertDialog.Description>
                      </VisuallyHidden>
                      
                      <Flex direction={'column'} width={'100%'} align={'center'} justify={'center'} gap={'9'}>
                        {newSaleFormData && finalPriceCalculated && (
                          <Flex direction={'column'} justify={'center'}>
                        <Text size={'9'} align={'center'}>${finalPrice}</Text>
                          <Flex direction={'row'} width={'300px'} justify={'between'}>
                            <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                            <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                          </Flex>
                          {rewardsDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Welcome discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                              )}
                            </Flex>
                          )}
                      
                          {newSaleFormData.tax > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Sales tax:</Text>
                              <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                            </Flex>
                          )}
                          </Flex>
                        )}
                        <Text size={'7'}>Press confirm when you&apos;ve received payment.</Text>
                      </Flex>
                      
                      <Flex direction={'row'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
                        <AlertDialog.Cancel>
                          <Button size={'4'} variant="ghost" 
                            onClick={() => {
                              setSelectedPaymentMethod(null);
                              setShowNewSaleForm(true);
                            }}>
                            Cancel
                          </Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                          <Button size={'4'} 
                            onClick={() => {
                              handleSavePaymentAndUpdateRewards(newSaleFormData);
                              setShowCashDialog(false);
                            }}>
                            Confirm
                          </Button>
                        </AlertDialog.Action>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                )} 

                {newSaleFormData && selectedPaymentMethod === 'Square' && (
                  <AlertDialog.Root open={showSquareDialog} onOpenChange={setShowSquareDialog}>
                    <AlertDialog.Trigger>
                      <Button style={{ display: 'none' }} />
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <AlertDialog.Title size={'8'} align={'center'} mb={'5'}>Credit card</AlertDialog.Title>
                      <VisuallyHidden>
                        <AlertDialog.Description size="2" mb="4">
                          Square payment
                        </AlertDialog.Description>
                      </VisuallyHidden>
                      
                      <Flex direction={'column'} width={'100%'} align={'center'} justify={'center'} gap={'9'}>
                        {newSaleFormData && finalPriceCalculated && (
                          <Flex direction={'column'} justify={'center'}>
                        <Text size={'9'} align={'center'}>${finalPrice}</Text>
                          <Flex direction={'row'} width={'300px'} justify={'between'}>
                            <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                            <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                          </Flex>
                          {rewardsDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer.currentDiscount.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer.currentDiscount.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Welcome discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                              )}
                            </Flex>
                          )}
                      
                          {newSaleFormData.tax > 0 && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Sales tax:</Text>
                              <Text size={'5'} align={'left'}><Strong>{newSaleFormData.tax}%</Strong></Text>
                            </Flex>
                          )}
                          </Flex>
                        )}
                      </Flex>

                      {squarePosError && (
                        <Callout.Root color="red" style={{width: 'max-content', padding: '7px'}}>
                        <Callout.Text size={'3'}>
                          {squarePosError}
                        </Callout.Text>
                      </Callout.Root>
                      )}
                      
                      <Flex direction={'column'} gap="7" mt="4" justify={'between'} align={'center'} pt={'4'}>
                        <AlertDialog.Action>
                          <Button size={'4'} 
                            style={{width: '250px'}}
                            onClick={() => {
                              handleSquarePosPayment(newSaleFormData);
                              setShowSquareDialog(false);
                            }}>
                            Charge
                          </Button>
                        </AlertDialog.Action>
                        <AlertDialog.Cancel>
                          <Button size={'4'} variant="ghost" 
                            onClick={() => {
                              setSelectedPaymentMethod(null);
                              setShowNewSaleForm(true);
                            }}>
                            Cancel
                          </Button>
                        </AlertDialog.Cancel>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                )} 
                
                {showNewSaleForm ? (
                  <NewSaleForm
                    onQrCodeGenerated={handleQrCodeGenerated}
                    onMessageUpdate={handleMessageUpdate}
                    userId={user.id}
                    merchantFromParent={merchant}
                    customers={currentRewardsCustomers}
                    paymentMethods={paymentMethods}
                    onNewSaleFormSubmit={(formData: SaleFormData) => {
                      setShowNewSaleForm(false);
                      setNewSaleFormData(formData);
                      handlePaymentMethodChange(formData.paymentMethod, formData);
                    }}
                    onStartNewSale={handleResetMessages}
                    onCustomerRefresh={fetchCheckedInCustomers}
                    formData={newSaleFormData}
                    checkoutStatus={searchParams.get('status')}
                  />
                ) : null}

                <Flex direction={'column'} gap={'4'}>

                  {discountUpgradeMessage && (
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <RocketIcon height={'25'} width={'25'} />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {discountUpgradeMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}
              
                  {successMessage1 && (
                    <Callout.Root mx={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text size={'6'}>
                      {successMessage1}
                    </Callout.Text>
                  </Callout.Root>
                  )}

                  {successMessage2 && (
                    <Callout.Root mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {successMessage2}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {squarePosSuccessMessage && (
                    <Callout.Root mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}>
                        {squarePosSuccessMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {errorMessage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'}  wrap={'wrap'} style={{ wordBreak: 'break-word' }}>
                        {errorMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {squarePosErrorMessage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'6'} wrap={'wrap'} style={{ wordBreak: 'break-word' }}>
                        {squarePosErrorMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}
                </Flex>
                </>
              ) : (
                <Flex direction={'column'} flexGrow={'1'} px={'5'} justify={'center'} align={'center'} gap={'9'}>
                  <Callout.Root color='red' role='alert'>
                    <Callout.Icon>
                      <ExclamationTriangleIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      <Strong>Unauthorized.</Strong> This page is for merchants only. You can{' '}
                      <Link href='https://www.ongogh.com' target='_blank' rel='noopener noreferrer'>
                        request access here.
                      </Link>
                        If you think this is a mistake, please{' '}
                      <Link href='mailto: hello@ongogh.com' target='_blank' rel='noopener noreferrer'>
                        contact us.
                      </Link>
                    </Callout.Text>
                  </Callout.Root>
                  <Button onClick={logout} style={{ width: '250px' }} size={'4'}>
                    Log out
                  </Button>
                </Flex>
              )
          ) : null
        ) : ready && !authenticated && (
          <Button size={'4'} style={{ width: '250px' }} onClick={login}>
            Log in
          </Button>
        )}
      </Flex>
    </Flex>
  );
}

export default function Sell() {
  return (
    <Suspense fallback={<Spinner />}>
      <SellContent />
    </Suspense>
  );
}