import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  onBack?: () => void;
}

export const ThemedHeader: React.FC<Props> = ({ title, onBack }) => (
  <View style={styles.container}>
    {onBack && (
      <Text style={styles.back} onPress={onBack} accessibilityRole="button">
        ← Back
      </Text>
    )}
    <Text style={styles.title}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  back: {
    marginRight: 15,
    color: '#9945FF',
    fontSize: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
