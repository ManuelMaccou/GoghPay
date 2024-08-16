import { useState } from 'react';
import InitiateOnramp from './initiateOnramp';

const StripeOnrampButton = () => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOnrampSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/createOnrampSession', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to create onramp session');
      }

      const data = await res.json();
      setClientSecret(data.client_secret);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button onClick={createOnrampSession} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Start Onramp'}
      </button>

      {error && <div>Error: {error}</div>}

      {clientSecret && <InitiateOnramp clientSecret={clientSecret} />}
    </div>
  );
};

export default StripeOnrampButton;
