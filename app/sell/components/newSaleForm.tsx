"use client";

import React, { useState } from 'react';
import { generateQrCode } from "./generateQrCodeUrl";
import Spinner from '../../components/Spinner';
import { usePrivy } from '@privy-io/react-auth';
import { Box, Button, Card, Container, Flex, Section, Text, TextField } from '@radix-ui/themes';
import styles from '../styles.module.css'

interface NewSaleFormProps {
  onQrCodeGenerated: (signedUrl: string) => void;
  onMessageUpdate: (msg: string) => void;
  userId: string;
}

export function NewSaleForm({ onQrCodeGenerated, onMessageUpdate, userId }: NewSaleFormProps) {
  const [formData, setFormData] = useState({ product: "", price: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMEssage] = useState<String>("");
  const { user } =usePrivy();

  if(!user) {
    console.error("Unauthorized");
    return <p>Unauthorized - Please log in</p>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
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
    setErrorMEssage("")

    // Validate and format the price
    const formattedPrice = validateAndFormatPrice(formData.price);
    if (!formattedPrice) {
      setIsLoading(false);
      setErrorMEssage("Invalid price format. Please enter a valid number with up to two decimals.");
      return;
    }
    
    const form = new FormData();
    form.append("product", formData.product);
    form.append("price", formattedPrice);
    // Append other necessary data, e.g., userId
    
    try {
      const result = await generateQrCode({ message: "" }, userId, form);
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

  return (
    
    <Flex direction={'column'} align={'center'} justify={'center'} minWidth={'70%'} mx={'2'}>
      <form onSubmit={handleSubmit} className={styles.formGroup}>
        <Flex direction={'column'} minWidth={'100%'}>
        <Card variant="classic">
          <Box p={'5'}>
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
        <Flex direction={'row'} flexGrow={'1'}>
        <Text mr={'2'} ml={'-4'} size={'6'}>$</Text>
        <TextField.Root
          mb={'5'}
          mt={'1'}
          style={{width:'100%'}}
          type="text"
          size={'2'}
          name="price"
          value={formData.price}
          onChange={handleChange}
          required
        />
        </Flex>
        <Flex direction={'column'}>
        <Button mb={'3'} type="submit" loading={isLoading}>
          Create QR Code
        </Button>
        <Text>{errorMessage}</Text>
        </Flex>
        </Box>
        </Card>
        </Flex>
      </form>
    </Flex>
    
    
  );
}
