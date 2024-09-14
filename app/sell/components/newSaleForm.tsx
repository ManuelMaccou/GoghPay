"use client";

import React, { useEffect, useRef, useState } from 'react';
import { generateQrCode } from "./generateQrCodeUrl";
import Spinner from '../../components/Spinner';
import { usePrivy } from '@privy-io/react-auth';
import { Box, Button, Card, Checkbox, Container, Dialog, Flex, Grid, IconButton, Inset, Link, Section, Select, Text, TextField, VisuallyHidden } from '@radix-ui/themes';
import styles from '../styles.module.css'
import { Merchant, Tax, RewardsCustomer, PaymentMethod, PaymentType } from '@/app/types/types';
import { Cross1Icon, Cross2Icon, PersonIcon, UpdateIcon } from '@radix-ui/react-icons';
import Image from 'next/image';

interface NewSaleFormProps {
  onQrCodeGenerated: (signedUrl: string) => void;
  onMessageUpdate: (msg: string) => void;
  userId: string;
  merchantFromParent: Merchant;
  customers: RewardsCustomer[];
  paymentMethods: PaymentType[];
  onNewSaleFormSubmit: (formData: SaleFormData) => void;
  onStartNewSale: () => void;
  onCustomerRefresh: (merchantId: string) => void;
  formData: SaleFormData | null;
  checkoutStatus: string | null;
}

interface SaleFormData {
  product: string;
  price: string;
  tax: number;
  merchant: string;
  customer: RewardsCustomer | null;
  sellerMerchant: Merchant | null;
  paymentMethod: PaymentType;
}

export const NewSaleForm: React.FC<NewSaleFormProps> = ({
  onQrCodeGenerated,
  onMessageUpdate,
  userId,
  merchantFromParent,
  customers,
  paymentMethods,
  onNewSaleFormSubmit,
  onStartNewSale,
  onCustomerRefresh,
  formData,
  checkoutStatus,
}) => {
  const [localFormData, setlocalFormData] = useState<SaleFormData>({
    product: formData?.product || "",
    price: formData?.price || "",
    tax: formData?.tax || 0,
    merchant: formData?.merchant || "",
    customer: formData?.customer || null,
    sellerMerchant: formData?.sellerMerchant || merchantFromParent,
    paymentMethod: formData?.paymentMethod || PaymentType.None,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<String>("");
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [ merchantsList, setMerchantsList] = useState<Merchant[]>([]);
  const [ sellerMerchant, setSellerMerchant ] = useState<Merchant | null>(null);
  const [ defaultTax, setDefaultTax ] = useState<Tax | null>(null);
  const [ isTaxChecked, setIsTaxChecked ] = useState(true);
  const [ currentCustomer, setCurrentCustomer ] = useState<RewardsCustomer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isPaymentsDialogOpen, setIsPaymentsDialogOpen] = useState(false);
  const [isCheckingFormStatus, setIsCheckingFormStatus] = useState<boolean>(true);

  const {user} = usePrivy();

  const paymentTypeLogos: Record<PaymentType, string> = {
    [PaymentType.None]: '/paymentMethodLogos/venmo.png',
    [PaymentType.Venmo]: '/paymentMethodLogos/venmo.png',
    [PaymentType.Zelle]: '/paymentMethodLogos/zelle.png',
    [PaymentType.Square]: '/paymentMethodLogos/square.png',
    [PaymentType.ManualEntry]: '/paymentMethodLogos/manualentry.png',
    [PaymentType.Cash]: '/paymentMethodLogos/cash.png',
  };

  useEffect(() => {
    async function fetchAllMerchants() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/merchant/all', {
          next: {revalidate: 1}
        });
        if (!response.ok) {
          throw new Error(`Error fetching merchants: ${response.statusText}`);
        }
        const data: Merchant[] = await response.json();
        setMerchantsList(data);
      } catch (error: unknown) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('An unknown error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (merchantFromParent.admin) {
      fetchAllMerchants();
    } else {
      setSellerMerchant(merchantFromParent);
    }
  }, [merchantFromParent, sellerMerchant])

  useEffect(() => {
    if (priceInputRef.current) {
      priceInputRef.current.setSelectionRange(1, 1);
    }
  }, [priceInputRef]);

  useEffect(() => {
    const selectedTax = sellerMerchant?.taxes.find(tax => tax.default) || sellerMerchant?.taxes[0];
    setDefaultTax(selectedTax || null);
  }, [sellerMerchant])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'price') {
      // Remove any non-numeric characters except dot
      const cleanedValue = value.replace(/[^0-9.]/g, '');
      setlocalFormData(prevState => ({ ...prevState, [name]: cleanedValue }));
    } else {
      setlocalFormData(prevState => ({ ...prevState, [name]: value }));
    }
  };

  const handleFocus = () => {
    if (priceInputRef.current) {
      const length = localFormData.price.length;
      priceInputRef.current.setSelectionRange(0, length);
    }
  };

  const handleSelectChange = (value: string) => {
    const selectedMerchant = merchantsList.find(merchant => merchant._id === value) || null;
    setSellerMerchant(selectedMerchant);
    setlocalFormData(prevState => ({ ...prevState, merchant: value, sellerMerchant: selectedMerchant  }));
  };

  const handleSelectCustomer = (customer: RewardsCustomer | null) => {
    setlocalFormData(prevState => ({ ...prevState, customer }));
    setCurrentCustomer(customer);
    setIsCustomerDialogOpen(false);
  };

  useEffect(() => {
    setIsCheckingFormStatus(true);
    const storedData = sessionStorage.getItem('newSaleFormData');
    
    if (storedData) {
      const parsedData: SaleFormData = JSON.parse(storedData);
      if (parsedData.hasOwnProperty('tax') && parsedData.tax > 0) {
        setIsTaxChecked(true);
      } else if (parsedData.hasOwnProperty('tax') && parsedData.tax === 0) {
        setIsTaxChecked(false);
      }
      if (checkoutStatus === 'success' || !checkoutStatus) {
        setlocalFormData({
          product: "",
          price: "",
          tax: 0,
          merchant: "",
          customer: null,
          sellerMerchant: merchantFromParent,
          paymentMethod: PaymentType.None,
        })
        setCurrentCustomer(null)
      } else {
        setlocalFormData({
          product: formData?.product || "",
          price: formData?.price || "",
          tax: formData?.tax || 0,
          merchant: formData?.merchant || "",
          customer: formData?.customer || null,
          sellerMerchant: formData?.sellerMerchant || merchantFromParent,
          paymentMethod: formData?.paymentMethod || PaymentType.None,
        })
        setCurrentCustomer(parsedData.customer);
      }

    } else if (formData) {
      setlocalFormData(formData)
      if (formData.customer) {
        setCurrentCustomer(formData.customer)
      }
      setIsTaxChecked(formData.tax > 0);
    }
    setIsCheckingFormStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, checkoutStatus, merchantFromParent]);

  const handleSelectPaymentMethod = (paymentMethod: PaymentType) => {
    const updatedFormData = { ...localFormData, paymentMethod };
    setlocalFormData(updatedFormData);
    console.log('Updated form data:', updatedFormData)
    
    onNewSaleFormSubmit(updatedFormData);
  };

  const handleResetParentMessages = () => {
    onStartNewSale();
  };

  const handleCustomerRefresh = () => {
    if (merchantFromParent && merchantFromParent._id) {
      onCustomerRefresh(merchantFromParent._id);
    }
  };

  const validateAndFormatPrice = (price: string): string => {
    const cleanedPrice = price.replace(/\$/, '');
    const validPrice = cleanedPrice.match(/^\d+(\.\d{0,2})?$/);
    return validPrice ? validPrice[0] : '';
  };

  const handleTaxCheckboxChange = () => {
    setIsTaxChecked(!isTaxChecked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onMessageUpdate("");
    setErrorMessage("")

    // Validate and format the price
    const formattedPrice = validateAndFormatPrice(localFormData.price);
    if (!formattedPrice) {
      setIsLoading(false);
      setErrorMessage("Invalid price format. Please enter a valid number with up to two decimals.");
      return;
    }

    if (!localFormData.product) {
      setIsLoading(false);
      setErrorMessage("Product name is required.");
      return;
    }

    if (!sellerMerchant) {
      setErrorMessage("There was problem loading seller details. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

    const taxRate = isTaxChecked && defaultTax ? defaultTax.rate : 0;
    setlocalFormData(prevState => ({ ...prevState, tax: taxRate, sellerMerchant }));

    // All validations passed; open the payments dialog
    setIsPaymentsDialogOpen(true);
    setIsLoading(false);
  };

  /*
  const generateQrCodeFunction = async () => {
    if (!localFormData || !sellerMerchant) return;
    try {
      const result = await generateQrCode({ message: "" }, userId, sellerMerchant, localFormData);
      if (result.signedURL) {
        onQrCodeGenerated(result.signedURL);
        onMessageUpdate("Scan me to pay");
      }
    } catch (error) {
      onMessageUpdate("Failed to generate QR Code");
    }
  };
  */

  return (

    <Flex direction={'column'} align={'center'} justify={'between'} height={'100%'} width={'80%'}>
      {!isCheckingFormStatus && (
        <form onSubmit={handleSubmit} className={styles.formGroup}>
          <Flex direction={'column'} justify={'center'} height={'100%'}>
            {merchantFromParent.admin && (
              <>
                <label htmlFor="merchant" className={styles.formLabel}>Select Merchant</label>
                <Select.Root onValueChange={handleSelectChange}>
                  <Select.Trigger variant="surface" placeholder="Select a merchant" mb={'5'} mt={'1'} />
                  <Select.Content>
                    <Select.Group>
                        {merchantsList.map(merchant => (
                          <Select.Item key={merchant._id} value={merchant._id}>
                            {merchant.name}
                          </Select.Item>
                        ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </>
            )}
            <Dialog.Root open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
              <Dialog.Trigger style={{marginBottom: '20px'}}>
              {currentCustomer ? (
                <Button variant='surface' size={'4'} style={{width: "100%"}}>
                  <PersonIcon height={'25px'} width={'25px'} /> 
                  {user?.google?.name? user.google.name : currentCustomer.userInfo.email}
                </Button>
              ) : (
                <Button variant='surface' size={'4'}>
                  <PersonIcon height={'25px'} width={'25px'} /> 
                  Select customer
                </Button>
              )}
              </Dialog.Trigger>
              
              <Dialog.Content
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '85vh',
                    borderRadius: '20px 20px 0 0',
                    padding: '1rem',
                    backgroundColor: 'white',
                    overflowY: 'auto',
                  }}
                >
                  <Flex direction={'column'} align={'end'} mb={'7'}>
                    <Cross1Icon height={'25px'} width={'25px'} onClick={() => setIsCustomerDialogOpen(false)}/>
                  </Flex>
                    <VisuallyHidden>
                      <Dialog.Title>Recently checked in</Dialog.Title>
                    </VisuallyHidden>
                    <Flex direction={'row'} justify={'between'} align={'center'} width={'85%'} mb={'7'}>
                    <Text size={'5'} weight={'bold'}>Recently checked in</Text>
                      <IconButton variant='ghost' onClick={handleCustomerRefresh}>
                        <UpdateIcon height={'30'} width={'30'} />
                      </IconButton>
                  </Flex>
                  <VisuallyHidden>
                    <Dialog.Description>
                      Recently checked in custoemrs
                    </Dialog.Description>
                  </VisuallyHidden>
                  {currentCustomer && (
                    <Flex direction={'column'} align={'center'}>
                      <Button size={'4'} variant='ghost' color='red' mb={'7'} 
                        onClick={() => {
                          handleSelectCustomer(null);
                          setIsCustomerDialogOpen(false)
                        }}>
                          <Text size={'6'}>
                            Remove customer
                          </Text>
                      </Button>
                    </Flex>
                    
                  )}
                  {customers.length > 0 ? (
                    customers.map((customer: RewardsCustomer) => (
                      
                      <Card
                        key={customer.userInfo._id}
                        mb={'5'}
                        variant="surface"
                        onClick={() => handleSelectCustomer(customer)}
                        style={{ cursor: 'pointer', padding: '1.5rem' }}
                      >
                        <Flex direction={'column'}>
                          {user?.google && user?.google.name && (
                            <Text size={'5'} weight="bold">
                              {user.google.name}
                            </Text>
                          )}
                          <Text color="gray" size="5">
                            {customer.userInfo.email}
                          </Text>
                        </Flex>
                        
                      </Card>
                    ))
                  ) : (
                    <Text as="div" size="2" color="gray">
                      No customers available.
                    </Text>
                  )}
                </Dialog.Content>
            </Dialog.Root>

            <label htmlFor="product" className={styles.formLabel}>Product Name</label>
              <TextField.Root
                mb={'5'}
                mt={'1'}
                type="text"
                size={'3'}
                name="product"
                value={localFormData.product}
                onChange={handleChange}
                required
              />
            <label htmlFor="price" className={styles.formLabel}>Price</label>
              <TextField.Root
                mb={'5'}
                mt={'1'}
                ref={priceInputRef}
                type="text"
                size={'3'}
                name="price"
                value={localFormData.price}
                onChange={handleChange}
                onFocus={handleFocus}
                required
              >
                  <TextField.Slot>
                  <Text size={'4'} weight={'bold'}>$</Text>
                  </TextField.Slot>
              </TextField.Root>
            {defaultTax ? (
              <>
              <Flex direction={'row'} gap={'4'}>
                <label htmlFor="tax" className={styles.formLabel}>Sales tax</label>
                <Link href='/account/taxes'>Edit</Link>
              </Flex>
              
                <Flex width={'100%'} justify={'between'} mb={'6'}>
                  <Text weight={'bold'} as="label" size="4">
                  {defaultTax.name}
                  </Text>
                  <Flex>
                    <Text size={'4'}>
                    {defaultTax.rate}%
                      <Checkbox 
                        checked={isTaxChecked}
                        onCheckedChange={handleTaxCheckboxChange} 
                        ml={'4'} 
                        size={'3'}
                      />
                    </Text>
                  </Flex>
              </Flex>

              </>
            ) : (
              <Flex direction={'column'} align={'end'}>
                <Link mb={'7'} href='/account/taxes'>Add sales tax</Link>
              </Flex>
              
            )}
          </Flex>
            
          <Flex direction={'column'} justify={'center'}>
            <Dialog.Root open={isPaymentsDialogOpen} onOpenChange={setIsPaymentsDialogOpen}>
            <Button
              variant='surface'
              size={'4'}
              style={{ width: '100%', marginBottom: '20px' }}
              type='submit'
              onClick={handleResetParentMessages}
            >
              Checkout
            </Button>
            
              
              <Dialog.Content
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '85vh',
                    borderRadius: '20px 20px 0 0',
                    padding: '1rem',
                    backgroundColor: 'white',
                    overflowY: 'auto',
                  }}
                >
                  <Flex direction={'column'} align={'end'} mb={'5'}>
                    <Cross1Icon height={'25px'} width={'25px'} onClick={() => setIsPaymentsDialogOpen(false)}/>
                  </Flex>
                  <Dialog.Title mb={'5'}>Select payment method</Dialog.Title>
                  <VisuallyHidden><Dialog.Description>Select payment method</Dialog.Description></VisuallyHidden>
                  {paymentMethods.length > 0 ? (
                    <Grid
                      columns={{ initial: '2', xs: '2' }} // Responsive grid columns
                      gap="4"
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      {paymentMethods.map((paymentMethod: PaymentType) => (
                        <Card
                          key={paymentMethod}
                          variant="surface"
                          onClick={() => handleSelectPaymentMethod(paymentMethod)}
                          style={{ cursor: 'pointer', padding: '1.5rem', alignContent: 'center', height: '150px', position: 'relative' }}
                        >
                          <Image
                            src={paymentTypeLogos[paymentMethod]}
                            alt={paymentMethod}
                            fill
                            sizes='300px'
                            style={{
                              display: 'block',
                              objectFit: 'contain',
                              padding: '20px',
                              justifySelf: 'center'
                            }}
                          />
                        </Card>
                      ))}
                    </Grid>
                  ) : (
                    <Text as="div" size="2" color="gray">
                      Payment methods not configured
                    </Text>
                  )}
                </Dialog.Content>
            </Dialog.Root>


            <Flex direction={'column'}>
              <Text>{errorMessage}</Text>
            </Flex>
          </Flex>
        </form>
        
      )}
    </Flex>
  );
};
