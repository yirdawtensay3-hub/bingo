// Telegram Mini App integration
// This service handles communication with Telegram WebApp API
import { retrieveRawInitData } from '@telegram-apps/sdk'

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export class TelegramService {
  private webApp: TelegramWebApp | null = null;
  private initDataRaw = retrieveRawInitData();

  constructor() {
    this.initializeTelegram();
  }

  private initializeTelegram() {
    // Check if we're running in Telegram Mini App
    console.log('Initializing Telegram WebApp with initData:', this.initDataRaw);
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      this.webApp = window.Telegram.WebApp;
      this.webApp.ready();
      this.webApp.expand();
    }
  }

  // Check if we're running in Telegram Mini App
  isTelegramApp(): boolean {
    return this.webApp !== null;
  }

  // Get Telegram user data
  getTelegramUser(): TelegramUser | null {
    if (!this.webApp?.initDataUnsafe?.user) {
      return null;
    }
    return this.webApp.initDataUnsafe.user;
  }

  // Get theme from Telegram
  getTheme(): 'light' | 'dark' {
    return this.webApp?.colorScheme || 'light';
  }

  // Get theme parameters
  getThemeParams() {
    return this.webApp?.themeParams || {};
  }

  // Show main button
  showMainButton(text: string, onClick: () => void) {
    if (this.webApp?.MainButton) {
      this.webApp.MainButton.setText(text);
      this.webApp.MainButton.onClick(onClick);
      this.webApp.MainButton.show();
    }
  }

  // Hide main button
  hideMainButton() {
    if (this.webApp?.MainButton) {
      this.webApp.MainButton.hide();
    }
  }

  // Show back button
  showBackButton(onClick: () => void) {
    if (this.webApp?.BackButton) {
      this.webApp.BackButton.onClick(onClick);
      this.webApp.BackButton.show();
    }
  }

  // Hide back button
  hideBackButton() {
    if (this.webApp?.BackButton) {
      this.webApp.BackButton.hide();
    }
  }

  // Haptic feedback
  hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
    this.webApp?.HapticFeedback?.impactOccurred(type);
  }

  // Close the app
  close() {
    this.webApp?.close();
  }

  // Minimize the app
  minimize() {
    try {
      // WebApp SDK doesn't offer explicit minimize; use close as fallback
      this.webApp?.close();
    } catch { }
  }

  // Get init data for backend validation
  getInitData(): string | null {
    return this.initDataRaw ?? null;
  }

  getInitDataHash(): string | null {
    const initData = this.getInitData();
    if (!initData) {
      return null;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    return hash;
  }

  // Share URL via Telegram
  shareUrl(url: string, text?: string) {
    if (this.webApp) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
      this.webApp.openTelegramLink(shareUrl);
    }
  }
}

// Export singleton instance
export const telegramService = new TelegramService();

