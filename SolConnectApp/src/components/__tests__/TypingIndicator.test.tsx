import React from 'react';
import { render } from '@testing-library/react';
import { TypingIndicator } from '../TypingIndicator';

describe('TypingIndicator', () => {
  it('renders three dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(3);
  });

  it('applies animation classes', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.rounded-full');
    dots.forEach(dot => {
      expect(dot).toHaveClass('animate-typing');
    });
  });
}); 