import React from 'react';
import { AppProps } from 'next/app';
import { ToastProvider } from '../components/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </ErrorBoundary>
  );
} 