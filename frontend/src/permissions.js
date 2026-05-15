/**
 * Subscription Tier Permissions System
 * 
 * This file manages feature access based on user subscription tiers.
 * Tiers are fetched from the database (users table has a 'subscription' column).
 * 
 * Available tiers: free, tier_1, tier_2, tier_3
 */

const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    features: ['weather'],
    description: 'Basic weather information',
  },

  tier_1: {
    name: 'Tier 1',
    features: ['weather', 'forecast']
  },

  tier_2: {
    name: 'Tier 2',
    features: ['weather', 'forecast', 'favourites']
  },

  tier_3: {
    name: 'Tier 3 (Premium)',
    features: ['weather', 'forecast', 'favourites', 'admin']
  },
};

export const plans = {
  free: ['weather'],
  tier_1: ['weather', 'forecast'],
  tier_2: ['weather', 'forecast', 'favourites'],
  tier_3: ['weather', 'forecast', 'favourites', 'admin'],
};

export const normalizeSubscription = (subscription) => {
  if (subscription == null) return 'tier_1';
  const value = String(subscription).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  if (value === 'free' || value === '0') return 'free';
  if (value === '1' || value === 'tier1' || value === 'tier_1' || value === 'tier1subscription' || value === '1tier') return 'tier_1';
  if (value === '2' || value === 'tier2' || value === 'tier_2' || value === 'tier2subscription' || value === '2tier') return 'tier_2';
  if (value === '3' || value === 'tier3' || value === 'tier_3' || value === 'tier3subscription' || value === '3tier') return 'tier_3';

  return 'tier_1';
};

export const getUserSubscription = (user) => normalizeSubscription(user?.subscription || user?.Subscription || 'tier_1');

export const hasPermission = (userOrSubscription, feature) => {
  const subscription = typeof userOrSubscription === 'object'
    ? getUserSubscription(userOrSubscription)
    : normalizeSubscription(userOrSubscription);

  return plans[subscription]?.includes(feature) || false;
};

export const isTier1Subscription = (user) => {
  const normalized = getUserSubscription(user);
  return normalized === 'tier_1' || normalized === 'free';
};

export const isTier2Subscription = (user) => getUserSubscription(user) === 'tier_2';

export const isTier3Subscription = (user) => getUserSubscription(user) === 'tier_3';

export const canManageUsers = (user) => isTier3Subscription(user);

export const getAvailableFeatures = (userSubscription) => {
  const normalized = normalizeSubscription(userSubscription);
  return plans[normalized] || plans.free;
};

export const getTierInfo = (userSubscription) => {
  const normalized = normalizeSubscription(userSubscription);
  return SUBSCRIPTION_TIERS[normalized] || SUBSCRIPTION_TIERS.free;
};

export const canUpgrade = (userSubscription) => {
  const tiers = ['free', 'tier_1', 'tier_2', 'tier_3'];
  return !userSubscription || normalizeSubscription(userSubscription) !== tiers[tiers.length - 1];
};

export default {
  SUBSCRIPTION_TIERS,
  plans,
  normalizeSubscription,
  getUserSubscription,
  hasPermission,
  isTier1Subscription,
  isTier2Subscription,
  isTier3Subscription,
  canManageUsers,
  getAvailableFeatures,
  getTierInfo,
  canUpgrade,
};
