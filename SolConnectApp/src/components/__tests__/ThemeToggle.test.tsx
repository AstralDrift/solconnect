import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../context/ThemeContext';

describe('ThemeToggle', () => {
  it('renders without crashing', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('toggles theme on click', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    
    const button = getByRole('button');
    const initialTheme = document.documentElement.classList.contains('dark');
    
    fireEvent.click(button);
    
    const newTheme = document.documentElement.classList.contains('dark');
    expect(newTheme).not.toBe(initialTheme);
  });
}); 