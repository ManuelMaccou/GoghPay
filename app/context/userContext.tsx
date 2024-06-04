import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';
import { User } from '../types/types';

interface UserContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const { ready, authenticated, getAccessToken } = usePrivy();

    useEffect(() => {
        const fetchUserData = async () => {
            if (ready && authenticated) {
                try {
                    const accessToken = await getAccessToken();
                    const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user`, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });
                    const userData = response.data;
                    setUser(userData);
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            }
        };

        fetchUserData();
    }, [ready, authenticated, getAccessToken]);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
