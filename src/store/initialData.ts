import { AppConfig, LeaderboardEntry, PromoCode, TaskItem, TransactionItem, UserProfile, WithdrawRequest } from '../types';

export function getBangladeshDateKey(): string {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
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
  const startParam =
    tg?.initDataUnsafe?.start_param ||
    urlParams.get('tgWebAppStartParam') ||
    urlParams.get('startapp') ||
    urlParams.get('start') ||
    urlParams.get('ref') ||
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

  // Persistent device ID when opened in web browser outside Telegram
  let savedUid = localStorage.getItem('jmj_real_device_uid');
  if (!savedUid) {
    savedUid = 'tg_' + Math.floor(100000000 + Math.random() * 900000000);
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

export function buildDynamicReferralUrl(config: AppConfig, userId: string): string {
  const rawBot = (config.telegramBotUsername || '').trim();
  if (rawBot.startsWith('https://t.me/') || rawBot.startsWith('http://t.me/')) {
    const base = rawBot.replace(/\/+$/, '');
    const sep = base.includes('?') ? '&' : '?';
    const paramName = base.split('t.me/')[1]?.includes('/') ? 'startapp' : 'start';
    return `${base}${sep}${paramName}=ref_${userId}`;
  }
  const cleanBot = rawBot.replace(/^@/, '').replace(/\/+$/, '');
  if (cleanBot) {
    if (cleanBot.includes('/')) {
      return `https://t.me/${cleanBot}?startapp=ref_${userId}`;
    }
    return `https://t.me/${cleanBot}?start=ref_${userId}`;
  }
  // Fallback to current Mini App / Blogger host URL if bot username not yet set in Admin
  const currentUrl = window.location.origin + window.location.pathname;
  return `${currentUrl}?start=ref_${userId}`;
}

export const DEFAULT_CONFIG: AppConfig = {
  siteName: 'JMJ Ads',
  tagline: 'প্রিমিয়াম টেলিগ্রাম আর্নিং নেটওয়ার্ক',
  monetagZoneId: '11460709',
  monetagSdkFunc: 'show_11460709',
  adReward: 25,
  dailyAdLimit: 20,
  adCooldownSeconds: 5,
  referralBonus: 50,
  welcomeBonus: 25,
  minWithdraw: 1000,
  requiredReferralsForWithdraw: 18,
  requireDailyAdsForWithdraw: true,
  telegramBotToken: '',
  telegramBotUsername: 'TopEarnProBot',
  giveawayPrizePool: 30000,
  giveawayDaysLeft: 10,
  giveawayDateRange: 'লাইভ রেফারেল কনটেস্ট',
  supportTelegram: '@TopEarnProAdmin',
  supportEmail: '',
  supportWhatsapp: '',
  supportPhone: '',
  tutorialVideoUrl: 'https://youtube.com/@TopEarnProBD',
  adminPin: '1234',
};

// No demo tasks! Admin adds real tasks from admin.html
export const INITIAL_TASKS: TaskItem[] = [];

export function createInitialUserProfile(welcomeBonus: number): UserProfile {
  const tgInfo = getRealTelegramUser();
  return {
    telegramId: tgInfo.id,
    firstName: tgInfo.firstName,
    lastName: tgInfo.lastName,
    username: tgInfo.username,
    isVerifiedPublisher: true,
    multiplier2x: true,
    balance: welcomeBonus,
    todayEarned: 0,
    referralEarned: 0,
    totalEarned: welcomeBonus,
    totalWithdrawn: 0,
    referralCount: 0,
    todayAdsWatched: 0,
    totalAdsWatched: 0,
    completedGiveawayDays: 0,
    missedGiveawayDays: 0,
    streakDays: 0,
    lastStreakDate: null,
    spinsUsedToday: 0,
    redeemedPromoCodes: [],
    todayDateKey: getBangladeshDateKey(),
  };
}

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [];

export const INITIAL_PROMO_CODES: PromoCode[] = [];

export const INITIAL_TRANSACTIONS: TransactionItem[] = [];

export const INITIAL_WITHDRAWALS: WithdrawRequest[] = [];
