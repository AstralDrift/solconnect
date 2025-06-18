import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '../screens/LoginScreen';

it('renders login button', () => {
  const { getByText } = render(<LoginScreen onLogin={() => {}} />);
  expect(getByText('Login with Wallet')).toBeTruthy();
});
