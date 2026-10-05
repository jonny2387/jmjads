import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  Globe,
  Headphones,
  HelpCircle,
  History,
  Home,
  ListChecks,
  Lock,
  Mail,
  MessageCircle,
  Music2,
  Phone,
  Play,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Youtube,
  Zap,
} from 'lucide-react';
import {
  AppConfig,
  LeaderboardEntry,
  PlatformType,
  PromoCode,
  TaskItem,
  TaskVerificationState,
  TransactionItem,
  UserProfile,
  WithdrawRequest,
} from './types';
import {
  DEFAULT_CONFIG,
  INITIAL_TASKS,
  buildDynamicReferralUrl,
  createInitialUserProfile,
  generateShortReferCode,
  getBangladeshDateKey,
} from './store/initialData';
import {
  claimReferralByCodeOrId,
  fetchRealLeaderboard,
  fetchRealUserHistory,
  incrementPromoUsageInFirestore,
  initAndSyncRealUser,
  submitRealWithdrawToFirestore,
  subscribeToAppConfig,
  subscribeToPromos,
  subscribeToTasks,
  updateRealUserInFirestore,
} from './services/firebaseService';
import { MonetagAdPlayerModal } from './components/MonetagAdPlayerModal';
import { BonusAndPromoModal, NoticeModal } from './components/NoticeAndSpinModals';
import { BrandLogo } from './components/BrandLogo';

type UserPageTab = 'home' | 'tasks' | 'ads' | 'giveaway' | 'withdraw' | 'support';

const STORAGE_KEYS = {
  CONFIG: 'jmj_ads_config_v3',
  TASKS: 'jmj_ads_tasks_v3',
  USER: 'jmj_ads_user_v3',
  TASK_STATES: 'jmj_ads_task_states_v3',
  TRANSACTIONS: 'jmj_ads_tx_v3',
  WITHDRAWALS: 'jmj_ads_wd_v3',
  PROMOS: 'jmj_ads_promos_v3',
};

function formatCountdownHMS(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, '0')}ঘ : ${String(mins).padStart(2, '0')}মি : ${String(secs).padStart(2, '0')}সে`;
}

export default function App() {
  // Splash Screen State
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashProgress, setSplashProgress] = useState<number>(20);

  // Navigation State (Strictly User Pages Only)
  const [activePage, setActivePage] = useState<UserPageTab>('home');
  const [taskFilter, setTaskFilter] = useState<'all' | PlatformType>('all');

  // Real App Config synced from Firestore + localStorage
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // Real Tasks synced from Firestore + localStorage (with @jmjads official channel always available)
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed: TaskItem[] = JSON.parse(saved);
        return parsed.length > 0 ? parsed : INITIAL_TASKS;
      }
      return INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  // Real User Profile
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        const parsed: UserProfile = JSON.parse(saved);
        const today = getBangladeshDateKey();
        if (parsed.todayDateKey !== today) {
          parsed.todayAdsWatched = 0;
          parsed.todayEarned = 0;
          parsed.todayDateKey = today;
        }
        if (!parsed.referralCode) {
          parsed.referralCode = generateShortReferCode(parsed.telegramId);
        }
        return parsed;
      }
      return createInitialUserProfile(DEFAULT_CONFIG.welcomeBonus);
    } catch {
      return createInitialUserProfile(DEFAULT_CONFIG.welcomeBonus);
    }
  });

  const [taskStates, setTaskStates] = useState<Record<string, TaskVerificationState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASK_STATES);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [transactions, setTransactions] = useState<TransactionItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROMOS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Modals & Interactive States
  const [noticeOpen, setNoticeOpen] = useState<boolean>(false);
  const [bonusModalOpen, setBonusModalOpen] = useState<boolean>(false);
  const [adModalState, setAdModalState] = useState<{
    open: boolean;
    reward: number;
    purpose: string;
    onCompleteCallback?: () => void;
  }>({
    open: false,
    reward: config.adReward,
    purpose: 'Monetag বিজ্ঞাপন',
  });
  const [adCooldown, setAdCooldown] = useState<number>(0);

  // 2-Hour Batch Timer State (10 ads every 2 hours)
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Official Channel https://t.me/jmjads Top Verification State
  const [officialChannelOpenedAt, setOfficialChannelOpenedAt] = useState<number | null>(null);
  const [officialChannelCountdown, setOfficialChannelCountdown] = useState<number>(0);
  const [verifyingOfficialChannel, setVerifyingOfficialChannel] = useState<boolean>(false);

  // Task Verification State & Active Countdowns
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [activeTaskTimers, setActiveTaskTimers] = useState<Record<string, number>>({});

  // Manual Referral Code Input (Solves Telegram Bot /start loss issue 100%)
  const [manualRefInput, setManualRefInput] = useState<string>('');
  const [claimingManualRef, setClaimingManualRef] = useState<boolean>(false);

  // Inline Promo Code Input
  const [inlinePromoCode, setInlinePromoCode] = useState<string>('');

  // Withdraw Form State
  const [wdMethod, setWdMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'Binance'>('bKash');
  const [wdAccount, setWdAccount] = useState<string>('');
  const [wdAmount, setWdAmount] = useState<string>('');
  const [showWithdrawHistory, setShowWithdrawHistory] = useState<boolean>(false);

  // Top Notification Toast (3-second shrinking line at bottom)
  const [toastState, setToastState] = useState<{ msg: string; id: number } | null>(null);

  const showToast = (msg: string) => {
    setToastState({ msg, id: Date.now() });
  };

  // Native Telegram Alert + Top Toast helper when user tries to claim without subscribing
  const triggerTelegramNativeAlert = (message: string) => {
    showToast(message);
    try {
      const tg = (
        window as unknown as {
          Telegram?: {
            WebApp?: {
              showAlert?: (msg: string) => void;
              HapticFeedback?: { notificationOccurred?: (type: 'error' | 'warning' | 'success') => void };
            };
          };
        }
      ).Telegram?.WebApp;
      tg?.HapticFeedback?.notificationOccurred?.('error');
      if (typeof tg?.showAlert === 'function') {
        tg.showAlert(message);
      }
    } catch {}
  };

  useEffect(() => {
    if (!toastState) return;
    const t = setTimeout(() => setToastState(null), 3000);
    return () => clearTimeout(t);
  }, [toastState]);

  // Real-time 1-second clock for 2-Hour Ad Batch Cooldown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate 2-Hour Batch Status (10 ads per 2 hours)
  const batchLimit = Math.max(1, Number(config.adsPerBatchLimit || 10));
  const batchCooldownMs = Math.max(1, Number(config.adBatchCooldownHours || 2)) * 3600 * 1000;
  const elapsedSinceCycle = user.batchCycleStartAt ? nowMs - user.batchCycleStartAt : batchCooldownMs + 1000;
  const isBatchCycleExpired = elapsedSinceCycle >= batchCooldownMs;
  const currentBatchWatched = isBatchCycleExpired ? 0 : user.batchAdsWatched;
  const isBatchLocked = !isBatchCycleExpired && currentBatchWatched >= batchLimit;
  const batchRemainingSeconds = isBatchLocked
    ? Math.max(0, Math.ceil((batchCooldownMs - elapsedSinceCycle) / 1000))
    : 0;

  // Auto-reset batchAdsWatched when 2 hours have elapsed
  useEffect(() => {
    if (user.batchAdsWatched > 0 && isBatchCycleExpired) {
      setUser((prev) => ({
        ...prev,
        batchAdsWatched: 0,
        batchCycleStartAt: 0,
      }));
      updateRealUserInFirestore(user.telegramId, {
        batchAdsWatched: 0,
        batchCycleStartAt: 0,
      });
    }
  }, [isBatchCycleExpired, user.batchAdsWatched, user.telegramId]);

  // Initialize Telegram WebApp & Real Firebase Subscriptions
  useEffect(() => {
    document.documentElement.classList.add('dark');
    try {
      const tg = (
        window as unknown as {
          Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } };
        }
      ).Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    const unsubConfig = subscribeToAppConfig((liveCfg) => {
      setConfig(liveCfg);
    });

    const unsubTasks = subscribeToTasks((liveTasks) => {
      setTasks(liveTasks);
    });

    const unsubPromos = subscribeToPromos((livePromos) => {
      setPromoCodes(livePromos);
    });

    let unsubUser: (() => void) | null = null;
    initAndSyncRealUser(config, (liveUser) => {
      setUser(liveUser);
    }).then((unsub) => {
      unsubUser = unsub;
    });

    return () => {
      unsubConfig();
      unsubTasks();
      unsubPromos();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Load real Leaderboard & User History
  useEffect(() => {
    if (activePage === 'giveaway') {
      setLoadingLeaderboard(true);
      fetchRealLeaderboard(user.telegramId)
        .then((rows) => setLeaderboard(rows))
        .finally(() => setLoadingLeaderboard(false));
    }
    if (activePage === 'withdraw' && showWithdrawHistory) {
      fetchRealUserHistory(user.telegramId).then(({ transactions: txs, withdrawals: wds }) => {
        if (txs.length > 0) setTransactions(txs);
        if (wds.length > 0) setWithdrawals(wds);
      });
    }
  }, [activePage, showWithdrawHistory, user.telegramId]);

  // Splash animation
  useEffect(() => {
    if (!showSplash) return;
    const interval = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setShowSplash(false), 180);
          return 100;
        }
        return prev + 25;
      });
    }, 160);
    return () => clearInterval(interval);
  }, [showSplash]);

  // Persist states locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASK_STATES, JSON.stringify(taskStates));
  }, [taskStates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(withdrawals));
  }, [withdrawals]);

  // Ad Cooldown Tick
  useEffect(() => {
    if (adCooldown <= 0) return;
    const t = setInterval(() => {
      setAdCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [adCooldown]);

  // Official Channel Countdown Tick
  useEffect(() => {
    if (officialChannelCountdown <= 0) return;
    const t = setInterval(() => {
      setOfficialChannelCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [officialChannelCountdown]);

  // Tick active task timers
  useEffect(() => {
    const keys = Object.keys(activeTaskTimers);
    if (keys.length === 0) return;
    const t = setInterval(() => {
      setActiveTaskTimers((prev) => {
        const next = { ...prev };
        for (const taskId of Object.keys(next)) {
          if (next[taskId] > 1) {
            next[taskId] -= 1;
          } else {
            delete next[taskId];
            setTaskStates((oldStates) => ({
              ...oldStates,
              [taskId]: {
                ...(oldStates[taskId] || {
                  taskId,
                  openedAt: Date.now(),
                  elapsedSeconds: 8,
                  telegramSubscribed: true,
                  claimedCount: 0,
                  lastClaimedDate: null,
                }),
                unlockedToClaim: true,
              },
            }));
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeTaskTimers]);

  // Credit User Reward
  const creditUserReward = (
    amount: number,
    type: TransactionItem['type'],
    description: string,
    extraPatch?: Partial<UserProfile>
  ) => {
    const nextBalance = user.balance + amount;
    const nextTodayEarned = user.todayEarned + amount;
    const nextTotalEarned = user.totalEarned + amount;

    setUser((prev) => ({
      ...prev,
      balance: nextBalance,
      todayEarned: nextTodayEarned,
      totalEarned: nextTotalEarned,
      ...(extraPatch || {}),
    }));

    const newTx: TransactionItem = {
      id: 'tx-' + Date.now(),
      userId: user.telegramId,
      type,
      amount,
      description,
      createdAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };
    setTransactions((prev) => [newTx, ...prev]);

    updateRealUserInFirestore(
      user.telegramId,
      {
        balance: nextBalance,
        todayEarned: nextTodayEarned,
        totalEarned: nextTotalEarned,
        ...(extraPatch || {}),
      },
      { type, amount, description }
    );
  };

  // Verify Telegram Channel Membership via Telegram Bot API getChatMember
  const checkTelegramChannelSubscription = async (
    channelHandleOrUrl: string
  ): Promise<{ subscribed: boolean; checkedViaApi: boolean; channelName: string }> => {
    let chatId = (channelHandleOrUrl || '@jmjads').trim();
    if (chatId.includes('t.me/')) {
      const slug = chatId.split('t.me/')[1]?.split(/[/?#]/)[0] || 'jmjads';
      chatId = `@${slug}`;
    } else if (!chatId.startsWith('@')) {
      chatId = `@${chatId}`;
    }

    if (config.telegramBotToken && !String(user.telegramId).startsWith('tg_')) {
      try {
        const apiUrl = `https://api.telegram.org/bot${config.telegramBotToken}/getChatMember?chat_id=${encodeURIComponent(
          chatId
        )}&user_id=${encodeURIComponent(user.telegramId)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (data && data.ok && data.result) {
          const status = data.result.status;
          const isMember = ['member', 'administrator', 'creator'].includes(status);
          return { subscribed: isMember, checkedViaApi: true, channelName: chatId };
        }
      } catch (e) {
        console.warn('Telegram getChatMember error:', e);
      }
    }

    return { subscribed: true, checkedViaApi: false, channelName: chatId };
  };

  // Open Official Channel https://t.me/jmjads directly inside Telegram
  const handleOpenOfficialChannel = () => {
    const channelUrl = config.officialChannelUrl || 'https://t.me/jmjads';
    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            openTelegramLink?: (url: string) => void;
          };
        };
      }
    ).Telegram?.WebApp;

    if (tg?.openTelegramLink && channelUrl.includes('t.me')) {
      tg.openTelegramLink(channelUrl);
    } else {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    }

    setOfficialChannelOpenedAt(Date.now());
    setOfficialChannelCountdown(8);
    showToast('চ্যানেল সাবস্ক্রাইব করে ৮ সেকেন্ড পর ভেরিফাই চাপুন');
  };

  // Verify & Claim Official Channel https://t.me/jmjads
  const handleVerifyOfficialChannel = async () => {
    if (user.officialChannelClaimed) {
      showToast('আপনি ইতিমধ্যে অফিশিয়াল চ্যানেল বোনাস ক্লেইম করেছেন!');
      return;
    }

    if (!officialChannelOpenedAt) {
      triggerTelegramNativeAlert(
        '⚠️ আপনি এখনো https://t.me/jmjads চ্যানেলে জয়েন করেননি! আগে "সাবস্ক্রাইব করুন" বাটনে ট্যাপ করে চ্যানেলে জয়েন করুন।'
      );
      return;
    }

    const elapsedSec = Math.floor((Date.now() - officialChannelOpenedAt) / 1000);
    if (officialChannelCountdown > 0 || elapsedSec < 8) {
      triggerTelegramNativeAlert(
        `⚠️ চ্যানেল সাবস্ক্রাইব না করেই ফিরে এসেছেন! অনুগ্রহ করে https://t.me/jmjads চ্যানেলে জয়েন করে আরও ${Math.max(
          1,
          8 - elapsedSec
        )} সেকেন্ড অপেক্ষা করুন।`
      );
      return;
    }

    setVerifyingOfficialChannel(true);
    const checkResult = await checkTelegramChannelSubscription(
      config.officialChannelUsername || '@jmjads'
    );
    setVerifyingOfficialChannel(false);

    if (!checkResult.subscribed) {
      triggerTelegramNativeAlert(
        `❌ ভেরিফিকেশন ব্যর্থ! আপনি এখনো ${checkResult.channelName} চ্যানেলে সাবস্ক্রাইব করেননি। সাবস্ক্রাইব ছাড়া বোনাস ক্লেইম হবে না!`
      );
      return;
    }

    const rewardAmt = Number(config.officialChannelReward || 30);
    creditUserReward(rewardAmt, 'channel_bonus', 'অফিশিয়াল চ্যানেল (@jmjads) জয়েন বোনাস', {
      officialChannelClaimed: true,
    });
    showToast(`অভিনন্দন! চ্যানেল সাবস্ক্রাইব বোনাস +৳${rewardAmt} যোগ হয়েছে`);
  };

  const isTaskClaimed = (task: TaskItem): boolean => {
    if (task.id === 'official_jmjads_channel' && user.officialChannelClaimed) {
      return true;
    }
    const st = taskStates[task.id];
    if (!st) return false;
    if (task.frequency === 'once') {
      return st.claimedCount > 0;
    }
    return st.lastClaimedDate === getBangladeshDateKey();
  };

  // Watch Monetag Rewarded Ad (10 Ads every 2 hours)
  const handleStartWatchMonetagAd = () => {
    if (isBatchLocked) {
      showToast(`এই স্লটের ${batchLimit}টি অ্যাড শেষ! ${formatCountdownHMS(batchRemainingSeconds)} পর আবার দেখুন`);
      return;
    }
    if (adCooldown > 0) {
      showToast(`অনুগ্রহ করে ${adCooldown} সেকেন্ড অপেক্ষা করুন`);
      return;
    }

    const nextBatchNumber = currentBatchWatched + 1;

    setAdModalState({
      open: true,
      reward: config.adReward,
      purpose: `Monetag অ্যাড (${nextBatchNumber}/${batchLimit})`,
      onCompleteCallback: () => {
        const nowTimestamp = Date.now();
        const cycleStart =
          currentBatchWatched === 0 || isBatchCycleExpired ? nowTimestamp : user.batchCycleStartAt || nowTimestamp;
        const nextAdsToday = user.todayAdsWatched + 1;
        const nextTotalAds = user.totalAdsWatched + 1;

        creditUserReward(
          config.adReward,
          'ad_reward',
          `Monetag বিজ্ঞাপন বোনাস (${nextBatchNumber}/${batchLimit})`,
          {
            batchAdsWatched: nextBatchNumber,
            batchCycleStartAt: cycleStart,
            todayAdsWatched: nextAdsToday,
            totalAdsWatched: nextTotalAds,
          }
        );
        setAdCooldown(config.adCooldownSeconds);

        if (nextBatchNumber >= batchLimit) {
          showToast(
            `১০টি অ্যাড সম্পন্ন! ${config.adBatchCooldownHours} ঘণ্টা পর আবার ১০টি অ্যাড আনলক হবে`
          );
        } else {
          showToast(`সফলভাবে ক্লেইম হয়েছে! +৳${config.adReward} যোগ হয়েছে`);
        }
      },
    });
  };

  // Open Real Task Link / Telegram Channel
  const handleOpenTask = (task: TaskItem) => {
    if (isTaskClaimed(task)) {
      showToast('এই টাস্কের রিওয়ার্ড ইতিমধ্যে ক্লেইম করেছেন!');
      return;
    }

    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            openTelegramLink?: (url: string) => void;
            openLink?: (url: string) => void;
          };
        };
      }
    ).Telegram?.WebApp;

    if (task.platform === 'telegram' && task.url.includes('t.me') && tg?.openTelegramLink) {
      tg.openTelegramLink(task.url);
    } else if (tg?.openLink) {
      tg.openLink(task.url);
    } else {
      window.open(task.url, '_blank', 'noopener,noreferrer');
    }

    const waitSec = task.requiredSeconds || 8;
    const openedTimestamp = Date.now();

    setActiveTaskTimers((prev) => ({ ...prev, [task.id]: waitSec }));
    setTaskStates((prev) => ({
      ...prev,
      [task.id]: {
        taskId: task.id,
        openedAt: openedTimestamp,
        elapsedSeconds: 0,
        telegramSubscribed: false,
        unlockedToClaim: false,
        claimedCount: prev[task.id]?.claimedCount || 0,
        lastClaimedDate: prev[task.id]?.lastClaimedDate || null,
      },
    }));

    if (task.platform === 'telegram') {
      showToast(`চ্যানেল সাবস্ক্রাইব করে ${waitSec} সেকেন্ড পর ক্লেইম করুন`);
    } else {
      showToast(`লিংকে ${waitSec} সেকেন্ড অপেক্ষা করে ক্লেইম করুন`);
    }
  };

  // Verify & Claim Task (with Telegram Native Alert on unsubscribed claim attempt)
  const handleVerifyAndClaimTask = async (task: TaskItem) => {
    if (isTaskClaimed(task)) {
      showToast('এই টাস্কটি ইতিমধ্যে সম্পন্ন হয়েছে!');
      return;
    }

    const st = taskStates[task.id];

    if (!st || !st.openedAt) {
      if (task.platform === 'telegram') {
        triggerTelegramNativeAlert(
          `⚠️ আপনি এখনো চ্যানেল সাবস্ক্রাইব করেননি! আগে "চ্যানেল ওপেন" বাটনে ট্যাপ করে সাবস্ক্রাইব করুন।`
        );
      } else {
        triggerTelegramNativeAlert('⚠️ আগে লিংক ওপেন করে কাজটি সম্পন্ন করুন, তারপর ক্লেইম করুন!');
      }
      return;
    }

    const secondsSinceOpen = Math.floor((Date.now() - st.openedAt) / 1000);
    const requiredSec = task.requiredSeconds || 8;

    if (activeTaskTimers[task.id] > 0 || secondsSinceOpen < requiredSec) {
      if (task.platform === 'telegram') {
        triggerTelegramNativeAlert(
          `⚠️ সাবস্ক্রাইব না করেই ফিরে এসেছেন! চ্যানেলে জয়েন করে অন্তত ${requiredSec} সেকেন্ড অপেক্ষা করুন।`
        );
      } else {
        triggerTelegramNativeAlert(
          `⏳ এখনো ${Math.max(1, requiredSec - secondsSinceOpen)} সেকেন্ড অপেক্ষা করা বাকি আছে!`
        );
      }
      return;
    }

    if (task.platform === 'telegram') {
      setVerifyingTaskId(task.id);
      const checkRes = await checkTelegramChannelSubscription(task.channelUsername || task.url);
      setVerifyingTaskId(null);

      if (!checkRes.subscribed) {
        triggerTelegramNativeAlert(
          `❌ আপনি এখনো ${checkRes.channelName} চ্যানেলে সাবস্ক্রাইব করেননি! সাবস্ক্রাইব না করলে বোনাস যোগ হবে না।`
        );
        return;
      }
    }

    const grantReward = () => {
      setTaskStates((prev) => ({
        ...prev,
        [task.id]: {
          ...st,
          telegramSubscribed: true,
          unlockedToClaim: true,
          claimedCount: (st.claimedCount || 0) + 1,
          lastClaimedDate: getBangladeshDateKey(),
        },
      }));

      const extraPatch: Partial<UserProfile> =
        task.id === 'official_jmjads_channel' ? { officialChannelClaimed: true } : {};

      creditUserReward(task.reward, 'task_reward', `${task.title} বোনাস`, extraPatch);
      showToast(`টাস্ক সম্পন্ন! +৳${task.reward} BDT ক্লেইম হয়েছে`);
    };

    if (task.requireMonetagAd) {
      setAdModalState({
        open: true,
        reward: task.reward,
        purpose: 'টাস্ক ভেরিফিকেশন অ্যাড',
        onCompleteCallback: grantReward,
      });
    } else {
      grantReward();
    }
  };

  // Handle Manual Referral Code Claim (100% solution when Telegram Bot /start drops referral param)
  const handleManualReferralClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRefInput.trim()) {
      showToast('বন্ধুর রেফার কোড বা আইডি লিখুন!');
      return;
    }
    if (user.referredBy) {
      showToast('আপনি ইতিমধ্যে রেফার বোনাস ক্লেইম করেছেন!');
      return;
    }

    setClaimingManualRef(true);
    const res = await claimReferralByCodeOrId(
      user.telegramId,
      manualRefInput,
      config.referralBonus,
      config.referredJoinBonus || 20
    );
    setClaimingManualRef(false);

    if (res.ok) {
      const joinBonus = res.inviteeBonusAdded || 0;
      setUser((prev) => ({
        ...prev,
        referredBy: manualRefInput.trim(),
        balance: prev.balance + joinBonus,
        todayEarned: prev.todayEarned + joinBonus,
        totalEarned: prev.totalEarned + joinBonus,
      }));
      setManualRefInput('');
      showToast(res.message);
    } else {
      triggerTelegramNativeAlert(res.message);
    }
  };

  // Handle Promo Code Redeem
  const handleRedeemPromoCode = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) {
      showToast('প্রোমো কোড লিখুন!');
      return;
    }
    if (user.redeemedPromoCodes.includes(clean)) {
      showToast('আপনি ইতিমধ্যে এই কোডটি ব্যবহার করেছেন!');
      return;
    }
    const found = promoCodes.find((p) => p.code.toUpperCase() === clean);
    if (!found) {
      showToast('ভুল প্রোমো কোড! সঠিক কোড দিন।');
      return;
    }
    if (!found.active) {
      showToast('এই প্রোমো কোডটি বর্তমানে ইনঅ্যাক্টিভ (বন্ধ) আছে!');
      return;
    }
    if (found.usedCount >= found.maxUses) {
      showToast('এই প্রোমো কোডের ব্যবহারের লিমিট শেষ হয়ে গেছে!');
      return;
    }

    setPromoCodes((prev) =>
      prev.map((p) => (p.code.toUpperCase() === clean ? { ...p, usedCount: p.usedCount + 1 } : p))
    );
    await incrementPromoUsageInFirestore(found.code);

    const desc = found.rewardTitle
      ? `প্রোমো বোনাস: ${found.rewardTitle} (${clean})`
      : `প্রোমো কোড (${clean}) বোনাস`;

    creditUserReward(found.reward, 'promo_code', desc, {
      redeemedPromoCodes: [...user.redeemedPromoCodes, clean],
    });
    setInlinePromoCode('');
    showToast(`প্রোমো সফল! +৳${found.reward} BDT (${found.rewardTitle || clean}) যোগ হয়েছে`);
  };

  // Submit Real Withdrawal Request
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(wdAmount);

    if (config.requireDailyAdsForWithdraw && currentBatchWatched < batchLimit && user.todayAdsWatched < batchLimit) {
      showToast(
        `উইথড্র করতে কমপক্ষে ${batchLimit}টি বিজ্ঞাপন দেখা সম্পন্ন করুন!`
      );
      return;
    }

    if (user.referralCount < config.requiredReferralsForWithdraw) {
      showToast(
        `উইথড্র করতে কমপক্ষে ${config.requiredReferralsForWithdraw}টি রেফারেল প্রয়োজন!`
      );
      return;
    }

    if (!wdAccount.trim() || wdAccount.trim().length < 10) {
      showToast('সঠিক পেমেন্ট একাউন্ট নম্বর দিন!');
      return;
    }

    if (!amountNum || amountNum < config.minWithdraw) {
      showToast(`ন্যূনতম উত্তোলন ৳${config.minWithdraw.toLocaleString('en-US')} BDT!`);
      return;
    }

    if (amountNum > user.balance) {
      showToast('আপনার ব্যালেন্সে পর্যাপ্ত টাকা নেই!');
      return;
    }

    const newWd: WithdrawRequest = {
      id: 'wd-' + Date.now(),
      userId: user.telegramId,
      userName: `${user.firstName} ${user.lastName}`.trim(),
      method: wdMethod,
      accountNumber: wdAccount.trim(),
      amount: amountNum,
      status: 'pending',
      createdAt: new Date().toLocaleDateString('bn-BD'),
    };

    setWithdrawals((prev) => [newWd, ...prev]);

    const nextBalance = user.balance - amountNum;
    const nextWithdrawn = user.totalWithdrawn + amountNum;

    setUser((prev) => ({
      ...prev,
      balance: nextBalance,
      totalWithdrawn: nextWithdrawn,
    }));

    const newTx: TransactionItem = {
      id: 'tx-' + Date.now(),
      userId: user.telegramId,
      type: 'withdraw',
      amount: -amountNum,
      description: `${wdMethod} উত্তোলন (${wdAccount.trim()})`,
      createdAt: 'এইমাত্র',
    };
    setTransactions((prev) => [newTx, ...prev]);

    await submitRealWithdrawToFirestore(newWd);
    await updateRealUserInFirestore(
      user.telegramId,
      {
        balance: nextBalance,
        totalWithdrawn: nextWithdrawn,
      },
      {
        type: 'withdraw',
        amount: -amountNum,
        description: `${wdMethod} উত্তোলন (${wdAccount.trim()})`,
      }
    );

    setWdAccount('');
    setWdAmount('');
    showToast('আপনার উত্তোলন রিকোয়েস্ট সফলভাবে জমা হয়েছে!');
  };

  // Real Dynamic Referral Link + Short Referral Code
  const referralLink = buildDynamicReferralUrl(config, user.telegramId);
  const myReferCode = user.referralCode || generateShortReferCode(user.telegramId);

  const handleCopyRefLink = () => {
    navigator.clipboard.writeText(referralLink);
    showToast('রেফারেল লিংক কপি করা হয়েছে!');
  };

  const handleCopyRefCode = () => {
    navigator.clipboard.writeText(myReferCode);
    showToast(`রেফার কোড (${myReferCode}) কপি করা হয়েছে!`);
  };

  const handleShareRefLink = () => {
    const shareText = `🔥 ${config.siteName}-এ কাজ করে প্রতিদিন টাকা আয় করুন! আমার রেফার কোড: ${myReferCode} (বোনাস ৳${config.welcomeBonus}):`;
    const tg = (
      window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }
    ).Telegram?.WebApp;
    const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
      shareText
    )}`;

    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(tgShareUrl);
    } else if (navigator.share) {
      navigator.share({ title: config.siteName, text: shareText, url: referralLink }).catch(() => {});
    } else {
      window.open(tgShareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Task Counts
  const activeTasks = tasks.filter((t) => t.active);
  const remainingTasksCount = activeTasks.filter((t) => !isTaskClaimed(t)).length;
  const completedTodayCount = activeTasks.filter((t) => isTaskClaimed(t)).length;
  const filteredTasks = activeTasks.filter((t) => (taskFilter === 'all' ? true : t.platform === taskFilter));

  const tgTaskCount = activeTasks.filter((t) => t.platform === 'telegram' && !isTaskClaimed(t)).length;
  const ytTaskCount = activeTasks.filter((t) => t.platform === 'youtube' && !isTaskClaimed(t)).length;
  const ttTaskCount = activeTasks.filter((t) => t.platform === 'tiktok' && !isTaskClaimed(t)).length;

  // Fixed Dark Mode Theme Classes (Light Mode Removed as requested)
  const bgCanvas = 'bg-[#0b0613] text-[#fdf8f5]';
  const cardSurface = 'glass-card-dark';
  const heroPrism = 'hero-prism-dark text-white';
  const innerGlassStat = 'bg-white/[0.06] border border-amber-400/20';

  // Prominent Top Official Channel Join Card Component (https://t.me/jmjads)
  const renderProminentOfficialChannelBanner = () => (
    <div className="rounded-3xl p-4 border-2 border-amber-400/50 bg-gradient-to-r from-[#2c1248] via-[#1f0d38] to-[#33102d] shadow-xl shadow-amber-500/15 glass-reflect">
      <div className="flex items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-500/30">
            <Send className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-amber-300 truncate">
                অফিশিয়াল চ্যানেল জয়েন করুন
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/25 border border-rose-400/40 text-[10px] font-extrabold text-rose-300 whitespace-nowrap">
                জরুরি
              </span>
            </div>
            <p className="text-[11px] text-amber-100/80 font-mono-num truncate mt-0.5">
              {config.officialChannelUrl || 'https://t.me/jmjads'} · বোনাস +৳{config.officialChannelReward || 30}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleOpenOfficialChannel}
          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-[#14081f] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span>সাবস্ক্রাইব করুন</span>
        </button>

        {user.officialChannelClaimed ? (
          <button
            type="button"
            disabled
            className="py-2.5 px-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-1.5 opacity-80 cursor-not-allowed whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>ভেরিফাইড ✓</span>
          </button>
        ) : officialChannelCountdown > 0 ? (
          <button
            type="button"
            onClick={handleVerifyOfficialChannel}
            className="py-2.5 px-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono-num font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
            <span>অপেক্ষা ({officialChannelCountdown}s)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleVerifyOfficialChannel}
            disabled={verifyingOfficialChannel}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/25 cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{verifyingOfficialChannel ? 'যাচাই হচ্ছে...' : `ভেরিফাই (+৳${config.officialChannelReward || 30})`}</span>
          </button>
        )}
      </div>
    </div>
  );

  // Startup Splash Screen
  if (showSplash) {
    const step = splashProgress < 45 ? 1 : splashProgress < 80 ? 2 : 3;
    return (
      <div className="min-h-screen bg-[#0b0613] text-amber-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="w-72 h-72 rounded-full bg-amber-500/20 blur-3xl absolute -top-20 -left-20 ambient-orb pointer-events-none" />
        <div className="w-72 h-72 rounded-full bg-rose-600/20 blur-3xl absolute -bottom-20 -right-20 ambient-orb pointer-events-none" />

        <div className="w-full max-w-sm text-center z-10 flex flex-col items-center">
          <div className="mb-3">
            <BrandLogo siteName={config.siteName} isDark={true} size="lg" />
          </div>

          <p className="text-xs text-amber-100/80">{config.tagline}</p>

          <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>ইনস্ট্যান্ট আয় · সারাদিন কাজ · দ্রুত পেমেন্ট</span>
          </div>

          <div className="w-full mt-7 rounded-3xl p-6 glass-card-dark glass-reflect">
            <div className="w-9 h-9 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-5" />

            <div className="flex items-center justify-between px-3 mb-5">
              {[
                { num: 1, label: 'লগইন' },
                { num: 2, label: 'ভেরিফাই' },
                { num: 3, label: 'ড্যাশবোর্ড' },
              ].map((s, idx) => (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-num transition-all ${
                        step >= s.num
                          ? 'bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-500/30'
                          : 'bg-white/10 text-amber-100/50 border border-white/15'
                      }`}
                    >
                      {s.num}
                    </div>
                    <span className="text-[11px] text-amber-100/80 whitespace-nowrap">{s.label}</span>
                  </div>
                  {idx < 2 && <div className="flex-1 h-[1px] bg-amber-500/25 mx-2 -mt-4" />}
                </React.Fragment>
              ))}
            </div>

            <div className="w-full h-2 rounded-full bg-amber-500/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 transition-all duration-200"
                style={{ width: `${splashProgress}%` }}
              />
            </div>

            <div className="mt-3 text-xs font-mono-num text-amber-200/80">
              {splashProgress}% — {step === 1 ? 'লগইন হচ্ছে...' : step === 2 ? 'একাউন্ট যাচাই...' : 'ড্যাশবোর্ড প্রস্তুত!'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-x-hidden ${bgCanvas}`}>
      {/* TOP NOTIFICATION TOAST WITH BORDER & 3-SECOND SHRINKING BOTTOM LINE */}
      {toastState && (
        <div
          key={toastState.id}
          className="fixed top-3.5 left-1/2 z-[100] w-[92%] max-w-[440px] rounded-2xl border-2 overflow-hidden shadow-2xl backdrop-blur-2xl animate-toast-top bg-[#22103b]/95 border-amber-400/55 text-amber-50 shadow-amber-500/15"
        >
          <div className="px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold leading-snug">{toastState.msg}</span>
          </div>
          {/* 3-Second Shrinking Progress Line */}
          <div className="w-full h-1 bg-amber-500/15">
            <div className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 toast-timer-bar" />
          </div>
        </div>
      )}

      {/* Ambient Light Reflection Graphics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="w-96 h-96 rounded-full blur-3xl absolute -top-28 -left-28 ambient-orb bg-amber-500/14" />
        <div className="w-96 h-96 rounded-full blur-3xl absolute top-1/3 -right-28 ambient-orb bg-rose-600/14" />
        <div className="w-80 h-80 rounded-full blur-3xl absolute -bottom-24 left-1/4 ambient-orb bg-purple-600/14" />
      </div>

      {/* Main Mobile Container */}
      <div className="w-full max-w-[500px] mx-auto min-h-screen pb-28 relative z-10">
        {/* TOP HEADER (Light mode button removed as requested) */}
        <header className="sticky top-0 z-30 px-4 py-2.5 backdrop-blur-xl border-b flex items-center justify-between gap-2 bg-[#0b0613]/88 border-amber-500/15">
          {/* Zone 1: Clean Compact Name Only */}
          <button
            type="button"
            onClick={() => setActivePage('home')}
            className="text-left cursor-pointer focus:outline-none shrink-0"
          >
            <BrandLogo siteName={config.siteName} isDark={true} size="md" />
          </button>

          {/* Zone 2: Compact Live Balance */}
          <button
            type="button"
            onClick={() => setActivePage('withdraw')}
            className="px-3 py-1 rounded-xl border text-xs font-mono-num font-bold flex items-center gap-1.5 cursor-pointer shrink-0 bg-amber-500/10 border-amber-500/30 text-amber-300"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="whitespace-nowrap">৳{user.balance.toFixed(2)}</span>
          </button>

          {/* Zone 3: Quick Channel Join, Bonus & Notice */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenOfficialChannel}
              title="অফিশিয়াল টেলিগ্রাম চ্যানেল (@jmjads)"
              className="px-2.5 h-8 rounded-xl border bg-amber-500/15 border-amber-400/35 text-amber-300 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
            >
              <Send className="w-3 h-3 text-amber-400 shrink-0" />
              <span>চ্যানেল</span>
            </button>

            <button
              type="button"
              onClick={() => setBonusModalOpen(true)}
              title="ডেইলি বোনাস ও প্রোমো কোড"
              className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer transition-transform active:scale-95 bg-[#1a0f2e] border-rose-500/30 text-rose-400"
            >
              <Gift className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              title="গুরুত্বপূর্ণ নোটিশ"
              className="w-8 h-8 rounded-xl border flex items-center justify-center relative cursor-pointer transition-transform active:scale-95 bg-[#1a0f2e] border-amber-500/25 text-amber-300"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
            </button>
          </div>
        </header>

        {/* MAIN PAGE CONTENT */}
        <main className="px-4 pt-4 space-y-4">
          {/* =========================================================
              PAGE 1: HOME DASHBOARD
          ========================================================= */}
          {activePage === 'home' && (
            <div className="space-y-4 animate-fadeIn">
              {/* TOP PROMINENT OFFICIAL CHANNEL BANNER (https://t.me/jmjads) */}
              {renderProminentOfficialChannelBanner()}

              {/* Greeting & Rules Button Row */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold tracking-tight truncate">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Telegram Member'}
                  </h2>
                  <p className="text-[11px] opacity-70 truncate">
                    ID: <span className="font-mono-num">{user.telegramId}</span> · কোড:{' '}
                    <span className="font-mono-num text-amber-400 font-bold">{myReferCode}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setNoticeOpen(true)}
                  className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25"
                >
                  <span>নিয়মাবলী</span>
                  <ListChecks className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </button>
              </div>

              {/* MASTER SPECULAR GLASS BALANCE CARD */}
              <div className={`rounded-3xl p-5 relative overflow-hidden glass-reflect ${heroPrism}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
                    <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>মোট ব্যালেন্স</span>
                  </div>
                  <span className="text-xs font-mono-num font-bold opacity-85">BDT ৳</span>
                </div>

                <div className="mt-2 mb-5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-400">৳</span>
                  <span className="text-4xl font-extrabold font-mono-num tracking-tight truncate">
                    {user.balance.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className={`rounded-2xl p-3.5 backdrop-blur-md ${innerGlassStat}`}>
                    <div className="text-[11px] opacity-80 truncate">আজকের আয়</div>
                    <div className="text-base font-extrabold font-mono-num mt-0.5 text-amber-400 truncate">
                      ৳{user.todayEarned.toFixed(2)}
                    </div>
                  </div>

                  <div className={`rounded-2xl p-3.5 backdrop-blur-md ${innerGlassStat}`}>
                    <div className="text-[11px] opacity-80 truncate">রেফার আয়</div>
                    <div className="text-base font-extrabold font-mono-num mt-0.5 text-rose-400 truncate">
                      ৳{user.referralEarned.toFixed(2)}
                    </div>
                  </div>

                  <div className={`rounded-2xl p-3.5 backdrop-blur-md ${innerGlassStat}`}>
                    <div className="text-[11px] opacity-80 truncate">মোট ইনকাম</div>
                    <div className="text-base font-extrabold font-mono-num mt-0.5 truncate">
                      ৳{user.totalEarned.toFixed(2)}
                    </div>
                  </div>

                  <div className={`rounded-2xl p-3.5 backdrop-blur-md ${innerGlassStat}`}>
                    <div className="text-[11px] opacity-80 truncate">মোট উত্তোলন</div>
                    <div className="text-base font-extrabold font-mono-num mt-0.5 text-purple-400 truncate">
                      ৳{user.totalWithdrawn.toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePage('withdraw')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-[#14081f] font-extrabold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span>টাকা উত্তোলন করুন →</span>
                </button>
              </div>

              {/* 2-Hour Batch Ad Strip (10 Ads every 2 hours) */}
              <div className={`rounded-2xl p-4 flex items-center justify-between gap-3 ${cardSurface}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">
                      অ্যাড স্লট ({config.adBatchCooldownHours} ঘণ্টা):{' '}
                      <span className="text-amber-400 font-mono-num">
                        {currentBatchWatched}/{batchLimit}টি
                      </span>
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5 truncate">
                      {isBatchLocked ? (
                        <span className="text-rose-400 font-mono-num font-bold">
                          পরবর্তী স্লট: {formatCountdownHMS(batchRemainingSeconds)}
                        </span>
                      ) : (
                        `প্রতি ২ ঘণ্টা পর পর ${batchLimit}টি অ্যাড · প্রতি অ্যাড ৳${config.adReward}`
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartWatchMonetagAd}
                  disabled={isBatchLocked}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-extrabold flex items-center gap-1 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <span>{isBatchLocked ? 'অপেক্ষা' : 'কাজ করুন'}</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {/* 4-Card Bento Quick Grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActivePage('ads')}
                  className={`rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 ${cardSurface}`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                  <div className="text-base font-extrabold font-mono-num whitespace-nowrap">
                    {currentBatchWatched}/{batchLimit}
                  </div>
                  <div className="text-xs opacity-80 whitespace-nowrap">২ ঘণ্টায় ১০ অ্যাড</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePage('withdraw')}
                  className={`rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 ${cardSurface}`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold font-mono-num whitespace-nowrap">BDT ৳</div>
                  <div className="text-xs opacity-80 whitespace-nowrap">উত্তোলন করুন</div>
                </button>

                <button
                  type="button"
                  onClick={() => setBonusModalOpen(true)}
                  className={`rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 ${cardSurface}`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold whitespace-nowrap">ডেইলি ও প্রোমো</div>
                  <div className="text-xs opacity-80 whitespace-nowrap">চেক-ইন ও কোড</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTaskFilter('all');
                    setActivePage('tasks');
                  }}
                  className={`rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 ${cardSurface}`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <div className="text-base font-extrabold whitespace-nowrap">সকল টাস্ক</div>
                  <div className="text-xs opacity-80 whitespace-nowrap">{remainingTasksCount}টি বাকি</div>
                </button>
              </div>

              {/* PROMO CODE QUICK CLAIM BOX ON HOME */}
              <div className={`rounded-3xl p-4 space-y-2.5 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold flex items-center gap-1.5 text-amber-400">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>প্রোমো কোড রিডিম করুন</span>
                  </div>
                  <a
                    href={config.officialChannelUrl || 'https://t.me/jmjads'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-rose-400 hover:underline whitespace-nowrap"
                  >
                    @jmjads চ্যানেলে কোড পান ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inlinePromoCode}
                    onChange={(e) => setInlinePromoCode(e.target.value.toUpperCase())}
                    placeholder="এখানে প্রোমো কোড লিখুন..."
                    className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-xs font-mono-num font-bold outline-none border bg-[#170b28] border-amber-500/35 text-amber-50"
                  />
                  <button
                    type="button"
                    onClick={() => handleRedeemPromoCode(inlinePromoCode)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 text-[#14081f] text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    ক্লেইম করুন
                  </button>
                </div>
              </div>

              {/* DUAL-MODE REFER & EARN CARD (Link + Manual Code Entry for Telegram Start Fix) */}
              <div className={`rounded-3xl p-5 space-y-3.5 ${cardSurface}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Gift className="w-4 h-4 text-amber-500 shrink-0" />
                    <h3 className="text-sm font-extrabold truncate">বন্ধু রেফার করে আয়</h3>
                  </div>
                  <span className="text-xs font-mono-num font-bold text-amber-400 whitespace-nowrap shrink-0">
                    {user.referralCount} জন রেফার
                  </span>
                </div>

                <p className="text-xs opacity-80 leading-relaxed">
                  প্রতিটি রেফারে আপনি পাবেন <b className="text-amber-400">৳{config.referralBonus} BDT</b>। আপনার বন্ধু ডিরেক্ট লিংক অথবা আপনার <b>রেফার কোড</b> বসালেই সাথে সাথে রেফার কাউন্ট হবে!
                </p>

                {/* User's Unique Short Referral Code Box */}
                <div className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 ${innerGlassStat}`}>
                  <div className="min-w-0">
                    <div className="text-[10px] opacity-70">আপনার রেফার কোড (বন্ধুকে দিন):</div>
                    <div className="text-sm font-extrabold font-mono-num text-amber-400 tracking-wider">
                      {myReferCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRefCode}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>কোড কপি</span>
                  </button>
                </div>

                {/* Direct Referral Link Box */}
                <div className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 ${innerGlassStat}`}>
                  <span className="text-xs font-mono-num text-amber-300 truncate">{referralLink}</span>
                  <button
                    type="button"
                    onClick={handleCopyRefLink}
                    className="p-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleCopyRefLink}
                    className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-[#14081f] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    <span>লিংক কপি</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareRefLink}
                    className="py-3 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>শেয়ার করুন</span>
                  </button>
                </div>

                {/* Instant Referral Code Claim Box (For users who joined via Telegram Start and didn't get tracked automatically) */}
                {!user.referredBy ? (
                  <form
                    onSubmit={handleManualReferralClaim}
                    className="pt-3 border-t border-amber-500/20 space-y-2"
                  >
                    <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>কারো লিংকে এসেছেন? বন্ধুর রেফার কোড বসান (+৳{config.referredJoinBonus || 20} বোনাস):</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualRefInput}
                        onChange={(e) => setManualRefInput(e.target.value)}
                        placeholder="যেমন: JMJ123456 বা ইউজার আইডি"
                        className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-xs font-mono-num font-bold outline-none border bg-[#170b28] border-amber-500/35 text-amber-50"
                      />
                      <button
                        type="submit"
                        disabled={claimingManualRef}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {claimingManualRef ? 'যাচাই...' : 'বোনাস নিন'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="pt-2 border-t border-amber-500/15 text-[11px] text-amber-400/90 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>রেফার সংযুক্ত আছে (রেফারকারী: #{String(user.referredBy).slice(-6)})</span>
                  </div>
                )}
              </div>

              {/* REFERRAL GIVEAWAY CARD */}
              <div
                onClick={() => setActivePage('giveaway')}
                className={`rounded-3xl p-5 cursor-pointer transition-transform active:scale-[0.99] glass-reflect ${cardSurface}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-extrabold truncate">রেফার গিভয়ে ও লিডারবোর্ড</span>
                  </div>
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> LIVE
                  </span>
                </div>

                <div className="text-2xl font-extrabold font-mono-num text-amber-400 my-1">
                  ৳{config.giveawayPrizePool.toLocaleString('en-US')} BDT
                </div>
                <p className="text-xs opacity-85">
                  {config.giveawayRuleShortText || 'সবথেকে বেশি রেফার করে টপ ১০-এ থাকলেই পাবেন এই গিভয়ে পুরস্কার!'}
                </p>
              </div>
            </div>
          )}

          {/* =========================================================
              PAGE 2: TASKS CENTER
          ========================================================= */}
          {activePage === 'tasks' && (
            <div className="space-y-4 animate-fadeIn">
              {/* TOP PROMINENT OFFICIAL CHANNEL BANNER (https://t.me/jmjads) */}
              {renderProminentOfficialChannelBanner()}

              <div className={`rounded-3xl p-5 glass-reflect ${heroPrism}`}>
                <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>টাস্ক সেন্টার</span>
                </div>

                <div className="text-2xl font-extrabold mt-1.5">
                  <span className="font-mono-num text-amber-400">{remainingTasksCount}</span> টি টাস্ক বাকি আছে
                </div>
                <p className="text-xs opacity-80 mt-1 truncate">
                  টেলিগ্রাম · ইউটিউব · টিকটক · ফেসবুক টাস্ক
                </p>

                <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
                  <div className={`px-3.5 py-2 rounded-xl font-semibold text-center whitespace-nowrap ${innerGlassStat}`}>
                    টেলিগ্রাম: {tgTaskCount}টি বাকি
                  </div>
                  <div className={`px-3.5 py-2 rounded-xl font-semibold text-center text-amber-400 whitespace-nowrap ${innerGlassStat}`}>
                    ✓ সম্পন্ন: {completedTodayCount}টি
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-4 flex items-start gap-3 ${cardSurface}`}>
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-amber-400">টেলিগ্রাম অটো-ভেরিফিকেশন সিস্টেম</h4>
                  <p className="text-xs opacity-80 mt-1 leading-relaxed">
                    চ্যানেল সাবস্ক্রাইব না করে ক্লেইম চাপলে টেলিগ্রাম অ্যালার্ট দিবে এবং বোনাস ব্লক হবে।
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: `সব (${activeTasks.length})` },
                  { id: 'telegram', label: `টেলিগ্রাম (${tgTaskCount})` },
                  { id: 'youtube', label: `ইউটিউব (${ytTaskCount})` },
                  { id: 'tiktok', label: `টিকটক (${ttTaskCount})` },
                  { id: 'facebook', label: 'ফেসবুক' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskFilter(tab.id as typeof taskFilter)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                      taskFilter === tab.id
                        ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/25'
                        : 'bg-[#1a0f2e] text-amber-100/75 border border-amber-500/20'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Real Tasks List */}
              {filteredTasks.length === 0 ? (
                <div className={`rounded-3xl p-8 text-center space-y-2 ${cardSurface}`}>
                  <ListChecks className="w-9 h-9 text-amber-500/60 mx-auto" />
                  <div className="text-sm font-extrabold">বর্তমানে কোনো টাস্ক নেই</div>
                  <p className="text-xs opacity-70">নতুন টাস্ক যুক্ত হলে এখানে সাথে সাথে দেখতে পাবেন।</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => {
                    const claimed = isTaskClaimed(task);
                    const st = taskStates[task.id];
                    const activeCountdown = activeTaskTimers[task.id] || 0;
                    const openedOnce = Boolean(st?.openedAt);
                    const isVerifying = verifyingTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-3xl p-5 space-y-3.5 transition-all ${cardSurface} ${
                          claimed ? 'opacity-75' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                              task.platform === 'telegram'
                                ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                : task.platform === 'youtube'
                                ? 'bg-rose-500/15 border-rose-500/35 text-rose-500'
                                : 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                            }`}
                          >
                            {task.platform === 'telegram' && <Send className="w-5 h-5" />}
                            {task.platform === 'youtube' && <Youtube className="w-5 h-5" />}
                            {task.platform === 'tiktok' && <Music2 className="w-5 h-5" />}
                            {(task.platform === 'facebook' || task.platform === 'custom') && (
                              <Globe className="w-5 h-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-extrabold leading-snug truncate">{task.title}</h4>
                            <div className="text-[11px] opacity-75 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-amber-500">
                                {task.platform === 'telegram'
                                  ? 'টেলিগ্রাম'
                                  : task.platform === 'youtube'
                                  ? 'ইউটিউব'
                                  : task.platform === 'tiktok'
                                  ? 'টিকটক'
                                  : 'সোশ্যাল'}
                              </span>
                              <span>·</span>
                              <span>{task.frequency === 'daily' ? 'দিনে ১ বার' : 'একবার'}</span>
                              {task.channelUsername && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono-num truncate">{task.channelUsername}</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs opacity-80 mt-1 line-clamp-1">{task.subtitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <div className="font-extrabold text-amber-500 font-mono-num">
                            রিওয়ার্ড: +৳{Number(task.reward).toFixed(2)} BDT
                          </div>
                          <div className="text-xs opacity-75 font-mono-num">
                            {claimed ? '✓ সম্পন্ন' : `${task.requiredSeconds}s অপেক্ষা`}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenTask(task)}
                            className="py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border cursor-pointer transition-all whitespace-nowrap bg-white/5 border-amber-500/25 text-amber-100 hover:bg-white/10"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                            <span>
                              {task.platform === 'telegram'
                                ? 'চ্যানেল ওপেন'
                                : task.platform === 'youtube' || task.platform === 'tiktok'
                                ? 'ভিডিও খুলুন'
                                : 'লিংক খুলুন'}
                            </span>
                          </button>

                          {claimed ? (
                            <button
                              type="button"
                              disabled
                              className="py-3 px-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 opacity-70 cursor-not-allowed whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>ক্লেইমড</span>
                            </button>
                          ) : activeCountdown > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyAndClaimTask(task)}
                              className="py-3 px-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono-num font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
                              <span>অপেক্ষা ({activeCountdown}s)</span>
                            </button>
                          ) : !openedOnce ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyAndClaimTask(task)}
                              className="py-3 px-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 opacity-80 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>চেক ও ক্লেইম</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVerifyAndClaimTask(task)}
                              disabled={isVerifying}
                              className="py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{isVerifying ? 'যাচাই হচ্ছে...' : 'চেক ও ক্লেইম'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              PAGE 3: MONETAG ADS WATCH (10 Ads Every 2 Hours)
          ========================================================= */}
          {activePage === 'ads' && (
            <div className="space-y-4 animate-fadeIn">
              {/* TOP PROMINENT OFFICIAL CHANNEL BANNER (https://t.me/jmjads) */}
              {renderProminentOfficialChannelBanner()}

              <div className={`rounded-3xl p-5 ${cardSurface}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold">
                    <ListChecks className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>চলতি স্লটের অ্যাড প্রগ্রেস ({config.adBatchCooldownHours} ঘণ্টা পর পর)</span>
                  </div>
                  <span className="text-sm font-extrabold font-mono-num text-amber-400">
                    {currentBatchWatched} / {batchLimit}
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-amber-500/20 overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (currentBatchWatched / batchLimit) * 100)}%`,
                    }}
                  />
                </div>

                {isBatchLocked ? (
                  <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center">
                    <div className="text-xs font-bold text-rose-300">
                      এই স্লটের {batchLimit}টি অ্যাড সম্পন্ন হয়েছে! পরবর্তী {batchLimit}টি অ্যাড খুলবে:
                    </div>
                    <div className="text-base font-extrabold font-mono-num text-amber-400 mt-1">
                      ⏳ {formatCountdownHMS(batchRemainingSeconds)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs opacity-80 text-center truncate">
                    এই স্লটে আর{' '}
                    <b className="text-amber-400 font-mono-num">
                      {Math.max(0, batchLimit - currentBatchWatched)}টি
                    </b>{' '}
                    অ্যাড বাকি · প্রতি অ্যাড{' '}
                    <b className="text-amber-400 font-mono-num">৳{config.adReward} BDT</b>
                  </p>
                )}
              </div>

              <div className={`rounded-3xl p-6 space-y-4 glass-reflect ${heroPrism}`}>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-xl shadow-amber-500/30">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold truncate">বিজ্ঞাপন দেখুন (Monetag)</h3>
                    <p className="text-xs opacity-85 truncate">
                      প্রতি {config.adBatchCooldownHours} ঘণ্টা পর পর {batchLimit}টি করে বিজ্ঞাপন দেখুন
                    </p>
                  </div>
                </div>

                <div className="text-xs font-extrabold text-amber-400 font-mono-num">
                  রিওয়ার্ড: +৳{config.adReward.toFixed(2)} BDT · Zone #{config.monetagZoneId}
                </div>

                <p className="text-xs opacity-85 leading-relaxed">
                  বিজ্ঞাপন সম্পূর্ণ দেখলে সাথে সাথে আপনার মূল ব্যালেন্সে টাকা যোগ হবে।
                </p>

                <button
                  type="button"
                  onClick={handleStartWatchMonetagAd}
                  disabled={adCooldown > 0 || isBatchLocked}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-[#14081f] font-extrabold text-sm shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span>
                    {isBatchLocked
                      ? `পরবর্তী স্লট (${formatCountdownHMS(batchRemainingSeconds)})`
                      : adCooldown > 0
                      ? `অপেক্ষা করুন (${adCooldown}s)...`
                      : `বিজ্ঞাপন দেখুন (+৳${config.adReward})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PAGE 4: REFERRAL GIVEAWAY & REAL LIVE LEADERBOARD
          ========================================================= */}
          {activePage === 'giveaway' && (
            <div className="space-y-4 animate-fadeIn">
              <div className={`rounded-3xl p-5 text-center glass-reflect ${heroPrism}`}>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>লাইভ চলছে · {config.giveawayDateRange}</span>
                </div>

                <h2 className="text-xl font-extrabold flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>রেফার গিভয়ে</span>
                </h2>

                <div className="text-3xl font-extrabold font-mono-num text-amber-400 my-2.5">
                  ৳{config.giveawayPrizePool.toLocaleString('en-US')} <span className="text-base">BDT</span>
                </div>

                {/* Single concise notice requested by user */}
                <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-xs font-extrabold text-amber-200 mb-3">
                  🏆 {config.giveawayRuleShortText || 'সবথেকে বেশি রেফার করে টপ ১০-এ থাকলেই পাবেন এই গিভয়ে পুরস্কার!'}
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className={`rounded-2xl p-2.5 ${innerGlassStat}`}>
                    <div className="text-sm font-extrabold text-amber-400 font-mono-num whitespace-nowrap">টপ ১০</div>
                    <div className="text-[10px] opacity-80 whitespace-nowrap mt-0.5">সর্বোচ্চ রেফারকারী</div>
                  </div>
                  <div className={`rounded-2xl p-2.5 ${innerGlassStat}`}>
                    <div className="text-sm font-extrabold text-rose-400 font-mono-num whitespace-nowrap">
                      {config.giveawayDaysLeft} দিন
                    </div>
                    <div className="text-[10px] opacity-80 whitespace-nowrap mt-0.5">বাকি আছে</div>
                  </div>
                  <div className={`rounded-2xl p-2.5 ${innerGlassStat}`}>
                    <div className="text-sm font-extrabold text-purple-300 font-mono-num whitespace-nowrap">
                      {user.referralCount} জন
                    </div>
                    <div className="text-[10px] opacity-80 whitespace-nowrap mt-0.5">আপনার রেফার</div>
                  </div>
                </div>
              </div>

              {/* REAL FIREBASE LIVE LEADERBOARD (Top 10) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>টপ ১০ রেফার লিডারবোর্ড</span>
                  </h3>
                  <span className="text-xs text-amber-500 font-bold">● Live</span>
                </div>

                <div className={`rounded-3xl p-4 divide-y divide-amber-500/15 ${cardSurface}`}>
                  {loadingLeaderboard ? (
                    <div className="py-6 text-center text-xs opacity-70">লিডারবোর্ড লোড হচ্ছে...</div>
                  ) : leaderboard.length === 0 ? (
                    <div className="py-6 text-center text-xs opacity-70">
                      এখনো কোনো ইউজার রেফারেল তালিকায় যুক্ত হননি
                    </div>
                  ) : (
                    leaderboard.map((entry) => (
                      <div
                        key={entry.id}
                        className={`py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 ${
                          entry.isCurrentUser ? 'bg-amber-500/10 rounded-xl px-2' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl font-mono-num font-extrabold text-xs flex items-center justify-center shrink-0 ${
                              entry.rank === 1
                                ? 'bg-amber-500 text-black'
                                : entry.rank === 2
                                ? 'bg-rose-500/25 text-rose-300'
                                : entry.rank === 3
                                ? 'bg-purple-500/25 text-purple-300'
                                : 'bg-amber-500/10 opacity-80'
                            }`}
                          >
                            {entry.rank}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold truncate">{entry.maskedName}</div>
                            <div className="text-[11px] opacity-70 truncate">{entry.userTag}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-extrabold font-mono-num text-amber-400 whitespace-nowrap">
                            {entry.referrals} রেফার
                          </div>
                          <div className="text-[11px] font-mono-num font-bold opacity-80 whitespace-nowrap">
                            ৳{entry.prizeAmount.toLocaleString('en-US')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              PAGE 5: WITHDRAW & HISTORY
          ========================================================= */}
          {activePage === 'withdraw' && (
            <div className="space-y-4 animate-fadeIn">
              <div className={`rounded-3xl p-5 glass-reflect ${heroPrism}`}>
                <div className="text-xs opacity-85 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>আপনার উত্তোলনযোগ্য ব্যালেন্স</span>
                </div>

                <div className="text-3xl font-extrabold font-mono-num my-2 truncate">
                  ৳{user.balance.toFixed(2)} <span className="text-base text-amber-400">BDT</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs mt-3">
                  <div className={`px-3 py-2 rounded-xl font-mono-num font-bold text-amber-400 text-center whitespace-nowrap ${innerGlassStat}`}>
                    👥 {user.referralCount}/{config.requiredReferralsForWithdraw} রেফার
                  </div>
                  <div className={`px-3 py-2 rounded-xl font-mono-num font-bold text-center whitespace-nowrap ${innerGlassStat}`}>
                    💳 ন্যূনতম ৳{config.minWithdraw}
                  </div>
                </div>
              </div>

              <form onSubmit={handleWithdrawSubmit} className={`rounded-3xl p-5 space-y-4 ${cardSurface}`}>
                <h3 className="text-sm font-extrabold flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>উত্তোলন ফরম</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold mb-1.5 opacity-85">পদ্ধতি নির্বাচন করুন</label>
                  <select
                    value={wdMethod}
                    onChange={(e) => setWdMethod(e.target.value as typeof wdMethod)}
                    className="w-full rounded-2xl px-4 py-3 text-xs font-bold outline-none border bg-[#170b28] border-amber-500/30 text-amber-50"
                  >
                    <option value="bKash">bKash (বিকাশ পার্সোনাল)</option>
                    <option value="Nagad">Nagad (নগদ পার্সোনাল)</option>
                    <option value="Rocket">Rocket (রকেট)</option>
                    <option value="Upay">Upay (উপায়)</option>
                    <option value="Binance">Binance Pay / USDT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 opacity-85">একাউন্ট নম্বর</label>
                  <input
                    type="tel"
                    value={wdAccount}
                    onChange={(e) => setWdAccount(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-2xl px-4 py-3 text-xs font-mono-num font-bold outline-none border bg-[#170b28] border-amber-500/30 text-amber-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 opacity-85">টাকার পরিমাণ (BDT ৳)</label>
                  <input
                    type="number"
                    min={config.minWithdraw}
                    value={wdAmount}
                    onChange={(e) => setWdAmount(e.target.value)}
                    placeholder={`ন্যূনতম ${config.minWithdraw} BDT`}
                    className="w-full rounded-2xl px-4 py-3 text-xs font-mono-num font-bold outline-none border bg-[#170b28] border-amber-500/30 text-amber-50"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-[#14081f] font-extrabold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>রিকোয়েস্ট জমা দিন</span>
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowWithdrawHistory(!showWithdrawHistory)}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${cardSurface}`}
              >
                <History className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{showWithdrawHistory ? 'ইতিহাস লুকান' : 'উত্তোলন ও আয়ের ইতিহাস দেখুন'}</span>
              </button>

              {showWithdrawHistory && (
                <div className={`rounded-3xl p-5 space-y-3 ${cardSurface}`}>
                  <h4 className="text-xs font-extrabold">সাম্প্রতিক লেনদেন</h4>
                  {transactions.length === 0 ? (
                    <p className="text-xs opacity-70 text-center py-4">এখনো কোনো লেনদেন হয়নি</p>
                  ) : (
                    <div className="space-y-2.5">
                      {transactions.slice(0, 15).map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-3.5 rounded-2xl flex items-center justify-between gap-2 text-xs ${innerGlassStat}`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold truncate">{tx.description}</div>
                            <div className="text-[10px] opacity-65 mt-0.5">{tx.createdAt}</div>
                          </div>
                          <span
                            className={`font-mono-num font-extrabold whitespace-nowrap shrink-0 ${
                              tx.amount >= 0 ? 'text-amber-400' : 'text-rose-400'
                            }`}
                          >
                            {tx.amount >= 0 ? `+৳${tx.amount}` : `-৳${Math.abs(tx.amount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              PAGE 6: SUPPORT & TUTORIAL
          ========================================================= */}
          {activePage === 'support' && (
            <div className="space-y-4 animate-fadeIn">
              {/* TOP PROMINENT OFFICIAL CHANNEL BANNER (https://t.me/jmjads) */}
              {renderProminentOfficialChannelBanner()}

              <div className={`rounded-3xl p-5 space-y-4 ${cardSurface}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold truncate">অফিশিয়াল চ্যানেল ও গাইডলাইন</h3>
                    <p className="text-xs opacity-75 truncate">কিভাবে কাজ ও উত্তোলন করবেন দেখুন</p>
                  </div>
                </div>

                <a
                  href={config.tutorialVideoUrl || 'https://t.me/jmjads'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>অফিশিয়াল টিউটোরিয়াল ও চ্যানেল খুলুন</span>
                </a>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold px-1">যোগাযোগ মাধ্যম</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={config.officialChannelUrl || 'https://t.me/jmjads'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-2xl p-4 text-center flex flex-col items-center gap-1.5 ${cardSurface}`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-extrabold whitespace-nowrap">অফিশিয়াল চ্যানেল</div>
                    <div className="text-[11px] opacity-70 font-mono-num truncate max-w-full">
                      t.me/jmjads
                    </div>
                  </a>

                  <a
                    href={`https://t.me/${(config.supportTelegram || '@jmjads').replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-2xl p-4 text-center flex flex-col items-center gap-1.5 ${cardSurface}`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-extrabold whitespace-nowrap">টেলিগ্রাম সাপোর্ট</div>
                    <div className="text-[11px] opacity-70 font-mono-num truncate max-w-full">
                      {config.supportTelegram}
                    </div>
                  </a>

                  {config.supportEmail && (
                    <a
                      href={`mailto:${config.supportEmail}`}
                      className={`rounded-2xl p-4 text-center flex flex-col items-center gap-1.5 ${cardSurface}`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-extrabold whitespace-nowrap">ইমেইল</div>
                      <div className="text-[11px] opacity-70 truncate max-w-full">{config.supportEmail}</div>
                    </a>
                  )}

                  {config.supportWhatsapp && (
                    <a
                      href={`https://wa.me/${config.supportWhatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-2xl p-4 text-center flex flex-col items-center gap-1.5 ${cardSurface}`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-extrabold whitespace-nowrap">হোয়াটসঅ্যাপ</div>
                      <div className="text-[11px] opacity-70 font-mono-num truncate max-w-full">
                        {config.supportWhatsapp}
                      </div>
                    </a>
                  )}

                  {config.supportPhone && (
                    <a
                      href={`tel:${config.supportPhone}`}
                      className={`rounded-2xl p-4 text-center flex flex-col items-center gap-1.5 ${cardSurface}`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-extrabold whitespace-nowrap">ফোন সাপোর্ট</div>
                      <div className="text-[11px] opacity-70 font-mono-num truncate max-w-full">
                        {config.supportPhone}
                      </div>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* SMOOTH 6-TAB BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] z-40 px-2 py-2 backdrop-blur-2xl border-t grid grid-cols-6 items-center bg-[#0b0613]/92 border-amber-500/20">
          {[
            { id: 'home', label: 'হোম', icon: Home },
            { id: 'tasks', label: 'টাস্ক', icon: ListChecks },
            { id: 'ads', label: 'অ্যাড', icon: Play },
            { id: 'giveaway', label: 'গিভয়ে', icon: Trophy },
            { id: 'withdraw', label: 'উত্তোলন', icon: Wallet },
            { id: 'support', label: 'সাপোর্ট', icon: Headphones },
          ].map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActivePage(item.id as UserPageTab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`py-1.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  active
                    ? 'bg-gradient-to-b from-amber-500/20 to-rose-500/20 text-amber-500 font-extrabold scale-105'
                    : 'opacity-65 hover:opacity-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-500' : ''}`} />
                <span className="text-[10px] whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* MODALS */}
      <MonetagAdPlayerModal
        isOpen={adModalState.open}
        zoneId={config.monetagZoneId}
        sdkFunc={config.monetagSdkFunc}
        rewardAmount={adModalState.reward}
        durationSeconds={5}
        purposeLabel={adModalState.purpose}
        isDark={true}
        onSuccess={() => {
          const cb = adModalState.onCompleteCallback;
          setAdModalState((prev) => ({ ...prev, open: false }));
          if (cb) cb();
        }}
        onCancel={() => {
          setAdModalState((prev) => ({ ...prev, open: false }));
          showToast('বিজ্ঞাপন সম্পূর্ণ না দেখায় রিওয়ার্ড যোগ হয়নি!');
        }}
      />

      <NoticeModal
        isOpen={noticeOpen}
        config={config}
        onClose={() => setNoticeOpen(false)}
      />

      <BonusAndPromoModal
        isOpen={bonusModalOpen}
        user={user}
        onClaimStreak={(bonusAmount) => {
          creditUserReward(bonusAmount, 'daily_streak', `ডেইলি চেক-ইন বোনাস (Day ${user.streakDays + 1})`, {
            streakDays: user.streakDays + 1,
            lastStreakDate: user.todayDateKey,
          });
          showToast(`ডেইলি চেক-ইন বোনাস +৳${bonusAmount} যোগ হয়েছে!`);
        }}
        onRedeemPromo={(code) => handleRedeemPromoCode(code)}
        onClose={() => setBonusModalOpen(false)}
      />
    </div>
  );
}
