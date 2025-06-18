import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: object;
}

export const ThemedTextInput: React.FC<Props> = ({ value, onChangeText, placeholder, multiline, style }) => (
  <TextInput
    style={[styles.input, style]}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#999"
    multiline={multiline}
  />
);

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
