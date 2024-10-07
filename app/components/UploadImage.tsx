'use client';

import { Button, Flex, Text } from '@radix-ui/themes';
import { useState } from 'react';
import { Merchant } from '../types/types';

interface UploadImageProps {
  merchantId: string;
  fieldToUpdate: string;
  crop?: boolean;
  onUploadSuccess: (updatedMerchant: Merchant) => void;
}

const UploadImage: React.FC<UploadImageProps> = ({ merchantId, fieldToUpdate, crop = false, onUploadSuccess }) => {
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
    formData.append('merchantId', merchantId);
    formData.append('fieldToUpdate', fieldToUpdate);
    formData.append('crop', crop ? 'true' : 'false');

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
    document.getElementById(`file-input-${fieldToUpdate}`)?.click();
  };

  return (
    <Flex direction="column" align="center" gap="2">
      <input
        id={`file-input-${fieldToUpdate}`}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Button onClick={triggerFileInput} disabled={isLoading} style={{cursor: 'pointer'}}>
        {isLoading ? 'Uploading...' : 'Upload Image'}
      </Button>
      {message && <Text>{message}</Text>}
    </Flex>
  );
};

export default UploadImage;
