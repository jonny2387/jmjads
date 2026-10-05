import { AppConfig, LeaderboardEntry, PromoCode, TaskItem, TransactionItem, UserProfile, WithdrawRequest } from '../types';

export function getBangladeshDateKey(): string {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function generateShortReferCode(userId: string): string {
  const clean = String(userId).replace(/[^0-9a-zA-Z]/g, '');
  if (clean.length >= 6) {
    return 'JMJ' + clean.slice(-6).toUpperCase();
  }
  return 'JMJ' + clean.toUpperCase().padStart(6, '0');
}

export function getRealTelegramUser(): {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  startParam: string;
} {
  const tg = (
    window as unknown as {
      Telegram?: {
        WebApp?: {
          initDataUnsafe?: {
            user?: {
              id?: number | string;
              first_name?: string;
              last_name?: string;
              username?: string;
            };
            start_param?: string;
          };
        };
      };
    }
  ).Telegram?.WebApp;

  const tgUser = tg?.initDataUnsafe?.user;
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?|\?/, ''));

  const startParam =
    tg?.initDataUnsafe?.start_param ||
    urlParams.get('tgWebAppStartParam') ||
    urlParams.get('startapp') ||
    urlParams.get('ref') ||
    urlParams.get('start') ||
    hashParams.get('tgWebAppStartParam') ||
    hashParams.get('ref') ||
    '';

  if (tgUser && tgUser.id) {
    return {
      id: String(tgUser.id),
      firstName: tgUser.first_name || 'User',
      lastName: tgUser.last_name || '',
      username: tgUser.username || '',
      startParam,
    };
  }

  let savedUid = localStorage.getItem('jmj_real_device_uid');
  if (!savedUid) {
    savedUid = String(Math.floor(100000000 + Math.random() * 900000000));
    localStorage.setItem('jmj_real_device_uid', savedUid);
  }

  return {
    id: savedUid,
    firstName: 'Telegram',
    lastName: 'Member',
    username: '',
    startParam,
  };
}

/**
 * Builds two 100% working referral links:
 * 1. Direct Web / Mini App Referral URL (`?ref=USER_ID&startapp=ref_USER_ID`) - works without needing Bot backend webhook
 * 2. Telegram Mini App Direct Launch URL (`https://t.me/BOT/APP?startapp=ref_USER_ID`) - passes start_param directly to WebApp
 */
export function buildDynamicReferralUrl(config: AppConfig, userId: string): string {
  const hostBase = (config.webAppHostUrl || '').trim() || window.location.origin + window.location.pathname;
  const cleanHost = hostBase.replace(/\/+$/, '');

  const rawBot = (config.telegramBotUsername || '').trim().replace(/^@/, '');
  const shortApp = (config.telegramMiniAppShortName || '').trim().replace(/^\/+|\/+$/g, '');

  // If Admin configured a Direct Mini App shortname (e.g. BotUsername/app), Telegram natively forwards ?startapp=ref_ID into WebApp.initDataUnsafe.start_param!
  if (rawBot && shortApp) {
    return `https://t.me/${rawBot}/${shortApp}?startapp=ref_${userId}`;
  }
  if (rawBot.includes('/')) {
    const cleanPath = rawBot.replace(/^https?:\/\/t\.me\//, '').replace(/\/+$/, '');
    return `https://t.me/${cleanPath}?startapp=ref_${userId}`;
  }

  // Otherwise use the Direct Web/Mini-App Link so clicking it in Telegram immediately opens the app & credits referral!
  const sep = cleanHost.includes('?') ? '&' : '?';
  return `${cleanHost}${sep}ref=${userId}`;
}

export const DEFAULT_CONFIG: AppConfig = {
  siteName: 'JMJ Ads',
  tagline: 'প্রিমিয়াম টেলিগ্রাম আর্নিং নেটওয়ার্ক',
  officialChannelUrl: 'https://t.me/jmjads',
  officialChannelUsername: '@jmjads',
  officialChannelReward: 30,
  monetagZoneId: '11460709',
  monetagSdkFunc: 'show_11460709',
  adReward: 25,
  adsPerBatchLimit: 10, // ১০টি করে অ্যাড প্রতি ২ ঘণ্টা পর পর
  adBatchCooldownHours: 2, // ২ ঘণ্টা পর পর
  adCooldownSeconds: 5,
  referralBonus: 50,
  referredJoinBonus: 20,
  welcomeBonus: 25,
  minWithdraw: 1000,
  requiredReferralsForWithdraw: 18,
  requireDailyAdsForWithdraw: true,
  telegramBotToken: '',
  telegramBotUsername: '',
  telegramMiniAppShortName: '',
  webAppHostUrl: '',
  giveawayPrizePool: 30000,
  giveawayDaysLeft: 10,
  giveawayDateRange: 'লাইভ রেফারেল কনটেস্ট',
  giveawayRuleShortText: 'সবথেকে বেশি রেফার করে টপ ১০-এ থাকলেই পাবেন এই গিভয়ে পুরস্কার!',
  supportTelegram: '@jmjads',
  supportEmail: '',
  supportWhatsapp: '',
  supportPhone: '',
  tutorialVideoUrl: 'https://t.me/jmjads',
  adminPin: '1234',
};

// Default Official Channel Task https://t.me/jmjads at the top
export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'official_jmjads_channel',
    title: 'JMJ Ads অফিশিয়াল চ্যানেল সাবস্ক্রাইব',
    subtitle: 'https://t.me/jmjads চ্যানেলে জয়েন করে ভেরিফাই ও ক্লেইম করুন',
    platform: 'telegram',
    taskType: 'subscribe',
    reward: 30,
    url: 'https://t.me/jmjads',
    channelUsername: '@jmjads',
    requiredSeconds: 8,
    frequency: 'once',
    requireMonetagAd: false,
    active: true,
    createdAt: '2026-10-05T00:00:00.000Z',
  },
];

export function createInitialUserProfile(welcomeBonus: number): UserProfile {
  const tgInfo = getRealTelegramUser();
  return {
    telegramId: tgInfo.id,
    firstName: tgInfo.firstName,
    lastName: tgInfo.lastName,
    username: tgInfo.username,
    referralCode: generateShortReferCode(tgInfo.id),
    referredBy: null,
    isVerifiedPublisher: true,
    multiplier2x: true,
    balance: welcomeBonus,
    todayEarned: 0,
    referralEarned: 0,
    totalEarned: welcomeBonus,
    totalWithdrawn: 0,
    referralCount: 0,
    batchAdsWatched: 0,
    batchCycleStartAt: 0,
    todayAdsWatched: 0,
    totalAdsWatched: 0,
    officialChannelClaimed: false,
    completedGiveawayDays: 0,
    missedGiveawayDays: 0,
    streakDays: 0,
    lastStreakDate: null,
    redeemedPromoCodes: [],
    todayDateKey: getBangladeshDateKey(),
  };
}

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [];
export const INITIAL_PROMO_CODES: PromoCode[] = [];
export const INITIAL_TRANSACTIONS: TransactionItem[] = [];
export const INITIAL_WITHDRAWALS: WithdrawRequest[] = [];
