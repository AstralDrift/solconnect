import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSDK } from '../services/SolConnectSDK';
import { getMessageStorage } from '../services/storage/MessageStorage';
import { useToast } from '../components/Toast';

export default function SettingsScreen(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [storageStats, setStorageStats] = useState({
    messageCount: 0,
    sessionCount: 0
  });

  // Load storage statistics on mount
  React.useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    try {
      const storage = getMessageStorage();
      // This is a simplified version - in production, add a getStats method
      // For now, we'll just show placeholder values
      setStorageStats({
        messageCount: 0,
        sessionCount: 0
      });
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const sdk = getSDK();
      if (!sdk) {
        showToast({
          type: 'error',
          title: 'SDK not initialized',
          message: 'Please restart the app and try again.'
        });
        return;
      }

      const result = await sdk.exportMessages();
      if (result.success) {
        // Create a download link
        const blob = new Blob([result.data!], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solconnect-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast({
          type: 'success',
          title: 'Export successful',
          message: 'Your messages have been exported successfully.'
        });
      } else {
        showToast({
          type: 'error',
          title: 'Export failed',
          message: result.error?.userMessage || 'Failed to export messages.'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast({
        type: 'error',
        title: 'Export failed',
        message: 'An unexpected error occurred while exporting messages.'
      });
    } finally {
      setIsExporting(false);
    }
  }, [showToast]);

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const sdk = getSDK();
      if (!sdk) {
        showToast({
          type: 'error',
          title: 'SDK not initialized',
          message: 'Please restart the app and try again.'
        });
        return;
      }

      const text = await file.text();
      const result = await sdk.importMessages(text);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Import successful',
          message: `Imported ${result.data} messages successfully.`
        });
        loadStorageStats();
      } else {
        showToast({
          type: 'error',
          title: 'Import failed',
          message: result.error?.userMessage || 'Failed to import messages.'
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      showToast({
        type: 'error',
        title: 'Import failed',
        message: 'Invalid backup file or unexpected error occurred.'
      });
    } finally {
      setIsImporting(false);
      // Reset the input
      event.target.value = '';
    }
  }, [showToast]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const storage = getMessageStorage();
      const result = await storage.clearAll();
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Messages cleared',
          message: 'All messages have been cleared successfully.'
        });
        loadStorageStats();
      } else {
        showToast({
          type: 'error',
          title: 'Clear failed',
          message: result.error?.userMessage || 'Failed to clear messages.'
        });
      }
    } catch (error) {
      console.error('Clear error:', error);
      showToast({
        type: 'error',
        title: 'Clear failed',
        message: 'An unexpected error occurred while clearing messages.'
      });
    } finally {
      setIsClearing(false);
    }
  }, [showToast]);

  const handleCleanup = useCallback(async () => {
    if (!window.confirm('This will remove messages older than 30 days. Continue?')) {
      return;
    }

    try {
      const storage = getMessageStorage();
      const result = await storage.cleanup(30);
      
      if (result.success) {
        showToast({
          type: 'success',
          title: 'Cleanup complete',
          message: `Removed ${result.data} old messages.`
        });
        loadStorageStats();
      } else {
        showToast({
          type: 'error',
          title: 'Cleanup failed',
          message: result.error?.userMessage || 'Failed to cleanup messages.'
        });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      showToast({
        type: 'error',
        title: 'Cleanup failed',
        message: 'An unexpected error occurred during cleanup.'
      });
    }
  }, [showToast]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '15px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #eee',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginRight: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            color: '#9945FF',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <h1 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#333',
          margin: 0,
        }}>
          Settings
        </h1>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '20px',
        maxWidth: '600px',
        width: '100%',
        margin: '0 auto',
      }}>
        {/* Storage Section */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            marginBottom: '20px',
            color: '#333',
          }}>
            Message Storage
          </h2>

          {/* Storage Stats */}
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{ color: '#666' }}>Total Messages:</span>
              <span style={{ fontWeight: '500' }}>{storageStats.messageCount}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span style={{ color: '#666' }}>Active Sessions:</span>
              <span style={{ fontWeight: '500' }}>{storageStats.sessionCount}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              style={{
                padding: '12px 20px',
                backgroundColor: '#9945FF',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isExporting ? 'Exporting...' : 'Export Messages'}
            </button>

            {/* Import Button */}
            <label style={{
              padding: '12px 20px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              opacity: isImporting ? 0.7 : 1,
              transition: 'opacity 0.2s',
              textAlign: 'center',
            }}>
              {isImporting ? 'Importing...' : 'Import Messages'}
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isImporting}
                style={{ display: 'none' }}
              />
            </label>

            {/* Cleanup Button */}
            <button
              onClick={handleCleanup}
              style={{
                padding: '12px 20px',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Clean Up Old Messages
            </button>

            {/* Clear All Button */}
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              style={{
                padding: '12px 20px',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: isClearing ? 'not-allowed' : 'pointer',
                opacity: isClearing ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isClearing ? 'Clearing...' : 'Clear All Messages'}
            </button>
          </div>
        </div>

        {/* Privacy Notice */}
        <div style={{
          backgroundColor: '#d1ecf1',
          border: '1px solid #bee5eb',
          borderRadius: '8px',
          padding: '15px',
          color: '#0c5460',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '10px',
          }}>
            Privacy Notice
          </h3>
          <p style={{
            fontSize: '14px',
            lineHeight: '1.5',
            margin: 0,
          }}>
            All messages are stored locally on your device with encryption. 
            Messages are never sent to our servers. Export your messages regularly 
            to create backups. Clearing messages cannot be undone.
          </p>
        </div>
      </div>
    </div>
  );
} 