import { AppConfig, LeaderboardEntry, PromoCode, TaskItem, TransactionItem, UserProfile, WithdrawRequest } from '../types';
import { DEFAULT_CONFIG, getBangladeshDateKey, getRealTelegramUser } from '../store/initialData';

// Firebase config from user's Telegram Mini App project
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBqenpYqWUpbJJkVZmW-FmYh07hbG4bLYg',
  authDomain: 'top-earn-pro-bot-bd.firebaseapp.com',
  projectId: 'top-earn-pro-bot-bd',
  storageBucket: 'top-earn-pro-bot-bd.firebasestorage.app',
  messagingSenderId: '418300235713',
  appId: '1:418300235713:web:19b1d78095ff3225f8e940',
};

interface FirestoreWindow {
  firebase?: {
    apps: unknown[];
    initializeApp: (cfg: typeof FIREBASE_CONFIG) => void;
    firestore: {
      (): any;
      FieldValue: {
        serverTimestamp: () => unknown;
        increment: (n: number) => unknown;
      };
    };
  };
}

export function getFirestoreDb(): any | null {
  try {
    const win = window as unknown as FirestoreWindow;
    if (!win.firebase) return null;
    if (!win.firebase.apps.length) {
      win.firebase.initializeApp(FIREBASE_CONFIG);
    }
    return win.firebase.firestore();
  } catch (e) {
    console.warn('Firestore init fallback to local:', e);
    return null;
  }
}

export function getFieldValue(): any | null {
  try {
    const win = window as unknown as FirestoreWindow;
    return win.firebase?.firestore?.FieldValue || null;
  } catch {
    return null;
  }
}

// Subscribe to global AppConfig from Firestore + localStorage
export function subscribeToAppConfig(onUpdate: (cfg: AppConfig) => void): () => void {
  const db = getFirestoreDb();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'jmj_ads_config_v3' && e.newValue) {
      try {
        onUpdate({ ...DEFAULT_CONFIG, ...JSON.parse(e.newValue) });
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = db
        .collection('jmj_settings')
        .doc('global')
        .onSnapshot(
          (doc: any) => {
            if (doc.exists) {
              const data = doc.data() as Partial<AppConfig>;
              const merged = { ...DEFAULT_CONFIG, ...data };
              localStorage.setItem('jmj_ads_config_v3', JSON.stringify(merged));
              onUpdate(merged);
            }
          },
          () => {}
        );
    } catch {}
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (unsubFirestore) unsubFirestore();
  };
}

// Subscribe to Real Tasks from Firestore + localStorage
export function subscribeToTasks(onUpdate: (tasks: TaskItem[]) => void): () => void {
  const db = getFirestoreDb();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'jmj_ads_tasks_v3' && e.newValue) {
      try {
        onUpdate(JSON.parse(e.newValue));
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = db.collection('jmj_tasks').onSnapshot(
        (snap: any) => {
          const list: TaskItem[] = [];
          snap.forEach((doc: any) => {
            list.push({ id: doc.id, ...(doc.data() as Omit<TaskItem, 'id'>) });
          });
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          localStorage.setItem('jmj_ads_tasks_v3', JSON.stringify(list));
          onUpdate(list);
        },
        () => {}
      );
    } catch {}
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (unsubFirestore) unsubFirestore();
  };
}

// Subscribe to Promo Codes from Firestore + localStorage
export function subscribeToPromos(onUpdate: (promos: PromoCode[]) => void): () => void {
  const db = getFirestoreDb();
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = db.collection('jmj_promos').onSnapshot(
        (snap: any) => {
          const list: PromoCode[] = [];
          snap.forEach((doc: any) => {
            list.push(doc.data() as PromoCode);
          });
          localStorage.setItem('jmj_ads_promos_v3', JSON.stringify(list));
          onUpdate(list);
        },
        () => {}
      );
    } catch {}
  }
  return () => {
    if (unsubFirestore) unsubFirestore();
  };
}

// Initialize & Sync Real User Profile with Firestore `users/{uid}`
export async function initAndSyncRealUser(
  config: AppConfig,
  onUserUpdated: (u: UserProfile) => void
): Promise<() => void> {
  const db = getFirestoreDb();
  const fv = getFieldValue();
  const tgUser = getRealTelegramUser();
  const userId = tgUser.id;
  const today = getBangladeshDateKey();

  if (!db) {
    return () => {};
  }

  const userRef = db.collection('users').doc(userId);

  try {
    const snap = await userRef.get();
    if (!snap.exists) {
      const newUserDoc = {
        telegramId: userId,
        firstName: tgUser.firstName,
        lastName: tgUser.lastName,
        username: tgUser.username,
        isVerifiedPublisher: true,
        multiplier2x: true,
        balance: config.welcomeBonus,
        todayEarned: 0,
        referralEarned: 0,
        totalEarned: config.welcomeBonus,
        totalWithdrawn: 0,
        referralCount: 0,
        referralCode: userId,
        referredBy: null,
        todayAds: 0,
        todayAdsWatched: 0,
        adsWatched: 0,
        totalAdsWatched: 0,
        completedGiveawayDays: 0,
        missedGiveawayDays: 0,
        streakDays: 0,
        lastStreakDate: null,
        spinsUsedToday: 0,
        redeemedPromoCodes: [],
        todayKey: today,
        todayDateKey: today,
        createdAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
        updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
      };
      await userRef.set(newUserDoc);

      if (config.welcomeBonus > 0) {
        await db.collection('transactions').add({
          userId,
          type: 'welcome',
          amount: config.welcomeBonus,
          description: `${config.siteName} ওয়েলকাম বোনাস`,
          createdAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
        });
      }

      // Check if user came via referral link (e.g. ref_123456)
      if (tgUser.startParam) {
        const refId = tgUser.startParam.replace(/^ref_/, '').trim();
        if (refId && refId !== userId) {
          await applyRealReferral(db, fv, userId, refId, config.referralBonus);
        }
      }
    } else {
      const existing = snap.data() || {};
      const savedDay = existing.todayDateKey || existing.todayKey;
      if (savedDay !== today) {
        await userRef.update({
          todayAds: 0,
          todayAdsWatched: 0,
          todayEarned: 0,
          spinsUsedToday: 0,
          todayKey: today,
          todayDateKey: today,
          updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn('User sync warning:', e);
  }

  const unsub = userRef.onSnapshot(
    (doc: any) => {
      if (!doc.exists) return;
      const d = doc.data() || {};
      const mapped: UserProfile = {
        telegramId: d.telegramId || userId,
        firstName: d.firstName || tgUser.firstName,
        lastName: d.lastName || tgUser.lastName,
        username: d.username || tgUser.username,
        isVerifiedPublisher: d.isVerifiedPublisher !== false,
        multiplier2x: d.multiplier2x !== false,
        balance: Number(d.balance || 0),
        todayEarned: Number(d.todayEarned || 0),
        referralEarned: Number(d.referralEarned || Number(d.referralCount || 0) * config.referralBonus),
        totalEarned: Number(d.totalEarned || 0),
        totalWithdrawn: Number(d.totalWithdrawn || 0),
        referralCount: Number(d.referralCount || 0),
        todayAdsWatched: Number(d.todayAdsWatched ?? d.todayAds ?? 0),
        totalAdsWatched: Number(d.totalAdsWatched ?? d.adsWatched ?? 0),
        completedGiveawayDays: Number(d.completedGiveawayDays || 0),
        missedGiveawayDays: Number(d.missedGiveawayDays || 0),
        streakDays: Number(d.streakDays || 0),
        lastStreakDate: d.lastStreakDate || null,
        spinsUsedToday: Number(d.spinsUsedToday || 0),
        redeemedPromoCodes: Array.isArray(d.redeemedPromoCodes) ? d.redeemedPromoCodes : [],
        todayDateKey: d.todayDateKey || d.todayKey || today,
      };
      onUserUpdated(mapped);
    },
    () => {}
  );

  return unsub;
}

async function applyRealReferral(
  db: any,
  fv: any,
  newUserId: string,
  referrerId: string,
  bonusAmount: number
) {
  try {
    const referrerRef = db.collection('users').doc(referrerId);
    const userRef = db.collection('users').doc(newUserId);

    await db.runTransaction(async (transaction: any) => {
      const refSnap = await transaction.get(referrerRef);
      const usrSnap = await transaction.get(userRef);
      if (!refSnap.exists) return;
      const usrData = usrSnap.data() || {};
      if (usrData.referredBy) return;

      transaction.update(userRef, { referredBy: referrerId });
      transaction.update(referrerRef, {
        referralCount: fv ? fv.increment(1) : (refSnap.data()?.referralCount || 0) + 1,
        balance: fv ? fv.increment(bonusAmount) : (refSnap.data()?.balance || 0) + bonusAmount,
        referralEarned: fv ? fv.increment(bonusAmount) : (refSnap.data()?.referralEarned || 0) + bonusAmount,
        totalEarned: fv ? fv.increment(bonusAmount) : (refSnap.data()?.totalEarned || 0) + bonusAmount,
        updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
      });
    });
  } catch (e) {
    console.warn('Referral transaction error:', e);
  }
}

// Update user fields in Firestore
export async function updateRealUserInFirestore(
  userId: string,
  patch: Record<string, unknown>,
  txRecord?: { type: TransactionItem['type']; amount: number; description: string }
) {
  const db = getFirestoreDb();
  const fv = getFieldValue();
  if (!db) return;

  try {
    await db
      .collection('users')
      .doc(userId)
      .set(
        {
          ...patch,
          updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
        },
        { merge: true }
      );

    if (txRecord) {
      await db.collection('transactions').add({
        userId,
        type: txRecord.type,
        amount: txRecord.amount,
        description: txRecord.description,
        createdAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('Update user error:', e);
  }
}

// Load Live Real Leaderboard from Firestore `users` collection
export async function fetchRealLeaderboard(currentUserId: string): Promise<LeaderboardEntry[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const prizeDistribution = [7000, 4500, 3000, 2200, 1800, 1500, 1200, 1000, 900, 800];

  try {
    const snap = await db.collection('users').orderBy('referralCount', 'desc').limit(15).get();
    if (snap.empty) return [];

    const rows: LeaderboardEntry[] = [];
    let rank = 1;
    snap.forEach((doc: any) => {
      const d = doc.data() || {};
      const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || d.username || 'User';
      const masked =
        fullName.length > 3 ? fullName.slice(0, 3) + '***' : fullName + '***';
      rows.push({
        id: doc.id,
        rank,
        maskedName: doc.id === currentUserId ? `${fullName} (আপনি)` : masked,
        userTag: `ইউজার #${String(doc.id).slice(-4)}`,
        referrals: Number(d.referralCount || 0),
        completedDays: Number(d.completedGiveawayDays || (d.todayAdsWatched >= 20 ? 1 : 0)),
        prizeAmount: prizeDistribution[rank - 1] || 500,
        isCurrentUser: doc.id === currentUserId,
      });
      rank++;
    });
    return rows;
  } catch (e) {
    console.warn('Leaderboard fetch error:', e);
    return [];
  }
}

// Fetch user's real transactions & withdrawals
export async function fetchRealUserHistory(userId: string): Promise<{
  transactions: TransactionItem[];
  withdrawals: WithdrawRequest[];
}> {
  const db = getFirestoreDb();
  if (!db) return { transactions: [], withdrawals: [] };

  try {
    const txSnap = await db.collection('transactions').where('userId', '==', userId).limit(25).get();
    const txs: TransactionItem[] = [];
    txSnap.forEach((doc: any) => {
      const d = doc.data() || {};
      txs.push({
        id: doc.id,
        userId: d.userId,
        type: d.type || 'ad_reward',
        amount: Number(d.amount || 0),
        description: d.description || 'Transaction',
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('bn-BD') : 'সাম্প্রতিক',
      });
    });

    const wdSnap = await db.collection('withdrawals').where('userId', '==', userId).limit(20).get();
    const wds: WithdrawRequest[] = [];
    wdSnap.forEach((doc: any) => {
      const d = doc.data() || {};
      wds.push({
        id: doc.id,
        userId: d.userId,
        userName: d.name || d.userName || 'User',
        method: d.method || 'bKash',
        accountNumber: d.accountNumber || '',
        amount: Number(d.amount || 0),
        status: d.status || 'pending',
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('bn-BD') : 'সাম্প্রতিক',
      });
    });

    return { transactions: txs, withdrawals: wds };
  } catch {
    return { transactions: [], withdrawals: [] };
  }
}

// Submit real withdrawal request to Firestore
export async function submitRealWithdrawToFirestore(wd: WithdrawRequest) {
  const db = getFirestoreDb();
  const fv = getFieldValue();
  if (!db) return;

  await db.collection('withdrawals').add({
    userId: wd.userId,
    name: wd.userName,
    userName: wd.userName,
    amount: wd.amount,
    method: wd.method,
    accountNumber: wd.accountNumber,
    status: 'pending',
    createdAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
  });
}
