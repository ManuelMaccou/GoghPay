'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentResult() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Extract the result parameter from the query
    const resultParam = searchParams.get('result');
    
    if (!resultParam) {
      setError('No result found in the URL.');
      return;
    }

    // Decode the result and split it by `<br>` or other delimiters
    const decodedResult = decodeURIComponent(resultParam);

    // Check for error in the decoded result
    if (decodedResult.toLowerCase().includes('error')) {
      setError(decodedResult);
      return;
    }

    // Use regex to extract either Client Transaction ID or Transaction ID
    const clientTransactionMatch = decodedResult.match(/Client Transaction ID:\s*([a-zA-Z0-9-]+)/);
    const transactionMatch = decodedResult.match(/Transaction ID:\s*([a-zA-Z0-9-]+)/);

    const finalTransactionId = clientTransactionMatch?.[1] || transactionMatch?.[1];

    if (finalTransactionId) {
      setTransactionId(finalTransactionId);
      // Fetch payment details using the extracted transaction ID
      fetchPaymentDetails(finalTransactionId);
    } else {
      setError('No valid transaction ID found.');
    }
  }, [searchParams]);

  // Function to fetch payment details from Square using the transaction ID
  const fetchPaymentDetails = async (transactionId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/square/payment/${transactionId}`);
      const data = await response.json();

      if (response.ok && data.paymentId) {
        // Set the payment ID from the API response
        setPaymentId(data.paymentId);

        // You can now perform your database update here
        await updateDatabaseWithPaymentId(data.paymentId);
      } else {
        setError('Failed to fetch payment details');
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setError('An error occurred while fetching payment details.');
    } finally {
      setLoading(false);
    }
  };

  // Function to update your database with the payment ID
  const updateDatabaseWithPaymentId = async (paymentId: string) => {
    try {
      const response = await fetch('/api/update-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentId }),
      });

      if (!response.ok) {
        setError('Failed to update the database.');
      }
    } catch (error) {
      console.error('Error updating the database:', error);
      setError('An error occurred while updating the database.');
    }
  };

  return (
    <div>
      <h1>Payment Result</h1>

      {/* Display the error message if present */}
      {error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <div>
          {/* Display the transaction ID or loading message */}
          {loading ? (
            <p>Loading payment details...</p>
          ) : (
            <>
              {transactionId ? (
                <p>Transaction ID: {transactionId}</p>
              ) : (
                <p>No transaction ID available.</p>
              )}

              {/* Display the payment ID if available */}
              {paymentId && <p>Payment ID: {paymentId}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
