"use client";

import React, { useEffect, useRef, useState } from 'react';
import styles from '../styles.module.css';
import { Button, Flex, Text, TextField } from '@radix-ui/themes';

interface NewTaxFormProps {
  onMessageUpdate: (msg: string) => void;
  onAddTax: (newTax: { name: string, rate: string }) => Promise<void>;
  onCancel: () => void;
}

export function NewTaxForm({ onMessageUpdate, onAddTax, onCancel }: NewTaxFormProps) { 
  const [formData, setFormData] = useState({ name: "", rate: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const validateAndFormatRate = (rate: string): string => { 
    // Validate and format the rate to allow a number with up to 1 decimal place
    const validRate = rate.match(/^\d+(\.\d{0,1})?$/);
    return validRate ? validRate[0] : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onMessageUpdate("");
    setErrorMessage("");

    // Validate and format the rate
    const formattedRate = validateAndFormatRate(formData.rate);
    if (!formattedRate) {
      setIsLoading(false);
      setErrorMessage("Invalid rate format. Please enter a valid percentage with up to 1 decimal place.");
      return;
    }
    
    try {
      await onAddTax({ name: formData.name, rate: formattedRate });
      setFormData({ name: "", rate: "" });
    } catch (error) {
      setErrorMessage("Failed to add tax. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex flexGrow={'1'} direction={'column'} align={'center'} justify={'between'} minWidth={'70%'}>
      <form onSubmit={handleSubmit} className={styles.formGroup}>
        <Flex direction={'column'} justify={'center'}>
          <label htmlFor="name" className={styles.formLabel}>Tax Name</label>
          <TextField.Root
            mb={'5'}
            mt={'1'}
            type="text"
            size={'2'}
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <label htmlFor="rate" className={styles.formLabel}>Rate</label>
          <TextField.Root
            mb={'5'}
            mt={'1'}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            size={'2'}
            name="rate"
            value={formData.rate}
            onChange={handleChange}
            required
            style={{width: '100px'}}
          >
            <TextField.Slot side='right'>
              <Text>%</Text>
            </TextField.Slot>
          </TextField.Root>
        </Flex>
        <Flex direction={'column'}>
          <Flex direction={'row'} justify={'between'}>
            <Button variant='ghost' mb={'3'} loading={isLoading} style={{width: '100px'}}
              onClick={onCancel}>
              Cancel
            </Button>
            <Button mb={'3'} type="submit" loading={isLoading} style={{width: '100px'}}>
              Submit
            </Button>
          </Flex>
          
          {errorMessage && <Text color="red">{errorMessage}</Text>}
        </Flex>
      </form>
    </Flex>
  );
}
