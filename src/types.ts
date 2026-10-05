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
  channelUsername?: string; // e.g. @jmjads for Telegram subscription check
  requiredSeconds: number;
  frequency: 'once' | 'daily';
  requireMonetagAd: boolean;
  active: boolean;
  createdAt: string;
}

export interface TaskVerificationState {
  taskId: string;
  openedAt: number | null;
  elapsedSeconds: number;
  telegramSubscribed: boolean;
  unlockedToClaim: boolean;
  claimedCount: number;
  lastClaimedDate: string | null;
}

export interface TransactionItem {
  id: string;
  userId: string;
  type:
    | 'ad_reward'
    | 'task_reward'
    | 'referral'
    | 'withdraw'
    | 'welcome'
    | 'daily_streak'
    | 'promo_code'
    | 'channel_bonus';
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

export interface PromoCode {
  code: string;
  reward: number;
  rewardTitle?: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt?: string;
}

export interface UserProfile {
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  referralCode: string;
  referredBy: string | null;
  isVerifiedPublisher: boolean;
  multiplier2x: boolean;
  balance: number;
  todayEarned: number;
  referralEarned: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralCount: number;
  batchAdsWatched: number; // Ads watched in the current 2-hour batch (max 10)
  batchCycleStartAt: number; // Timestamp when current 2-hour batch started / locked
  todayAdsWatched: number;
  totalAdsWatched: number;
  officialChannelClaimed: boolean;
  completedGiveawayDays: number;
  missedGiveawayDays: number;
  streakDays: number;
  lastStreakDate: string | null;
  redeemedPromoCodes: string[];
  todayDateKey: string;
}

export interface AppConfig {
  siteName: string;
  tagline: string;
  officialChannelUrl: string;
  officialChannelUsername: string;
  officialChannelReward: number;
  monetagZoneId: string;
  monetagSdkFunc: string;
  adReward: number;
  adsPerBatchLimit: number; // 10 ads per batch
  adBatchCooldownHours: number; // 2 hours interval
  adCooldownSeconds: number;
  referralBonus: number;
  referredJoinBonus: number;
  welcomeBonus: number;
  minWithdraw: number;
  requiredReferralsForWithdraw: number;
  requireDailyAdsForWithdraw: boolean;
  telegramBotToken: string;
  telegramBotUsername: string;
  telegramMiniAppShortName: string;
  webAppHostUrl: string;
  giveawayPrizePool: number;
  giveawayDaysLeft: number;
  giveawayDateRange: string;
  giveawayRuleShortText: string;
  supportTelegram: string;
  supportEmail: string;
  supportWhatsapp: string;
  supportPhone: string;
  tutorialVideoUrl: string;
  adminPin: string;
}
