import { AppConfig, LeaderboardEntry, PromoCode, TaskItem, TransactionItem, UserProfile, WithdrawRequest } from '../types';
import {
  DEFAULT_CONFIG,
  INITIAL_TASKS,
  generateShortReferCode,
  getBangladeshDateKey,
  getRealTelegramUser,
} from '../store/initialData';

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

// Subscribe to Real Tasks from Firestore + localStorage (always ensuring official @jmjads channel is present)
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

          const hasOfficial = list.some(
            (t) => t.id === 'official_jmjads_channel' || t.url?.toLowerCase().includes('t.me/jmjads')
          );
          const finalTasks = hasOfficial ? list : [...INITIAL_TASKS, ...list];

          localStorage.setItem('jmj_ads_tasks_v3', JSON.stringify(finalTasks));
          onUpdate(finalTasks);
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
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'jmj_ads_promos_v3' && e.newValue) {
      try {
        onUpdate(JSON.parse(e.newValue));
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

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
    window.removeEventListener('storage', handleStorage);
    if (unsubFirestore) unsubFirestore();
  };
}

// Increment Promo Code usage count in Firestore
export async function incrementPromoUsageInFirestore(code: string) {
  const db = getFirestoreDb();
  const fv = getFieldValue();
  if (!db) return;
  try {
    await db
      .collection('jmj_promos')
      .doc(code)
      .update({
        usedCount: fv ? fv.increment(1) : 1,
      });
  } catch (e) {
    console.warn('Promo usage update warning:', e);
  }
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
  const shortCode = generateShortReferCode(userId);
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
        referralCode: shortCode,
        referredBy: null,
        isVerifiedPublisher: true,
        multiplier2x: true,
        balance: config.welcomeBonus,
        todayEarned: 0,
        referralEarned: 0,
        totalEarned: config.welcomeBonus,
        totalWithdrawn: 0,
        referralCount: 0,
        batchAdsWatched: 0,
        batchCycleStartAt: 0,
        todayAds: 0,
        todayAdsWatched: 0,
        adsWatched: 0,
        totalAdsWatched: 0,
        officialChannelClaimed: false,
        completedGiveawayDays: 0,
        missedGiveawayDays: 0,
        streakDays: 0,
        lastStreakDate: null,
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

      // Check if user came via referral link (e.g. ?ref=123456 or startapp=ref_123456)
      if (tgUser.startParam) {
        const refInput = tgUser.startParam.replace(/^ref_/, '').trim();
        if (refInput && refInput !== userId && refInput.toUpperCase() !== shortCode) {
          await claimReferralByCodeOrId(
            userId,
            refInput,
            config.referralBonus,
            config.referredJoinBonus || 0
          );
        }
      }
    } else {
      const existing = snap.data() || {};
      const savedDay = existing.todayDateKey || existing.todayKey;
      const updates: Record<string, unknown> = {};

      if (!existing.referralCode) {
        updates.referralCode = shortCode;
      }

      if (savedDay !== today) {
        updates.todayAds = 0;
        updates.todayAdsWatched = 0;
        updates.todayEarned = 0;
        updates.todayKey = today;
        updates.todayDateKey = today;
        updates.updatedAt = fv ? fv.serverTimestamp() : new Date().toISOString();
      }

      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
      }

      // Also check if an existing user who hasn't been referred yet opened a referral link!
      if (!existing.referredBy && tgUser.startParam) {
        const refInput = tgUser.startParam.replace(/^ref_/, '').trim();
        if (refInput && refInput !== userId && refInput.toUpperCase() !== shortCode) {
          await claimReferralByCodeOrId(
            userId,
            refInput,
            config.referralBonus,
            config.referredJoinBonus || 0
          );
        }
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
        referralCode: d.referralCode || shortCode,
        referredBy: d.referredBy || null,
        isVerifiedPublisher: d.isVerifiedPublisher !== false,
        multiplier2x: d.multiplier2x !== false,
        balance: Number(d.balance || 0),
        todayEarned: Number(d.todayEarned || 0),
        referralEarned: Number(d.referralEarned || Number(d.referralCount || 0) * config.referralBonus),
        totalEarned: Number(d.totalEarned || 0),
        totalWithdrawn: Number(d.totalWithdrawn || 0),
        referralCount: Number(d.referralCount || 0),
        batchAdsWatched: Number(d.batchAdsWatched || 0),
        batchCycleStartAt: Number(d.batchCycleStartAt || 0),
        todayAdsWatched: Number(d.todayAdsWatched ?? d.todayAds ?? 0),
        totalAdsWatched: Number(d.totalAdsWatched ?? d.adsWatched ?? 0),
        officialChannelClaimed: Boolean(d.officialChannelClaimed),
        completedGiveawayDays: Number(d.completedGiveawayDays || 0),
        missedGiveawayDays: Number(d.missedGiveawayDays || 0),
        streakDays: Number(d.streakDays || 0),
        lastStreakDate: d.lastStreakDate || null,
        redeemedPromoCodes: Array.isArray(d.redeemedPromoCodes) ? d.redeemedPromoCodes : [],
        todayDateKey: d.todayDateKey || d.todayKey || today,
      };
      onUserUpdated(mapped);
    },
    () => {}
  );

  return unsub;
}

/**
 * Resolves a referrer by either their Telegram User ID (`123456789`), `ref_123456789`, or Short Code (`JMJ456789`)
 * and credits the referrer's `referralCount` and `balance` in Firestore.
 */
export async function claimReferralByCodeOrId(
  currentUserId: string,
  rawCodeOrId: string,
  referrerBonus: number,
  inviteeBonus: number = 0
): Promise<{ ok: boolean; message: string; inviteeBonusAdded?: number }> {
  const db = getFirestoreDb();
  const fv = getFieldValue();

  const cleaned = rawCodeOrId
    .trim()
    .replace(/^https?:\/\/[^\s]+\?(?:startapp|start|ref)=/i, '')
    .replace(/^ref_/i, '')
    .trim();

  if (!cleaned) {
    return { ok: false, message: 'সঠিক রেফার কোড বা আইডি লিখুন!' };
  }

  const myShortCode = generateShortReferCode(currentUserId);
  if (cleaned === currentUserId || cleaned.toUpperCase() === myShortCode) {
    return { ok: false, message: 'নিজের রেফার কোড নিজে ব্যবহার করা যাবে না!' };
  }

  if (!db) {
    return { ok: false, message: 'ডাটাবেস সংযোগ পাওয়া যায়নি!' };
  }

  try {
    // 1. Check if cleaned is a direct user doc ID
    let targetReferrerDocId: string | null = null;
    const directDoc = await db.collection('users').doc(cleaned).get();
    if (directDoc.exists) {
      targetReferrerDocId = directDoc.id;
    } else {
      // 2. Query by referralCode (e.g. JMJ123456)
      const qSnap = await db
        .collection('users')
        .where('referralCode', '==', cleaned.toUpperCase())
        .limit(1)
        .get();
      if (!qSnap.empty) {
        targetReferrerDocId = qSnap.docs[0].id;
      }
    }

    if (!targetReferrerDocId) {
      return { ok: false, message: 'এই রেফার কোড বা আইডি খুঁজে পাওয়া যায়নি!' };
    }

    if (targetReferrerDocId === currentUserId) {
      return { ok: false, message: 'নিজের রেফার কোড নিজে ব্যবহার করা যাবে না!' };
    }

    const referrerRef = db.collection('users').doc(targetReferrerDocId);
    const userRef = db.collection('users').doc(currentUserId);

    let resultStatus = { ok: false, message: 'রেফার ইতিমধ্যে যুক্ত করা হয়েছে!' };

    await db.runTransaction(async (transaction: any) => {
      const refSnap = await transaction.get(referrerRef);
      const usrSnap = await transaction.get(userRef);

      if (!refSnap.exists) {
        resultStatus = { ok: false, message: 'রেফারকারী একাউন্ট পাওয়া যায়নি!' };
        return;
      }

      const usrData = usrSnap.exists ? usrSnap.data() || {} : {};
      if (usrData.referredBy) {
        resultStatus = { ok: false, message: 'আপনি ইতিমধ্যে একজন রেফারকারীর অধীনে যুক্ত আছেন!' };
        return;
      }

      const userPatch: Record<string, unknown> = {
        referredBy: targetReferrerDocId,
        updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
      };

      if (inviteeBonus > 0) {
        userPatch.balance = fv ? fv.increment(inviteeBonus) : Number(usrData.balance || 0) + inviteeBonus;
        userPatch.todayEarned = fv
          ? fv.increment(inviteeBonus)
          : Number(usrData.todayEarned || 0) + inviteeBonus;
        userPatch.totalEarned = fv
          ? fv.increment(inviteeBonus)
          : Number(usrData.totalEarned || 0) + inviteeBonus;
      }

      transaction.set(userRef, userPatch, { merge: true });

      const refData = refSnap.data() || {};
      transaction.update(referrerRef, {
        referralCount: fv ? fv.increment(1) : Number(refData.referralCount || 0) + 1,
        balance: fv ? fv.increment(referrerBonus) : Number(refData.balance || 0) + referrerBonus,
        referralEarned: fv
          ? fv.increment(referrerBonus)
          : Number(refData.referralEarned || 0) + referrerBonus,
        totalEarned: fv ? fv.increment(referrerBonus) : Number(refData.totalEarned || 0) + referrerBonus,
        updatedAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
      });

      resultStatus = {
        ok: true,
        message:
          inviteeBonus > 0
            ? `রেফার সফল! আপনি +৳${inviteeBonus} ও আপনার বন্ধু +৳${referrerBonus} পেয়েছেন`
            : `রেফার সফল! আপনার বন্ধুর একাউন্টে +৳${referrerBonus} যোগ হয়েছে`,
        inviteeBonusAdded: inviteeBonus,
      };
    });

    return resultStatus;
  } catch (e) {
    console.warn('Referral transaction error:', e);
    return { ok: false, message: 'রেফার যাচাই করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।' };
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

// Load Live Real Leaderboard from Firestore `users` collection (Top 10 Highest Referrers)
export async function fetchRealLeaderboard(currentUserId: string): Promise<LeaderboardEntry[]> {
  const db = getFirestoreDb();
  if (!db) return [];

  const prizeDistribution = [7000, 4500, 3000, 2200, 1800, 1500, 1200, 1000, 900, 800];

  try {
    const snap = await db.collection('users').orderBy('referralCount', 'desc').limit(10).get();
    if (snap.empty) return [];

    const rows: LeaderboardEntry[] = [];
    let rank = 1;
    snap.forEach((doc: any) => {
      const d = doc.data() || {};
      const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || d.username || 'User';
      const masked = fullName.length > 3 ? fullName.slice(0, 3) + '***' : fullName + '***';
      rows.push({
        id: doc.id,
        rank,
        maskedName: doc.id === currentUserId ? `${fullName} (আপনি)` : masked,
        userTag: `ইউজার #${String(doc.id).slice(-4)}`,
        referrals: Number(d.referralCount || 0),
        completedDays: Number(d.completedGiveawayDays || (d.todayAdsWatched >= 10 ? 1 : 0)),
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
