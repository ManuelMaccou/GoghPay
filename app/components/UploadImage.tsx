'use client';

import { Button, Flex, Text } from '@radix-ui/themes';
import { useState } from 'react';
import { Merchant } from '../types/types';

interface UploadImageProps {
  merchantId: string;
  paymentProvider: 'Venmo' | 'Zelle';
  onUploadSuccess: (updatedMerchant: Merchant) => void;
}

const UploadImage: React.FC<UploadImageProps> = ({ merchantId, paymentProvider, onUploadSuccess }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files ? event.target.files[0] : null;

    if (!selectedFile) {
      alert('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('paymentProvider', paymentProvider);
    formData.append('merchantId', merchantId);

    for (let [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }
  

    setIsLoading(true);

    try {
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setMessage('Image uploaded successfully!');
        onUploadSuccess(data.updatedMerchant);
        console.log('data:', data);
      } else {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessage('Error uploading image.');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    document.getElementById(`file-input-${paymentProvider}`)?.click(); // Unique ID for each payment method
  };


  return (
    <Flex direction="column" align="center" gap="2">
      <input
        id={`file-input-${paymentProvider}`}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }} // Hide the default input
      />
      <Button onClick={triggerFileInput} disabled={isLoading}>
        {isLoading ? 'Uploading...' : 'Upload QR code'}
      </Button>
      {message && <Text>{message}</Text>}
    </Flex>
  );
};

export default UploadImage;
