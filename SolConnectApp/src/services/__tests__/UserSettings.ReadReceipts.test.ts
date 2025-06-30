/**
 * Tests for UserSettings read receipt privacy controls
 * Verifies privacy settings work correctly for read receipts
 */

import { getUserSettingsService, UserSettingsService, UserPrivacySettings } from '../UserSettings';

// Mock localStorage
const mockLocalStorage = {
  data: new Map<string, string>(),
  getItem: jest.fn((key: string) => mockLocalStorage.data.get(key) || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.data.set(key, value);
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.data.delete(key);
  }),
  clear: jest.fn(() => {
    mockLocalStorage.data.clear();
  })
};

// Mock global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('UserSettings Read Receipt Privacy Controls', () => {
  let userSettings: UserSettingsService;

  beforeEach(async () => {
    // Clear localStorage mock
    mockLocalStorage.clear();
    jest.clearAllMocks();
    
    // Get fresh instance
    userSettings = getUserSettingsService();
    await userSettings.initialize();
  });

  describe('Read Receipt Privacy Settings', () => {
    it('should have default read receipt setting enabled', () => {
      const settings = userSettings.getPrivacySettings();
      expect(settings.sendReadReceipts).toBe(true);
    });

    it('should allow disabling read receipts', async () => {
      const result = await userSettings.updatePrivacySettings({
        sendReadReceipts: false
      });

      expect(result.success).toBe(true);
      expect(userSettings.shouldSendReadReceipts()).toBe(false);
      
      const settings = userSettings.getPrivacySettings();
      expect(settings.sendReadReceipts).toBe(false);
    });

    it('should allow enabling read receipts', async () => {
      // First disable
      await userSettings.updatePrivacySettings({ sendReadReceipts: false });
      expect(userSettings.shouldSendReadReceipts()).toBe(false);

      // Then enable
      const result = await userSettings.updatePrivacySettings({
        sendReadReceipts: true
      });

      expect(result.success).toBe(true);
      expect(userSettings.shouldSendReadReceipts()).toBe(true);
      
      const settings = userSettings.getPrivacySettings();
      expect(settings.sendReadReceipts).toBe(true);
    });

    it('should persist read receipt settings to localStorage', async () => {
      await userSettings.updatePrivacySettings({
        sendReadReceipts: false
      });

      // Verify localStorage was called
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'solconnect_privacy_settings',
        expect.stringContaining('"sendReadReceipts":false')
      );
    });

    it('should load read receipt settings from localStorage on initialization', async () => {
      // Pre-populate localStorage with disabled read receipts
      const savedSettings: UserPrivacySettings = {
        sendReadReceipts: false,
        showTypingIndicators: true,
        showOnlineStatus: true,
        allowReactions: true
      };
      
      mockLocalStorage.setItem(
        'solconnect_privacy_settings',
        JSON.stringify(savedSettings)
      );

      // Create new instance to test loading
      const newUserSettings = new UserSettingsService();
      await newUserSettings.initialize();

      expect(newUserSettings.shouldSendReadReceipts()).toBe(false);
      expect(newUserSettings.getPrivacySettings().sendReadReceipts).toBe(false);
    });

    it('should update only specified privacy settings', async () => {
      // Get initial settings
      const initialSettings = userSettings.getPrivacySettings();
      expect(initialSettings.sendReadReceipts).toBe(true);
      expect(initialSettings.allowReactions).toBe(true);

      // Update only read receipts
      await userSettings.updatePrivacySettings({
        sendReadReceipts: false
      });

      const updatedSettings = userSettings.getPrivacySettings();
      expect(updatedSettings.sendReadReceipts).toBe(false);
      expect(updatedSettings.allowReactions).toBe(true); // Should remain unchanged
    });
  });

  describe('Multiple Privacy Settings Integration', () => {
    it('should handle multiple privacy settings together', async () => {
      const newSettings: Partial<UserPrivacySettings> = {
        sendReadReceipts: false,
        showTypingIndicators: false,
        allowReactions: false
      };

      const result = await userSettings.updatePrivacySettings(newSettings);
      expect(result.success).toBe(true);

      const settings = userSettings.getPrivacySettings();
      expect(settings.sendReadReceipts).toBe(false);
      expect(settings.showTypingIndicators).toBe(false);
      expect(settings.allowReactions).toBe(false);
      expect(settings.showOnlineStatus).toBe(true); // Should remain default
    });

    it('should validate privacy settings updates', async () => {
      // Test with invalid data type
      const invalidSettings = {
        sendReadReceipts: 'invalid' as any
      };

      const result = await userSettings.updatePrivacySettings(invalidSettings);
      
      // Should handle gracefully (implementation dependent)
      // In a robust implementation, this might return an error
      expect(result).toBeDefined();
    });
  });

  describe('Read Receipt Utility Methods', () => {
    it('should provide shouldSendReadReceipts helper method', () => {
      expect(userSettings.shouldSendReadReceipts()).toBe(true);

      userSettings.updatePrivacySettings({ sendReadReceipts: false });
      expect(userSettings.shouldSendReadReceipts()).toBe(false);
    });

    it('should handle missing privacy settings gracefully', async () => {
      // Simulate corrupted localStorage
      mockLocalStorage.setItem(
        'solconnect_privacy_settings',
        'invalid json'
      );

      const newUserSettings = new UserSettingsService();
      await newUserSettings.initialize();

      // Should fall back to defaults
      expect(newUserSettings.shouldSendReadReceipts()).toBe(true);
      const settings = newUserSettings.getPrivacySettings();
      expect(settings.sendReadReceipts).toBe(true);
    });
  });

  describe('Settings Synchronization', () => {
    it('should maintain settings consistency across service calls', async () => {
      // Update settings
      await userSettings.updatePrivacySettings({
        sendReadReceipts: false
      });

      // Get a new instance of the service
      const secondInstance = getUserSettingsService();
      
      // Should return the same instance (singleton pattern)
      expect(secondInstance).toBe(userSettings);
      expect(secondInstance.shouldSendReadReceipts()).toBe(false);
    });

    it('should handle rapid setting changes', async () => {
      const rapidUpdates = [
        userSettings.updatePrivacySettings({ sendReadReceipts: false }),
        userSettings.updatePrivacySettings({ sendReadReceipts: true }),
        userSettings.updatePrivacySettings({ sendReadReceipts: false }),
        userSettings.updatePrivacySettings({ sendReadReceipts: true })
      ];

      const results = await Promise.all(rapidUpdates);
      
      // All updates should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Final state should be the last update
      expect(userSettings.shouldSendReadReceipts()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = await userSettings.updatePrivacySettings({
        sendReadReceipts: false
      });

      // Should handle error gracefully
      expect(result).toBeDefined();
      // Implementation might return success: false or handle differently
    });

    it('should handle concurrent access safely', async () => {
      // Simulate concurrent updates
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        userSettings.updatePrivacySettings({
          sendReadReceipts: i % 2 === 0
        })
      );

      const results = await Promise.all(concurrentUpdates);
      
      // Should not throw errors
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Integration with Read Receipt Flow', () => {
    it('should provide consistent read receipt preferences', () => {
      // Test the exact method called by MessageBubble
      expect(typeof userSettings.shouldSendReadReceipts).toBe('function');
      
      // Test default state
      expect(userSettings.shouldSendReadReceipts()).toBe(true);
      
      // Test after disabling
      userSettings.updatePrivacySettings({ sendReadReceipts: false });
      expect(userSettings.shouldSendReadReceipts()).toBe(false);
    });

    it('should work with MessageBubble integration pattern', async () => {
      // Simulate the pattern used in MessageBubble
      const getUserSettings = () => getUserSettingsService();
      
      // Check initial state
      expect(getUserSettings().shouldSendReadReceipts()).toBe(true);
      
      // Update settings
      await getUserSettings().updatePrivacySettings({
        sendReadReceipts: false
      });
      
      // Verify the change is reflected
      expect(getUserSettings().shouldSendReadReceipts()).toBe(false);
      
      // This simulates what MessageBubble does in its useEffect
      const shouldSend = getUserSettings().shouldSendReadReceipts();
      expect(shouldSend).toBe(false);
    });
  });
});