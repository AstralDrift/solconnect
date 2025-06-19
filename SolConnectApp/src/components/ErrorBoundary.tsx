/**
 * Error Boundary and Error Handling Components for SolConnect
 * Provides consistent error display and recovery mechanisms
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SolConnectError, ErrorCategory } from '../types/errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for handling React errors gracefully
 * Provides user-friendly error messages and recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorReportingService(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorMessage(): string {
    const { error } = this.state;
    
    if (error instanceof SolConnectError) {
      return error.userMessage;
    }

    if (error?.message) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  private getErrorDetails(): string {
    const { error, errorInfo } = this.state;
    
    if (process.env.NODE_ENV === 'development') {
      return `
        Error: ${error?.toString()}
        Stack: ${errorInfo?.componentStack}
      `;
    }

    return '';
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            textAlign: 'center',
            backgroundColor: '#fff',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              color: '#dc3545'
            }}>
              ⚠️
            </div>
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#212529',
              margin: '0 0 16px 0'
            }}>
              Something went wrong
            </h1>
            
            <p style={{
              fontSize: '16px',
              color: '#6c757d',
              margin: '0 0 32px 0',
              lineHeight: '1.5'
            }}>
              {this.getErrorMessage()}
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#9945FF',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7a35cc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9945FF'}
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                style={{
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
              >
                Go Home
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.getErrorDetails() && (
              <details style={{
                marginTop: '32px',
                textAlign: 'left'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#6c757d',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Error Details (Development)
                </summary>
                <pre style={{
                  backgroundColor: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#495057',
                  overflow: 'auto',
                  marginTop: '8px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.getErrorDetails()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for throwing errors from functional components
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

interface ErrorDisplayProps {
  error: SolConnectError | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Component for displaying SolConnect errors with appropriate styling
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onDismiss, 
  className = '' 
}) => {
  if (!error) return null;

  const getErrorIcon = (category: ErrorCategory) => {
    switch (category) {
      case 'network':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'crypto':
        return (
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'validation':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getBorderColor = (category: ErrorCategory) => {
    switch (category) {
      case 'network':
        return 'border-yellow-200';
      case 'crypto':
        return 'border-red-200';
      case 'validation':
        return 'border-yellow-200';
      default:
        return 'border-red-200';
    }
  };

  const getBackgroundColor = (category: ErrorCategory) => {
    switch (category) {
      case 'network':
        return 'bg-yellow-50';
      case 'crypto':
        return 'bg-red-50';
      case 'validation':
        return 'bg-yellow-50';
      default:
        return 'bg-red-50';
    }
  };

  return (
    <div className={`rounded-md p-4 ${getBorderColor(error.category)} ${getBackgroundColor(error.category)} border ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getErrorIcon(error.category)}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-800">
            {error.userMessage}
          </h3>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-sm text-gray-600">
              <p><strong>Code:</strong> {error.code}</p>
              <p><strong>Category:</strong> {error.category}</p>
              <p><strong>Message:</strong> {error.message}</p>
              {error.context && (
                <details className="mt-1">
                  <summary className="cursor-pointer">Context</summary>
                  <pre className="text-xs mt-1 bg-white p-1 rounded">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface RetryableErrorProps {
  error: SolConnectError;
  onRetry: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Component for errors that can be retried
 */
export const RetryableError: React.FC<RetryableErrorProps> = ({
  error,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  className = ''
}) => {
  if (!error.recoverable) {
    return <ErrorDisplay error={error} onDismiss={onDismiss} className={className} />;
  }

  return (
    <div className={`rounded-md p-4 bg-yellow-50 border border-yellow-200 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            {error.userMessage}
          </h3>
          <div className="mt-4">
            <div className="-mx-2 -my-1.5 flex">
              <button
                type="button"
                onClick={onRetry}
                className="bg-yellow-50 px-2 py-1.5 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
              >
                {retryLabel}
              </button>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="ml-3 bg-yellow-50 px-2 py-1.5 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};