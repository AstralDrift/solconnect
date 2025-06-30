import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: object;
  onBlur?: () => void;
}

export const ThemedTextInput: React.FC<Props> = ({ value, onChangeText, placeholder, multiline, style, onBlur }) => (
  <TextInput
    style={[styles.input, style]}
    value={value}
    onChangeText={onChangeText}
    onBlur={onBlur}
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
