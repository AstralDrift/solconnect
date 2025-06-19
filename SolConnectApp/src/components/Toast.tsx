import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  hideToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast notification provider
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-hide after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Toast container component
 */
function ToastContainer() {
  const { toasts, hideToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '400px'
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

/**
 * Individual toast item component
 */
function ToastItem({ toast, onClose }: ToastItemProps) {
  const getToastStyles = (type: ToastType) => {
    const baseStyles = {
      display: 'flex',
      alignItems: 'flex-start',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      border: '1px solid',
      maxWidth: '400px',
      minWidth: '300px',
      animation: 'slideIn 0.3s ease-out',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          backgroundColor: '#d4edda',
          borderColor: '#c3e6cb',
          color: '#155724'
        };
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: '#f8d7da',
          borderColor: '#f5c6cb',
          color: '#721c24'
        };
      case 'warning':
        return {
          ...baseStyles,
          backgroundColor: '#fff3cd',
          borderColor: '#ffeaa7',
          color: '#856404'
        };
      case 'info':
        return {
          ...baseStyles,
          backgroundColor: '#d1ecf1',
          borderColor: '#bee5eb',
          color: '#0c5460'
        };
      default:
        return baseStyles;
    }
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '💬';
    }
  };

  return (
    <div style={getToastStyles(toast.type)}>
      <div style={{ marginRight: '12px', fontSize: '20px' }}>
        {getIcon(toast.type)}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          marginBottom: toast.message ? '4px' : '0'
        }}>
          {toast.title}
        </div>
        
        {toast.message && (
          <div style={{
            fontSize: '14px',
            opacity: 0.9,
            lineHeight: '1.4'
          }}>
            {toast.message}
          </div>
        )}
        
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            style={{
              marginTop: '8px',
              backgroundColor: 'transparent',
              border: '1px solid currentColor',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          opacity: 0.6,
          marginLeft: '8px',
          padding: '0',
          lineHeight: '1'
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Utility functions for common toast types
 */
export const toast = {
  success: (title: string, message?: string) => {
    // This will be used with useToast hook
    return { type: 'success' as const, title, message };
  },
  
  error: (title: string, message?: string) => {
    return { type: 'error' as const, title, message };
  },
  
  warning: (title: string, message?: string) => {
    return { type: 'warning' as const, title, message };
  },
  
  info: (title: string, message?: string) => {
    return { type: 'info' as const, title, message };
  }
};

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style); 