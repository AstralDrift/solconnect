import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export interface TextInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export const TextInputField: React.FC<TextInputFieldProps> = ({ value, onChangeText, placeholder, multiline }) => {
  return (
    <TextInput
      style={[styles.input, multiline && styles.multiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      multiline={multiline}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  multiline: {
    maxHeight: 100,
  },
});
