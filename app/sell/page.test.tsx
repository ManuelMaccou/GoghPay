import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { useRouter } from 'next/router';
import { useSearchParams } from 'next/navigation';
import Sell from './page'; // Assuming this is the SellContent page
import { UserProvider } from '../contexts/UserContext';
import { RewardsCustomer, User } from '../types/types'; // Assuming these types exist

// Mock necessary dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('../hooks/useLogout');
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

const mockSearchParams = {
  get: jest.fn(),
};

// Mocked users and functions
const mockAppUser: User = {
  _id: '123',
  privyId: '123',
  walletAddress: '0x123',
  email: 'm.maccou@gmail.com',
  merchant: true,
  creationType: 'privy',
  smartAccountAddress: '0x123',
};

const mockCurrentUser: User = {
  _id: 'user123',
  privyId: 'privy123',
  walletAddress: '0x456',
  email: 'currentuser@example.com',
  merchant: false,
  creationType: 'standard',
  smartAccountAddress: '0x456',
};

// Mock finalPrice and setSquarePosError
const mockSetSquarePosError = jest.fn();

const renderWithUserContext = (
  ui: React.ReactElement,
  {
    appUser,
    currentUser,
    setCurrentUser,
  }: {
    appUser: User | null;
    currentUser: User | null;
    setCurrentUser: (user: User) => void;
  }
) => {
  return render(
    <UserProvider value={{ appUser, currentUser, setCurrentUser }}>
      {ui}
    </UserProvider>
  );
};

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
});

describe('Component tests with appUser context', () => {
  test('should set current user if appUser is available and currentUser is null', () => {
    const mockSetCurrentUser = jest.fn(); // Mocking setCurrentUser
    renderWithUserContext(<Sell />, {
      appUser: mockAppUser,
      currentUser: null,
      setCurrentUser: mockSetCurrentUser, // Ensure setCurrentUser is passed
    });

    expect(mockSetCurrentUser).toHaveBeenCalledWith(mockAppUser);
  });

  test('should set wallet address if appUser has walletAddress or smartAccountAddress', () => {
    const mockSetWalletForPurchase = jest.fn();
    const mockSetCurrentUser = jest.fn(); // Mock setCurrentUser
    renderWithUserContext(
      <Sell setWalletForPurchase={mockSetWalletForPurchase} />,
      {
        appUser: mockAppUser,
        currentUser: null,
        setCurrentUser: mockSetCurrentUser, // Ensure setCurrentUser is passed
      }
    );

    expect(mockSetWalletForPurchase).toHaveBeenCalledWith(mockAppUser.walletAddress);
  });
});

test('should fetch customers and update state', async () => {
  const mockResponse = { customers: [] };
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: jest.fn().mockResolvedValueOnce(mockResponse),
  });

  renderWithUserContext(
    <Sell />,
    {
      appUser: mockAppUser,
      currentUser: mockCurrentUser,
      setCurrentUser: jest.fn(),
    }
  );

  // Simulate the component's side effect for fetching customers
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/rewards/userRewards/customers'));
    // Ensure state update happens, assuming it's reflected in the UI
    // Use screen.getByText() or getByTestId() to verify the UI has updated based on the fetched customers
  });
});

test('should show error message if payment details are missing', () => {
  renderWithUserContext(
    <Sell />,
    {
      appUser: mockAppUser,
      currentUser: mockCurrentUser,
      setCurrentUser: jest.fn(),
    }
  );

  // Simulate the condition where payment details are missing and the error is triggered
  // If the error message appears in the UI, test for it:
  const errorMessage = 'Missing payment details. Please refresh the page and try again.';
  expect(screen.queryByText(errorMessage)).not.toBeInTheDocument(); // Before error

  // Trigger the action that causes the error
  // Simulate user actions or call any function that triggers the error handling (like a button click or form submit)

  expect(screen.getByText(errorMessage)).toBeInTheDocument(); // After error
});

afterEach(() => {
  jest.clearAllMocks();
});
