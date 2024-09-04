"use client";

import React, { useEffect, useRef, useState } from 'react';
import { generateQrCode } from "./generateQrCodeUrl";
import Spinner from '../../components/Spinner';
import { usePrivy } from '@privy-io/react-auth';
import { Box, Button, Card, Checkbox, Container, Dialog, Flex, Grid, IconButton, Inset, Link, Section, Select, Text, TextField } from '@radix-ui/themes';
import styles from '../styles.module.css'
import { Merchant, Tax, RewardsCustomer, PaymentMethod, PaymentType } from '@/app/types/types';
import { Cross1Icon, Cross2Icon, PersonIcon } from '@radix-ui/react-icons';

interface NewSaleFormProps {
  onQrCodeGenerated: (signedUrl: string) => void;
  onMessageUpdate: (msg: string) => void;
  userId: string;
  merchantFromParent: Merchant;
  customers: RewardsCustomer[];
  paymentMethods: PaymentType[];
}

interface FormData {
  product: string;
  price: string;
  tax: number;
  merchant: string;
  customer: RewardsCustomer | null;
  sellerMerchant: Merchant | null;
}

export function NewSaleForm({ onQrCodeGenerated, onMessageUpdate, userId, merchantFromParent, customers, paymentMethods }: NewSaleFormProps) {
  const [formData, setFormData] = useState<FormData>({
    product: "",
    price: "",
    tax: 0,
    merchant: "",
    customer: null,
    sellerMerchant: merchantFromParent,
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

  const paymentTypeLogos: Record<PaymentType, string> = {
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
    console.log("seller merchant1:", sellerMerchant);
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
      setFormData(prevState => ({ ...prevState, [name]: cleanedValue }));
    } else {
      setFormData(prevState => ({ ...prevState, [name]: value }));
    }
  };

  const handleFocus = () => {
    if (priceInputRef.current) {
      const length = formData.price.length;
      priceInputRef.current.setSelectionRange(0, length);
    }
  };

  const handleSelectChange = (value: string) => {
    const selectedMerchant = merchantsList.find(merchant => merchant._id === value) || null;
    setSellerMerchant(selectedMerchant);
    setFormData(prevState => ({ ...prevState, merchant: value, sellerMerchant: selectedMerchant  }));
  };

  const handleCustomerCardClick = (customer: RewardsCustomer) => {
    setFormData(prevState => ({ ...prevState, customer }));
    setCurrentCustomer(customer);
    setIsCustomerDialogOpen(false);
  };

  const handlePaymentCardClick = async (paymentMethod: PaymentType) => {
    try {
      switch (paymentMethod) {
        case PaymentType.Venmo:
          handleVenmoPayment();
          break;
        case PaymentType.Zelle:
          handleZellePayment();
          break;
        case PaymentType.Cash:
          await handleCashPayment(formData);
          break;
        case PaymentType.ManualEntry:
          await initiateCreditCardPayment(formData);
          break;
        case PaymentType.Square:
          await handleSquarePayment(formData);
          break;
        default:
          console.warn('Unknown payment method:', paymentMethod);
          break;
      }
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setIsPaymentsDialogOpen(false);
    }
  };
  
  // for Zelle and Venmo
  const handleVenmoPayment = () => {
    const venmoQrCode = sellerMerchant?.paymentMethods.venmoQrCodeImage;
    if (venmoQrCode) {
      displayQRCode(venmoQrCode);
    } else {
      console.error('No Venmo QR code available.');
    }
  };

  const handleZellePayment = () => {
    const zelleQrCode = sellerMerchant?.paymentMethods.zelleQrCodeImage;
    if (zelleQrCode) {
      displayQRCode(zelleQrCode);
    } else {
      console.error('No Zelle QR code available.');
    }
  };
  
  const handleCashPayment = async (formData: FormData) => {
    console.log('Handling cash payment with form data:', formData);
  };

  const initiateCreditCardPayment = async (formData: FormData) => {
    console.log('Processing credit card payment with form data:', formData);
  };

  const handleSquarePayment = async (formData: FormData) => {
    console.log('Handling Square payment with form data:', formData);
  };

  const displayQRCode = (qrCodeUrl: string) => {
    window.open(qrCodeUrl, '_blank');
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
    const formattedPrice = validateAndFormatPrice(formData.price);
    if (!formattedPrice) {
      setIsLoading(false);
      setErrorMessage("Invalid price format. Please enter a valid number with up to two decimals.");
      return;
    }

    if (!formData.product) {
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
    setFormData(prevState => ({ ...prevState, tax: taxRate, sellerMerchant }));

    // All validations passed; open the payments dialog
    setIsPaymentsDialogOpen(true);
    setIsLoading(false);
  };

  /*
  const generateQrCodeFunction = async () => {
    if (!formData || !sellerMerchant) return;
    try {
      const result = await generateQrCode({ message: "" }, userId, sellerMerchant, formData);
      if (result.signedURL) {
        onQrCodeGenerated(result.signedURL);
      }
      onMessageUpdate("Scan me to pay");
    } catch (error) {
      onMessageUpdate("Failed to generate QR Code");
    }
  };
  */

  return (
    <Flex direction={'column'} align={'center'} justify={'between'} height={'100%'} width={'80%'}>
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
                {currentCustomer.userInfo.email}
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
                <Flex direction={'column'} align={'end'} mb={'5'}>
                  <Cross1Icon height={'25px'} width={'25px'} onClick={() => setIsCustomerDialogOpen(false)}/>
                </Flex>
                <Dialog.Title mb={'5'}>Recently checked in</Dialog.Title>
                {currentCustomer && (
                  <Flex direction={'column'} align={'center'}>
                    <Button size={'4'} variant='ghost' color='red' mb={'7'} 
                      onClick={() => {
                        setCurrentCustomer(null);
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
                      variant="surface"
                      onClick={() => handleCustomerCardClick(customer)}
                      style={{ cursor: 'pointer', padding: '1.5rem' }}
                    >
                      {customer.userInfo.name && (
                        <Text as="div" size={'5'} weight="bold">
                          {customer.userInfo.name}
                        </Text>
                      )}
                      <Text as="div" color="gray" size="5">
                        {customer.userInfo.email}
                      </Text>
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
              value={formData.product}
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
              value={formData.price}
              onChange={handleChange}
              onFocus={handleFocus}
              required
            >
                <TextField.Slot>
                <Text size={'4'} weight={'bold'}>$</Text>
                </TextField.Slot>
            </TextField.Root>
          {defaultTax && (
            <>
            <Flex direction={'row'} gap={'4'}>
              <label htmlFor="price" className={styles.formLabel}>Sales tax</label>
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
          )}
        </Flex>
          
        <Flex direction={'column'} justify={'center'}>
          <Dialog.Root open={isPaymentsDialogOpen} onOpenChange={setIsPaymentsDialogOpen}>
          <Button
            variant='surface'
            size={'4'}
            style={{ width: '100%', marginBottom: '20px' }}
            type='submit'
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
                        onClick={() => handlePaymentCardClick(paymentMethod)}
                        style={{ cursor: 'pointer', padding: '1.5rem', alignContent: 'center' }}
                      >
                        <Inset clip="border-box">
                          <img
                            src={paymentTypeLogos[paymentMethod]}
                            alt={paymentMethod}
                            style={{
                              display: 'block',
                              objectFit: 'contain',
                              width: '100%',
                              height: '150px',
                              justifySelf: 'center'
                            }}
                          />
                        </Inset>
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
    </Flex>
  );
}
