import React from 'react';
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent } from 'react-native';

interface Props {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: object;
}

export const ThemedButton: React.FC<Props> = ({ title, onPress, disabled, style }) => (
  <TouchableOpacity
    accessibilityRole="button"
    style={[styles.button, disabled && styles.disabled, style]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={styles.title}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#9945FF',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#ccc',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
