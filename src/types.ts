export type PlatformType = 'telegram' | 'youtube' | 'tiktok' | 'facebook' | 'custom';

export type TaskActionType = 'subscribe' | 'watch_video' | 'like_follow' | 'visit';

export interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  platform: PlatformType;
  taskType: TaskActionType;
  reward: number;
  url: string;
  channelUsername?: string; // e.g. @JMJAds_Official for Telegram subscription check
  requiredSeconds: number; // minimum time user must spend before claiming
  frequency: 'once' | 'daily';
  requireMonetagAd: boolean;
  active: boolean;
  createdAt: string;
}

export interface TaskVerificationState {
  taskId: string;
  openedAt: number | null;
  elapsedSeconds: number;
  telegramSubscribed: boolean; // Verified via Telegram Bot API or In-App Channel Bot check
  unlockedToClaim: boolean;
  claimedCount: number;
  lastClaimedDate: string | null;
}

export interface TransactionItem {
  id: string;
  userId: string;
  type: 'ad_reward' | 'task_reward' | 'referral' | 'withdraw' | 'welcome' | 'daily_streak' | 'spin_wheel' | 'promo_code';
  amount: number;
  description: string;
  createdAt: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  method: 'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'Binance';
  accountNumber: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  maskedName: string;
  userTag: string;
  referrals: number;
  completedDays: number;
  prizeAmount: number;
  isCurrentUser?: boolean;
}

export interface DisqualifiedEntry {
  userTag: string;
  reason: string;
}

export interface PromoCode {
  code: string;
  reward: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export interface UserProfile {
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  isVerifiedPublisher: boolean;
  multiplier2x: boolean;
  balance: number;
  todayEarned: number;
  referralEarned: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralCount: number;
  todayAdsWatched: number;
  totalAdsWatched: number;
  completedGiveawayDays: number;
  missedGiveawayDays: number;
  streakDays: number;
  lastStreakDate: string | null;
  spinsUsedToday: number;
  redeemedPromoCodes: string[];
  todayDateKey: string;
}

export interface AppConfig {
  siteName: string;
  tagline: string;
  monetagZoneId: string;
  monetagSdkFunc: string;
  adReward: number;
  dailyAdLimit: number;
  adCooldownSeconds: number;
  referralBonus: number;
  welcomeBonus: number;
  minWithdraw: number;
  requiredReferralsForWithdraw: number;
  requireDailyAdsForWithdraw: boolean;
  telegramBotToken: string;
  telegramBotUsername: string;
  giveawayPrizePool: number;
  giveawayDaysLeft: number;
  giveawayDateRange: string;
  supportTelegram: string;
  supportEmail: string;
  supportWhatsapp: string;
  supportPhone: string;
  tutorialVideoUrl: string;
  adminPin: string;
}
