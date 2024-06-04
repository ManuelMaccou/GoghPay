"use client"

import Login from "@/app/components/Login";
import { Merchant, User, Transaction } from "@/app/types/types";
import { getAccessToken, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}


export default function Sales({ params }: { params: { userId: string } }) {
  const { ready, authenticated, logout, user } = usePrivy();
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>();
  const [ merchant, setMerchant ] = useState<Merchant>();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  const visitingUser = params.userId
  console.log('visitingUser:', visitingUser);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      try {
        const response = await fetch(`/api/user/me/${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        const userData = await response.json();
        setCurrentUser(userData.user);
        
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
  
    if (ready && authenticated) {
      fetchUser();
    }
  }, [authenticated, ready, user, visitingUser]);

  console.log('fetched user:', currentUser);

  useEffect(() => {
    const fetchMerchant = async () => {
      if (!currentUser || !currentUser.merchant) return;
      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/merchant/verifyMerchantStatus/${user?.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }

        const data = await response.json();
        setMerchant(data.merchant);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching merchant: ${err.message}`);
        } else {
          setError('Error fetching merchant');
        }
      }
    };

    if (currentUser) {
      fetchMerchant();
    }
  }, [currentUser, user]);

  console.log('fetched merchant:', merchant);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!merchant) return;
      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`/api/transaction/merchant/${merchant._id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Unexpected status: ${response.status}`);
        }
        const transactionsData = await response.json();
        setTransactions(transactionsData);
      } catch (err) {
        if (isError(err)) {
          setError(`Error fetching transactions: ${err.message}`);
        } else {
          setError('Error fetching transactions');
        }
      }
    };

    if (merchant) {
      fetchTransactions();
    }
  }, [merchant]);

  console.log('fetched transactions:', transactions);

  if (!authenticated || !user || currentUser?._id !== visitingUser) {
    return <Login />;
  }

  if (!currentUser?.merchant) {
    return <Login />;
  }

  return (
    <div>
      {error && <p>Error: {error}</p>}
      <h1>Sales</h1>
      {transactions ? (
        <ul>
          {transactions.map((transaction) => (
            <li key={transaction._id}>{transaction.productName}</li> // Adjust according to your transaction schema
          ))}
        </ul>
      ) : (
        <p>Loading transactions...</p>
      )}
    </div>
  );
}