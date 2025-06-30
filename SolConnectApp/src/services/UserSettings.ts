/**
 * User Settings Service for SolConnect
 * Manages user preferences and privacy settings
 */

import { SolConnectError, ErrorCode, Result, createResult } from '../types/errors';
import { Logger } from './monitoring/Logger';

export interface UserPrivacySettings {
  sendReadReceipts: boolean;
  showTypingIndicators: boolean;
  showOnlineStatus: boolean;
  allowReactions: boolean;
}

export interface UserInterfaceSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface UserSettings {
  privacy: UserPrivacySettings;
  interface: UserInterfaceSettings;
  version: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  privacy: {
    sendReadReceipts: true,
    showTypingIndicators: true,
    showOnlineStatus: true,
    allowReactions: true
  },
  interface: {
    theme: 'auto',
    fontSize: 'medium',
    soundEnabled: true,
    notificationsEnabled: true
  },
  version: 1
};

const SETTINGS_STORAGE_KEY = 'solconnect_user_settings';

/**
 * Service for managing user settings and preferences
 */
export class UserSettingsService {
  private logger = new Logger('UserSettingsService');
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<(settings: UserSettings) => void>();

  /**
   * Initialize the service and load saved settings
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info('Initializing UserSettingsService');
      
      const result = await this.loadSettings();
      if (!result.success) {
        this.logger.warn('Failed to load settings, using defaults', result.error);
        // Continue with default settings rather than failing
      }

      this.logger.info('UserSettingsService initialized successfully', {
        settings: this.settings
      });

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize UserSettingsService', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to initialize settings: ${error}`,
        'Unable to load user settings',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Get current settings
   */
  getSettings(): UserSettings {
    return { ...this.settings };
  }

  /**
   * Get privacy settings only
   */
  getPrivacySettings(): UserPrivacySettings {
    return { ...this.settings.privacy };
  }

  /**
   * Get interface settings only
   */
  getInterfaceSettings(): UserInterfaceSettings {
    return { ...this.settings.interface };
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(updates: Partial<UserPrivacySettings>): Promise<Result<void>> {
    try {
      this.logger.info('Updating privacy settings', updates);

      this.settings.privacy = {
        ...this.settings.privacy,
        ...updates
      };

      const saveResult = await this.saveSettings();
      if (!saveResult.success) {
        return saveResult;
      }

      this.notifyListeners();
      this.logger.info('Privacy settings updated successfully');

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to update privacy settings', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to update privacy settings: ${error}`,
        'Unable to save privacy settings',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Update interface settings
   */
  async updateInterfaceSettings(updates: Partial<UserInterfaceSettings>): Promise<Result<void>> {
    try {
      this.logger.info('Updating interface settings', updates);

      this.settings.interface = {
        ...this.settings.interface,
        ...updates
      };

      const saveResult = await this.saveSettings();
      if (!saveResult.success) {
        return saveResult;
      }

      this.notifyListeners();
      this.logger.info('Interface settings updated successfully');

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to update interface settings', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to update interface settings: ${error}`,
        'Unable to save interface settings',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<Result<void>> {
    try {
      this.logger.info('Resetting settings to defaults');

      this.settings = { ...DEFAULT_SETTINGS };

      const saveResult = await this.saveSettings();
      if (!saveResult.success) {
        return saveResult;
      }

      this.notifyListeners();
      this.logger.info('Settings reset to defaults successfully');

      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to reset settings', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to reset settings: ${error}`,
        'Unable to reset settings to defaults',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Check if read receipts should be sent
   */
  shouldSendReadReceipts(): boolean {
    return this.settings.privacy.sendReadReceipts;
  }

  /**
   * Check if reactions are allowed
   */
  allowReactions(): boolean {
    return this.settings.privacy.allowReactions;
  }

  /**
   * Subscribe to settings changes
   */
  addSettingsListener(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Load settings from local storage
   */
  private async loadSettings(): Promise<Result<void>> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.logger.warn('localStorage not available, using default settings');
        return createResult.success(undefined);
      }

      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        this.logger.info('No stored settings found, using defaults');
        return createResult.success(undefined);
      }

      const parsed = JSON.parse(stored);
      
      // Validate and merge with defaults to handle version upgrades
      this.settings = this.mergeWithDefaults(parsed);

      this.logger.info('Settings loaded successfully');
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to load settings from storage', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to load settings: ${error}`,
        'Unable to load saved settings',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Save settings to local storage
   */
  private async saveSettings(): Promise<Result<void>> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.logger.warn('localStorage not available, cannot save settings');
        return createResult.error(SolConnectError.system(
          ErrorCode.STORAGE_ERROR,
          'localStorage not available',
          'Unable to save settings'
        ));
      }

      const serialized = JSON.stringify(this.settings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);

      this.logger.debug('Settings saved successfully');
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to save settings to storage', error);
      return createResult.error(SolConnectError.system(
        ErrorCode.STORAGE_ERROR,
        `Failed to save settings: ${error}`,
        'Unable to save settings',
        { error: error?.toString() }
      ));
    }
  }

  /**
   * Merge stored settings with defaults to handle version upgrades
   */
  private mergeWithDefaults(stored: any): UserSettings {
    return {
      privacy: {
        ...DEFAULT_SETTINGS.privacy,
        ...(stored.privacy || {})
      },
      interface: {
        ...DEFAULT_SETTINGS.interface,
        ...(stored.interface || {})
      },
      version: DEFAULT_SETTINGS.version
    };
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getSettings());
      } catch (error) {
        this.logger.error('Error in settings listener', error);
      }
    });
  }
}

// Singleton instance
let userSettingsService: UserSettingsService | null = null;

/**
 * Get the UserSettingsService singleton instance
 */
export function getUserSettingsService(): UserSettingsService {
  if (!userSettingsService) {
    userSettingsService = new UserSettingsService();
  }
  return userSettingsService;
}

/**
 * Initialize the UserSettingsService
 */
export async function initializeUserSettings(): Promise<Result<UserSettingsService>> {
  const service = getUserSettingsService();
  const result = await service.initialize();
  
  if (!result.success) {
    return createResult.error(result.error!);
  }

  return createResult.success(service);
}