import { usePrivy, useLogin } from '@privy-io/react-auth';
import axios, { AxiosError } from 'axios';

export default function CustomLogin() {
  const { getAccessToken } = usePrivy();
  const { login } = useLogin({

    onComplete: async (user, isNewUser) => {
      const accessToken = await getAccessToken();
      const userPayload = {
        privyId: user.id,
        walletAddress: user.wallet?.address,
      };

      try {
        if (isNewUser) {
          try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, userPayload, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

          } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error fetching user details:', error.response?.data?.message || error.message);
            } else {
                console.error('Unexpected error:', error);
            }
          }
            
        } else {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch (error) {
        if (error instanceof AxiosError) {
            console.error('Error fetching user details:', error.response?.data?.message || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
      }
    },
    onError: (error) => {
        console.error("Privy login error:", error);
    },
  });

  return (
    
    <div>
      <button onClick={login}>Login</button>
    </div>
  );
}