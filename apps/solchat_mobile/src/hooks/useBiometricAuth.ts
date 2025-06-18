import * as LocalAuthentication from 'expo-local-authentication';

export async function useBiometricAuth(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return true; // fallback if no biometric hardware
  }
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return true;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to login',
  });
  return result.success;
}
