'use client'

import React, { useState, FormEvent, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode.react';
import { getAccessToken, getEmbeddedConnectedWallet, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { NewSaleForm } from './components/newSaleForm';
import * as Avatar from '@radix-ui/react-avatar';
import { AlertDialog, Button, Callout, Card, Flex, Heading, Link, Spinner, Strong, Text, VisuallyHidden } from '@radix-ui/themes';
import { ArrowLeftIcon, ExclamationTriangleIcon, InfoCircledIcon, RocketIcon } from '@radix-ui/react-icons';
import { Location, Merchant, RewardsCustomer, SquareCatalog, User, PaymentType, SaleFormData } from '../types/types';
import { BalanceProvider } from '../contexts/BalanceContext';
import { Header } from '../components/Header';
import { useUser } from '../contexts/UserContext';
import { logAdminError } from '../utils/logAdminError';
import { ApiError } from '../utils/ApiError';
import { useDeviceType } from '../contexts/DeviceType';
import { useSearchParams } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { setSaleDataCookie } from '../actions/setSaleDataCookie';
import { useMerchant } from '../contexts/MerchantContext';

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

function SellContent() {
  const { appUser} = useUser();
  const { ready, authenticated, user, login } = usePrivy();
  const deviceType = useDeviceType();

  const { isFetchingMerchant } = useMerchant();

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
  const [priceAfterDiscount, setPriceAfterDiscount] = useState<string | null>(null);
  const [finalPriceCalculated, setFinalPriceCalculated] = useState<boolean>(false);
  const [finalPrice, setFinalPrice] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [rewardsUpdated, setRewardsUpdated] = useState<boolean>(false);
  const [customerUpgraded, setCustomerUpgraded] =  useState<boolean>(false);
  const [squarePosError, setSquarePosError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!currentUser) return;
    if (!merchant) return;

    if (typeof window !== 'undefined' && searchParams) {
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message') || '';
      const customerUpgradedParam = searchParams.get('customerUpgraded');
      const rewardsUpdatedParam = searchParams.get('rewardsUpdated') || '';
      console.log('rewardsUpdated:', rewardsUpdated);
      console.log('rewardsUpdatedParam:', rewardsUpdatedParam);

      if (statusParam === 'success') {
        if (customerUpgradedParam === 'true') {
          setCustomerUpgraded(true)
        }

        if (rewardsUpdatedParam === 'true') {
          setRewardsUpdated(true)
        }

        setShowNewSaleForm(true);
        setErrorMessage(null);

      } else if (statusParam === 'error' && messageParam) {
        setShowNewSaleForm(true);
        setSquarePosErrorMessage(messageParam);
      }
    }
  }, [searchParams, currentUser, merchant, rewardsUpdated]);

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
        if (response.status === 204) {
          setCurrentRewardsCustomers([]);
        } else {
          const rewardsCustomers = await response.json();
          setCurrentRewardsCustomers(rewardsCustomers);
        }
      } else if (response.status === 401) {
        setErrorFetchingRewards('Unauthorized access. Please log in again.');
      } else if (response.status === 404) {
        setErrorFetchingRewards('No customers found. Please refresh the page.');
      } else {
        setErrorFetchingRewards('Error searching for customers. Please refresh the page.');
      }

    } catch (error: unknown) {
      Sentry.captureException(error);
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
          const apiError = new ApiError(
            `Verifying merchant status on sell page - ${response.statusText} - ${data.message || 'Unknown Error'}`,
            response.status,
            data
          );
          Sentry.captureException(apiError, {
            extra: {
              responseStatus: response?.status ?? 'unknown',
              responseMessage: data?.message || 'Unknown Error',
              userId: userId ?? 'unkown userId'
            },
          });

          throw new Error(`Unexpected status: ${response.status}`);
        } else {
          setMerchant(data);
          setMerchantVerified(true);
        }

        setMerchant(data);
        setMerchantVerified(true);

      } catch (err) {
        Sentry.captureException(err, {
          extra: {
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
            userId: userId ?? 'unkown userId'
          },
        });

        if (isError(err)) {
          Sentry.captureException(err);
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

    setShowNewSaleForm(true)

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
            discountType: newSaleFormData.customer?.currentDiscount?.type,
            discountAmount: newSaleFormData.customer?.currentDiscount?.amount,
            welcomeDiscount: welcomeDiscount,
            salesTax: newSaleFormData.tax,
            paymentType: newSaleFormData.paymentMethod,
            status: 'PENDING',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
        
          const apiError = new ApiError(
            `Saving the initial tx pending transaction during Square payment on iPhone - ${response.statusText} - ${data.message || 'Unknown Error'}`,
            response.status,
            data
          );
          Sentry.captureException(apiError, {
            tags: {
              paymentMethod: newSaleFormData?.paymentMethod ?? 'unknown',
            },
            extra: {
              responseStatus: response?.status ?? 'unknown',
              responseMessage: data?.message || 'Unknown Error',
              product: newSaleFormData?.product ?? 'unknown product',
              price: newSaleFormData?.price ?? 'unknown price',
              merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
              buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
            },
          });
          console.error(error);
        } else {
          goghTransactionId = data.transaction._id
          console.log('Transaction from POS saved successfully:', data);
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            paymentMethod: newSaleFormData?.paymentMethod,
          },
          extra: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            product: newSaleFormData?.product ?? 'unknown product',
            price: newSaleFormData?.price ?? 'unknown price',
            merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
            buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
          },
        });
      }

      let storedSaleDataCookieName;

      try {
        const response = await setSaleDataCookie(newSaleFormData);
    
        if (response.success) {
          storedSaleDataCookieName = response.cookieName
          console.log("Cookie set with name:", response.cookieName);
        } else {
          console.error("Failed to set the cookie.");
        }
      } catch (error) {
        Sentry.captureException(error);
        console.error("An error occurred:", error);
      }
      


      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/ios`;
      const state = {
        cookieName: storedSaleDataCookieName,
        goghTransactionId: goghTransactionId,
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
          customer_id: newSaleFormData?.customer?.userInfo.squareCustomerId,
          state: JSON.stringify(state),
          options: {
            supported_tender_types: ["CREDIT_CARD", "CARD_ON_FILE", "CASH"],
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

      window.location.replace(url);

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
            discountType: newSaleFormData.customer?.currentDiscount?.type,
            discountAmount: newSaleFormData.customer?.currentDiscount?.amount,
            welcomeDiscount: welcomeDiscount,
            salesTax: newSaleFormData.tax,
            paymentType: newSaleFormData.paymentMethod,
            status: 'PENDING',
          }),
        });
  
        const data = await response.json();
    
        if (!response.ok) {
        
          const apiError = new ApiError(
            `Saving the initial tx pending transaction during Square payment on Android - ${response.statusText} - ${data.message || 'Unknown Error'}`,
            response.status,
            data
          );
          Sentry.captureException(apiError, {
            tags: {
              paymentMethod: newSaleFormData?.paymentMethod ?? 'unknown',
            },
            extra: {
              responseStatus: response?.status ?? 'unknown',
              responseMessage: data?.message || 'Unknown Error',
              product: newSaleFormData?.product ?? 'unknown product',
              price: newSaleFormData?.price ?? 'unknown price',
              merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
              buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
            },
          });
          console.error(error);
        } else {
          goghTransactionId = data.transaction._id
          console.log('Transaction from POS saved successfully:', data);
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            paymentMethod: newSaleFormData?.paymentMethod,
          },
          extra: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            product: newSaleFormData?.product ?? 'unknown product',
            price: newSaleFormData?.price ?? 'unknown price',
            merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
            buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
          },
        });
      }

      let storedSaleDataCookieName;

      try {
        // Call the server action and get the response
        const response = await setSaleDataCookie(newSaleFormData);
    
        if (response.success) {
          storedSaleDataCookieName = response.cookieName
          console.log("Cookie set with name:", response.cookieName);
        } else {
          console.error("Failed to set the cookie.");
        }
      } catch (error) {
        Sentry.captureException(error);
        console.error("An error occurred:", error);
      }

      //const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/android?merchantId=${merchantId}&goghTransactionId=${goghTransactionId}`;
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/square/payment/pos/callback/android`;
      const sdkVersion = "v1.3";
      const currencyCode = "USD";
      const customerId = newSaleFormData?.customer?.userInfo.squareCustomerId;
      const tenderTypes = [
        "com.squareup.pos.TENDER_CARD",
        "com.squareup.pos.TENDER_CARD_ON_FILE",
        "com.squareup.pos.TENDER_CASH",
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
        `S.com.squareup.pos.REQUEST_METADATA={"cookieName":"${storedSaleDataCookieName}","goghTransactionId":"${goghTransactionId}"};` +
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
          "end;";
      }
        console.log('url:', posUrl)

        window.location.replace(posUrl);
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
      localStorage.removeItem('newSaleFormData');

    } else if (method === 'Zelle') {
      setShowZelleDialog(true);
      localStorage.removeItem('newSaleFormData');

    } else if (method === 'Cash') {
      setShowCashDialog(true);
      localStorage.removeItem('newSaleFormData');

    } else if (method === 'Square') {
      setShowSquareDialog(true);

      localStorage.setItem('newSaleFormData', JSON.stringify(newSaleForm));
      router.replace('/sell?status=square');
    }
  };

  useEffect(() => {
    const storedData = localStorage.getItem('newSaleFormData');
    
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      setNewSaleFormData(parsedData);
    }
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
    let priceAfterDiscountAmount = priceNum;

    let finalPriceCalculation = priceNum;

    if (newSaleFormData.sellerMerchant?.rewards?.welcome_reward && newSaleFormData.customer?.purchaseCount === 1) {
      welcomeDiscountAmount = newSaleFormData.sellerMerchant?.rewards?.welcome_reward
    }

    if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount?.amount) {
      rewardsDiscountAmount = newSaleFormData.customer.currentDiscount?.amount
    }
    

    const totalDiscountAmount = Math.max(rewardsDiscountAmount, welcomeDiscountAmount);

    if (newSaleFormData.customer && newSaleFormData.customer?.currentDiscount?.type === 'percent') {
      if (totalDiscountAmount > 100) {
        priceAfterDiscountAmount = 0

      } else {
        priceAfterDiscountAmount = priceNum - ((totalDiscountAmount/100) * priceNum)
      }

    } else if (newSaleFormData.customer && newSaleFormData.customer.currentDiscount?.type === 'dollar') {
      priceAfterDiscountAmount = priceNum - totalDiscountAmount
      if (priceAfterDiscountAmount < 0) {
        priceAfterDiscountAmount = 0
      }
    }
    
    if (newSaleFormData.tax > 0) {
      finalPriceCalculation = priceAfterDiscountAmount + ((newSaleFormData.tax / 100) * priceAfterDiscountAmount);
    } else {
      finalPriceCalculation = priceAfterDiscountAmount
    }

    setRewardsDiscount(rewardsDiscountAmount);
    setWelcomeDiscount(welcomeDiscountAmount);
    setPriceAfterDiscount(priceAfterDiscountAmount.toFixed(2))
    setFinalPriceCalculated(true);
    setFinalPrice(finalPriceCalculation.toFixed(2));

  }, [newSaleFormData])
  
  const handleQrCodeGenerated = (url: string) => {
    setSignedUrl(url);
  };

  const handleResetMessages = () => {
    setRewardsUpdated(false);
    setErrorMessage(null);
    setSquarePosErrorMessage(null);
    setCustomerUpgraded(false);
  };

  const handleSavePaymentAndUpdateRewards = async (newSaleFormData: SaleFormData) => {
    const accessToken = await getAccessToken();
    console.log('newsaleformdata:', newSaleFormData);

    const priceNum = parseFloat(newSaleFormData.price);
    const calculatedSalesTax = parseFloat(((newSaleFormData.tax/100) * priceNum).toFixed(2));

    if (newSaleFormData.customer) {
      if (newSaleFormData.sellerMerchant && !newSaleFormData.customer.purchaseCount) {
        console.log('will send text here');
        //silentlySendTextMessage(newSaleFormData.customer, newSaleFormData.sellerMerchant)
      }
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
            priceAfterDiscount,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          setNewSaleFormData(null);
          setShowNewSaleForm(true);
          setErrorMessage('There was an error updating the customer rewards. We have received the error and are looking into it.');
    
          const apiError = new ApiError(
            `Updating reward details after QR code or cash payment - ${response.statusText} - ${responseData.message || 'Unknown Error'}`,
            response.status,
            responseData
          );
          Sentry.captureException(apiError, {
            tags: {
              paymentMethod: newSaleFormData?.paymentMethod ?? 'unknown',
            },
            extra: {
              responseStatus: response?.status ?? 'unknown',
              responseMessage: responseData?.message || 'Unknown Error',
              privyId: user?.id ?? 'unknown privyId',
              purchaseData: newSaleFormData ?? 'unknown purchase data',
              finalPrice: finalPrice ?? 'unknown',
            },
          });
      
          console.error(apiError);
        } else {
          if (merchant) {
            fetchCheckedInCustomers(merchant._id)
          }
          setRewardsUpdated(true);
          setNewSaleFormData(null);
          setShowNewSaleForm(true);

          if (responseData.customerUpgraded) {
            setCustomerUpgraded(responseData.customerUpgraded)
          }

          console.log('Rewards updated successfully:', responseData);
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            paymentMethod: newSaleFormData?.paymentMethod,
          },
          extra: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            privyId: user?.id ?? 'unknown privyId',
            purchaseData: newSaleFormData ?? 'unknown purchase data',
            finalPrice: finalPrice ?? 'unknown',
          },
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
          discountType: newSaleFormData.customer?.currentDiscount?.type,
          discountAmount: newSaleFormData.customer?.currentDiscount?.amount,
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
          `Saving a transaction for QR code or cash payment - ${response.statusText} - ${data.message || 'Unknown Error'}`,
          response.status,
          data
        );

        Sentry.captureException(apiError, {
          tags: {
            paymentMethod: newSaleFormData?.paymentMethod ?? 'unknown',
          },
          extra: {
            responseStatus: response?.status ?? 'unknown',
            responseMessage: data?.message || 'Unknown Error',
            product: newSaleFormData?.product ?? 'unknown product',
            price: newSaleFormData?.price ?? 'unknown price',
            merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
            buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
          },
        });
    
        console.error(error);
      } else {
        setNewSaleFormData(null);
        setShowNewSaleForm(true);
        console.log('Transaction saved successfully:', data);
      }
    } catch (error) {
       Sentry.captureException(error, {
        tags: {
          paymentMethod: newSaleFormData?.paymentMethod,
        },
        extra: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: user?.id ?? 'unknown Privy Id',
          product: newSaleFormData?.product ?? 'unknown product',
          price: newSaleFormData?.price ?? 'unknown price',
          merchantId: newSaleFormData?.sellerMerchant?._id ?? 'unknown merchant',
          buyerId: newSaleFormData?.customer?.userInfo._id ?? 'unknown buyer'
        },
      });
    }
  };

  useEffect(() => {
    if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 5) {
      const timer = setTimeout(() => {
        router.push(`/onboard/step${merchant.onboardingStep || '1'}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [merchant, router]);

  const sendTextMessage = async (customer: RewardsCustomer, merchant: Merchant) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        Sentry.captureMessage("Failed to retrieve access token");
        return;
      }
  
      const params = new URLSearchParams();
      params.append("to", customer?.userInfo?.phone || "");
      if (merchant.rewards?.welcome_reward) {
        params.append(
          "body",
          `Welcome to Gogh Rewards! Enjoy a ${merchant.rewards?.welcome_reward}% discount on your next purchase from ${merchant.name}. View all rewards here: ${process.env.NEXT_PUBLIC_BASE_URL}/myrewards`
        );
      } else {
        params.append(
          "body",
          `Welcome to Gogh Rewards! You've enrolled in rewards from ${merchant.name}. View all rewards here: ${process.env.NEXT_PUBLIC_BASE_URL}/myrewards`
        );
      }
      params.append("privyId", `${currentUser?.privyId}`);
  
      await fetch("/api/comms/text", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error("Error occurred while sending text message:", error);
    }
  };
  
  const silentlySendTextMessage = (customer: RewardsCustomer, merchant: Merchant) => {
    (async () => {
      try {
        await sendTextMessage(customer, merchant);
      } catch (error) {
        // Log the error but ensure it fails silently
        console.error("Failed to send text message:", error);
      }
    })();
  };
  

  if (merchant && merchant.status === "onboarding" && (merchant.onboardingStep ?? 0) < 5) {
    return (
      <Flex
      direction={{ initial: "column", sm: "row" }}
      position="relative"
      minHeight="100vh"
      width="100%"
      style={{
        background: "linear-gradient(to bottom, #45484d 0%,#000000 100%)",
      }}
    >
      <Flex
        direction="row"
        justify="center"
        align="center"
        px="4"
        width={{ initial: "100%", sm: "30%" }}
        height={{ initial: "120px", sm: "100vh" }}
        style={{ textAlign: 'center' }}
      >
        <Heading size="8" align={"center"} style={{ color: "white" }}>
          Welcome to Gogh
        </Heading>
      </Flex>
      <Flex
        direction={"column"}
        justify={"center"}
        align={"center"}
        px={"4"}
        flexGrow={"1"}
        style={{
          background: "white",
        }}
      >
        {ready && authenticated ? (
          isFetchingMerchant ? (
            <Spinner />
          ) : merchant ? (
            <Flex direction={'column'} justify={{initial: 'start', sm: 'between'}} width={'100%'} flexGrow={'1'} py={'9'} gap={{initial: '9', sm:'0'}}>
              <Flex direction={'column'} justify={'center'} gap={'5'} width={{initial: '100%', sm: '500px'}} style={{ alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto'}}>
                <Text style={{marginTop: 'auto', marginBottom: 'auto'}}>Please complete the previous onboarding steps before proceeding.</Text>
                <Text>Redirecting...</Text>
              </Flex>
            </Flex>
          ) : (
            <Flex direction="column" align="center" gap={'4'}>
              <Heading>Welcome to Gogh!</Heading>
              <Text>
                To join the Gogh family of small businesses, please reach out. We
                would love to hear from you.
              </Text>
              <Button asChild>
                <Link
                  href="mailto:hello@ongogh.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact Us
                </Link>
              </Button>
            </Flex>
          )
        ) : ready && !authenticated ? (
          <Flex direction="column" align="center" gap={'4'}>
              <Heading>Welcome to Gogh!</Heading>
              <Text>
                To continue, please log in.
              </Text>
              <Button asChild>
                <Link href="/">Log in</Link>
              </Button>
            </Flex>
        ) : <Spinner /> }
      </Flex>
    </Flex>
  )
}

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
                        {newSaleFormData.sellerMerchant?.paymentMethods?.venmoQrCodeImage ? (
                          <>
                          {newSaleFormData && finalPriceCalculated && finalPrice && (
                            <Flex direction={'column'} justify={'center'}>
                              <Text size={'9'} align={'center'}>${finalPrice}</Text>
                              <Flex direction={'row'} width={'300px'} justify={'between'}>
                                <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                                <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                              </Flex>

                              {rewardsDiscount > 0 && rewardsDiscount >= welcomeDiscount && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer?.currentDiscount?.amount}%</Strong></Text>
                                  ) : (
                                    newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer?.currentDiscount?.amount}</Strong></Text>
                                    )
                                  )}
                                </Flex>
                              )}

                              {welcomeDiscount > 0 && welcomeDiscount > rewardsDiscount && (
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                  {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                    <Text size={'5'} align={'left'}><Strong>{welcomeDiscount}%</Strong></Text>
                                  ) : (
                                  newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                    <Text size={'5'} align={'left'}><Strong>${welcomeDiscount}</Strong></Text>
                                  )
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
                     
                       
                        <Flex direction={'row'} width={'100%'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
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
                              loading={!priceAfterDiscount}
                              onClick={() => {
                                handleSavePaymentAndUpdateRewards(newSaleFormData);
                                setShowVenmoDialog(false);
                              }}>
                              Confirm
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </>
                  ) : (
                    <>
                    <Flex direction={'column'} width={'100%'} gap={'6'}>
                      <Callout.Root color='red'>
                        <Callout.Text size={'6'}>
                          Venmo has not been configured. Please add your QR code in {" "}<Link href='/account/integrations'><Strong>settings</Strong></Link>
                        </Callout.Text>
                      </Callout.Root>
                      <Button size={'4'} variant='ghost'
                         onClick={() => {setShowVenmoDialog(false), setShowNewSaleForm(true)}}>
                        <Text size={'6'}>
                         Close
                        </Text>
                      </Button>
                    </Flex>
                    </>
                  )}
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>
            )} 
                {newSaleFormData && selectedPaymentMethod === 'Zelle' && (
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
                        {newSaleFormData.sellerMerchant?.paymentMethods?.zelleQrCodeImage ? (
                          <>
                            {newSaleFormData && finalPriceCalculated && (
                              <Flex direction={'column'} justify={'center'}>
                                <Text size={'9'} align={'center'}>${finalPrice}</Text>
                                <Flex direction={'row'} width={'300px'} justify={'between'}>
                                  <Text size={'5'} mt={'5'} align={'left'}>Price:</Text>
                                  <Text size={'5'} mt={'5'} align={'left'}><Strong>${parseFloat(newSaleFormData.price).toFixed(2)}</Strong></Text>
                                </Flex>

                                {rewardsDiscount > 0 && rewardsDiscount >= welcomeDiscount && (
                                  <Flex direction={'row'} width={'300px'} justify={'between'}>
                                    <Text size={'5'} align={'left'}>Rewards discount:</Text>
                                    {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                      <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer?.currentDiscount?.amount}%</Strong></Text>
                                    ) : (
                                      newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                        <Text size={'5'} align={'left'}>
                                          <Strong>${newSaleFormData.customer?.currentDiscount?.amount}</Strong>
                                        </Text>
                                      )
                                    )}
                                  </Flex>
                                )}

                                {welcomeDiscount > 0 && welcomeDiscount > rewardsDiscount && (
                                  <Flex direction={'row'} width={'300px'} justify={'between'}>
                                    <Text size={'5'} align={'left'}>Welcome discount:</Text>
                                    {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                      <Text size={'5'} align={'left'}>
                                        <Strong>{welcomeDiscount}%</Strong>
                                      </Text>
                                    ) : (
                                      newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                        <Text size={'5'} align={'left'}>
                                          <Strong>${welcomeDiscount}</Strong>
                                        </Text>
                                      )
                                    )}
                                  </Flex>
                                )}
                            
                                {newSaleFormData.tax > 0 && (
                                  <Flex direction={'row'} width={'300px'} justify={'between'}>
                                    <Text size={'5'} align={'left'}>Sales tax:</Text>
                                    <Text size={'5'} align={'left'}>
                                      <Strong>{newSaleFormData.tax}%</Strong>
                                    </Text>
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

                              <Flex direction={'row'} width={'100%'} gap="3" mt="4" justify={'between'} align={'center'} pt={'4'}>
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
                            </>
                          ) : (
                          <>
                            <Flex direction={'column'} width={'100%'} gap={'6'}>
                              <Callout.Root color='red'>
                                <Callout.Text size={'6'}>
                                  Zelle has not been configured. Please add your QR code in {" "}
                                  <Link href='/account/integrations'>
                                    <Strong>settings</Strong>
                                  </Link>
                                </Callout.Text>
                              </Callout.Root>
                              <Button size={'4'} variant='ghost'
                                onClick={() => {setShowZelleDialog(false), setShowNewSaleForm(true)}}>
                                <Text size={'6'}>
                                  Close
                                </Text>
                              </Button>
                            </Flex>
                          </>
                        )}
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
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
                          {rewardsDiscount > 0 && rewardsDiscount >= welcomeDiscount && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData.customer?.currentDiscount?.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData.customer?.currentDiscount?.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && welcomeDiscount > rewardsDiscount && (
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
                          {rewardsDiscount > 0 && rewardsDiscount >= welcomeDiscount && (
                            <Flex direction={'row'} width={'300px'} justify={'between'}>
                              <Text size={'5'} align={'left'}>Rewards discount:</Text>
                              {newSaleFormData.customer?.currentDiscount.type === 'percent' ? (
                                <Text size={'5'} align={'left'}><Strong>{newSaleFormData?.customer?.currentDiscount?.amount}%</Strong></Text>
                              ) : newSaleFormData.customer?.currentDiscount.type === 'dollar' && (
                                <Text size={'5'} align={'left'}><Strong>${newSaleFormData?.customer?.currentDiscount?.amount}</Strong></Text>
                              )}
                            </Flex>
                          )}

                          {welcomeDiscount > 0 && welcomeDiscount > rewardsDiscount && (
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

                  {customerUpgraded && (
                    <Callout.Root color='green' mx={'4'}>
                      <Callout.Icon>
                        <RocketIcon height={'25'} width={'25'} />
                      </Callout.Icon>
                      <Callout.Text size={'4'}>
                        Nice! Your customer has upgraded to the next rewards tier.
                      </Callout.Text>
                    </Callout.Root>
                  )}
              
                  {rewardsUpdated && (
                    <Callout.Root mx={'4'}>
                    <Callout.Icon>
                      <InfoCircledIcon />
                    </Callout.Icon>
                    <Callout.Text size={'4'}>
                      Customer rewards have been updated.
                    </Callout.Text>
                  </Callout.Root>
                  )}

                  {errorMessage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'4'}  wrap={'wrap'} style={{ wordBreak: 'break-word' }}>
                        {errorMessage}
                      </Callout.Text>
                    </Callout.Root>
                  )}

                  {squarePosErrorMessage && (
                    <Callout.Root color='red' mx={'4'}>
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text size={'4'} wrap={'wrap'} style={{ wordBreak: 'break-word' }}>
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