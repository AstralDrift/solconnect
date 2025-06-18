import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../src/screens/LoginScreen';

jest.mock('../src/native/SolChatSDK', () => ({
  walletLogin: jest.fn().mockResolvedValue('MockWallet'),
}));

jest.mock('../src/hooks/useBiometricAuth', () => ({
  useBiometricAuth: jest.fn().mockResolvedValue(true),
}));

describe('LoginScreen', () => {
  it('calls onLogin after pressing button', async () => {
    const onLogin = jest.fn();
    const { getByRole } = render(<LoginScreen onLogin={onLogin} />);
    fireEvent.press(getByRole('button'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('MockWallet'));
  });
});
