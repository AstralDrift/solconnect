import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateBiometric(promptMessage = 'Authenticate') {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (supported.length === 0) return false;
  const { success } = await LocalAuthentication.authenticateAsync({ promptMessage });
  return success;
}
