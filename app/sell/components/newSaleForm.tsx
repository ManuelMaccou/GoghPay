"use client";

import React, { useEffect, useRef, useState } from 'react';
import { generateQrCode } from "./generateQrCodeUrl";
import Spinner from '../../components/Spinner';
import { usePrivy } from '@privy-io/react-auth';
import { Box, Button, Card, Checkbox, Container, Flex, Link, Section, Select, Text, TextField } from '@radix-ui/themes';
import styles from '../styles.module.css'
import { Merchant, Tax } from '@/app/types/types';

interface NewSaleFormProps {
  onQrCodeGenerated: (signedUrl: string) => void;
  onMessageUpdate: (msg: string) => void;
  userId: string;
  merchantFromParent: Merchant;
}

export function NewSaleForm({ onQrCodeGenerated, onMessageUpdate, userId, merchantFromParent }: NewSaleFormProps) {
  const [formData, setFormData] = useState({ product: "", price: "", tax: 0, merchant: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<String>("");
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [ merchantsList, setMerchantsList] = useState<Merchant[]>([]);
  const [ sellerMerchant, setSellerMerchant ] = useState<Merchant | null>(null);
  const [ defaultTax, setDefaultTax ] = useState<Tax | null>(null);
  const [isTaxChecked, setIsTaxChecked] = useState(true);

  useEffect(() => {
    async function fetchAllMerchants() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/merchant/all');
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
  }, [merchantFromParent])

  useEffect(() => {
    if (priceInputRef.current) {
      priceInputRef.current.setSelectionRange(1, 1);
    }
  }, []);

  useEffect(() => {
    const selectedTax = sellerMerchant?.taxes.find(tax => tax.default) || sellerMerchant?.taxes[0];
    if (selectedTax) {
      setDefaultTax(selectedTax)
    }
  }, [sellerMerchant])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'price') {
      // Remove any non-numeric characters except dot
      const cleanedValue = value.replace(/[^0-9.]/g, '');
      setFormData(prevState => ({ ...prevState, [name]: `$${cleanedValue}` }));
    } else {
      setFormData(prevState => ({ ...prevState, [name]: value }));
    }
  };

  const handleFocus = () => {
    if (priceInputRef.current) {
      const length = formData.price.length;
      priceInputRef.current.setSelectionRange(1, length); // Set cursor position after $
    }
  };

  const handleSelectChange = (value: string) => {
    const selectedMerchant = merchantsList.find(merchant => merchant._id === value) || null;
    setSellerMerchant(selectedMerchant);
    console.log('seller merchant 2:', sellerMerchant);
    setFormData(prevState => ({ ...prevState, merchant: value }));
  };

  const validateAndFormatPrice = (price: string): string => {
    // Remove any dollar sign
    const cleanedPrice = price.replace(/\$/, '');
    // Validate and format the price
    const validPrice = cleanedPrice.match(/^\d+(\.\d{0,2})?$/);
    return validPrice ? validPrice[0] : '';
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

    const taxRate = isTaxChecked && defaultTax ? defaultTax.rate : 0;
    
    const form = new FormData();
    form.append("product", formData.product);
    form.append("price", formattedPrice);
    form.append("tax", taxRate.toString());
    
    try {
      if (!sellerMerchant) {
        throw new Error("Seller merchant is not selected.");
      }

      const result = await generateQrCode({ message: "" }, userId, sellerMerchant, form);
      if (result.signedURL) {
        onQrCodeGenerated(result.signedURL);
      }
      onMessageUpdate("Scan me to pay");
    } catch (error) {
      onMessageUpdate("Failed to generate QR Code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaxCheckboxChange = () => {
    setIsTaxChecked(!isTaxChecked);
  };


  return (
    <Flex flexGrow={'1'} direction={'column'} align={'center'} justify={'between'} minWidth={'70%'}>
      <form onSubmit={handleSubmit} className={styles.formGroup}>
          <Flex direction={'column'} justify={'center'}>
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
            <label htmlFor="product" className={styles.formLabel}>Product Name</label>
              <TextField.Root
                mb={'5'}
                mt={'1'}
                type="text"
                size={'2'}
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
                size={'2'}
                name="price"
                value={formData.price}
                onChange={handleChange}
                onFocus={handleFocus}
                required
              />
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
          <Flex direction={'column'}>
            <Button mb={'3'} type="submit" loading={isLoading}>
              Create QR Code
            </Button>
            <Text>{errorMessage}</Text>
          </Flex>
      </form>
    </Flex>
  );
}
