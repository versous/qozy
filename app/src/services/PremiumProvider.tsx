import Purchases, {
  isPurchasesError,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { onAuthStateChanged } from 'firebase/auth';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Linking, Platform } from 'react-native';

import { auth } from '@/services/firebase';

const PREMIUM_ENTITLEMENT = 'premium';
const apiKey = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  : Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
    : undefined;

type PremiumStatus = 'loading' | 'ready' | 'unavailable' | 'error';

interface PremiumContextValue {
  isPremium: boolean;
  isPreview: boolean;
  canPreview: boolean;
  setPreviewEnabled: (enabled: boolean) => void;
  status: PremiumStatus;
  message: string | null;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  managementUrl: string | null;
  isPurchasing: boolean;
  purchase: (purchasePackage: PurchasesPackage) => Promise<void>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
  manageSubscription: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

let sdkConfigured = false;
let sdkUserId: string | null = null;
let sdkQueue: Promise<void> = Promise.resolve();

function isPremiumCustomer(info: CustomerInfo) {
  return Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]);
}

function errorMessage(error: unknown) {
  if (isPurchasesError(error) && (
    error.userCancelled
    || error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  )) return null;
  return error instanceof Error
    ? error.message
    : 'Une erreur est survenue avec ton abonnement. Réessaie.';
}

export function PremiumProvider({ children }: React.PropsWithChildren) {
  const [userId, setUserId] = useState(auth?.currentUser?.uid ?? null);
  const [sdkStatus, setSdkStatus] = useState<PremiumStatus>('loading');
  const [sdkMessage, setSdkMessage] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    if (!auth) return;

    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setPreviewEnabled(false);
    });
  }, []);

  const loadStoreData = useCallback(async () => {
    const offerings = await Purchases.getOfferings();
    const customerInfo = await Purchases.getCustomerInfo();
    const currentOffering = offerings.current;
    setMonthlyPackage(currentOffering?.monthly ?? null);
    setAnnualPackage(currentOffering?.annual ?? null);
    setIsPremium(isPremiumCustomer(customerInfo));
    setManagementUrl(customerInfo.managementURL);
    const missingPlans = [
      ...(!currentOffering?.monthly ? ['mensuelle'] : []),
      ...(!currentOffering?.annual ? ['annuelle'] : []),
    ];
    setSdkMessage(!currentOffering
      ? 'Aucune offre n’est encore configurée dans RevenueCat.'
      : missingPlans.length
        ? `Configure la formule ${missingPlans.join(' et ')} dans l’offre RevenueCat.`
        : null);
    setSdkStatus('ready');
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (!userId) {
      return;
    }
    if (!apiKey) {
      return;
    }

    let active = true;
    const initialize = async () => {
      if (!active) return;
      if (!sdkConfigured) {
        Purchases.configure({ apiKey, appUserID: userId });
        sdkConfigured = true;
        sdkUserId = userId;
      } else if (sdkUserId !== userId) {
        await Purchases.logIn(userId);
        sdkUserId = userId;
      }

      await loadStoreData();
    };

    const startInitialization = async () => {
      if (!active) return;
      setSdkStatus('loading');
      setSdkMessage(null);
      await initialize();
    };

    sdkQueue = sdkQueue.then(startInitialization, startInitialization).catch((error: unknown) => {
      if (!active) return;
      setSdkStatus('error');
      setSdkMessage(errorMessage(error) ?? 'Achat annulé.');
    });

    return () => {
      active = false;
    };
  }, [loadStoreData, userId]);

  useEffect(() => {
    const listener = (customerInfo: CustomerInfo) => {
      setIsPremium(isPremiumCustomer(customerInfo));
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!sdkConfigured || !userId) return;
    setSdkStatus('loading');
    setSdkMessage(null);
    try {
      await loadStoreData();
    } catch (error) {
      setSdkStatus('error');
      setSdkMessage(errorMessage(error));
    }
  }, [loadStoreData, userId]);

  const purchase = useCallback(async (selectedPackage: PurchasesPackage) => {
    setIsPurchasing(true);
    setSdkMessage(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      setIsPremium(isPremiumCustomer(customerInfo));
      setManagementUrl(customerInfo.managementURL);
      if (!isPremiumCustomer(customerInfo)) {
        setSdkMessage('L’achat est terminé, mais l’accès Premium n’est pas encore actif.');
      }
    } catch (error) {
      const nextMessage = errorMessage(error);
      if (nextMessage) setSdkMessage(nextMessage);
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setIsPurchasing(true);
    setSdkMessage(null);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const restored = isPremiumCustomer(customerInfo);
      setIsPremium(restored);
      setManagementUrl(customerInfo.managementURL);
      if (!restored) setSdkMessage('Aucun abonnement Premium actif n’a été retrouvé.');
    } catch (error) {
      setSdkMessage(errorMessage(error));
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const manageSubscription = useCallback(async () => {
    if (!managementUrl) {
      setSdkMessage('Aucun lien de gestion d’abonnement n’est disponible pour ce compte.');
      return;
    }
    try {
      await Linking.openURL(managementUrl);
    } catch (error) {
      setSdkMessage(errorMessage(error) ?? 'Impossible d’ouvrir la gestion de l’abonnement.');
    }
  }, [managementUrl]);

  const unavailableMessage = Platform.OS === 'web'
    ? 'Les abonnements sont disponibles dans l’application iOS ou Android.'
    : !userId
      ? 'Connecte-toi pour consulter ton abonnement.'
      : !apiKey
        ? `La clé RevenueCat ${Platform.OS === 'ios' ? 'iOS' : 'Android'} n’est pas configurée.`
        : null;
  const status = unavailableMessage ? 'unavailable' : sdkStatus;
  const message = unavailableMessage ?? sdkMessage;
  const hasActiveUser = Boolean(userId && sdkUserId === userId);
  const canPreview = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PREMIUM_PREVIEW === 'true';
  const isPreview = canPreview && previewEnabled && !(status === 'ready' && hasActiveUser && isPremium);

  const value = useMemo(() => ({
    isPremium: (status === 'ready' && hasActiveUser && isPremium) || isPreview,
    isPreview,
    canPreview,
    setPreviewEnabled: canPreview ? setPreviewEnabled : () => {},
    status,
    message,
    monthlyPackage: status === 'ready' && hasActiveUser ? monthlyPackage : null,
    annualPackage: status === 'ready' && hasActiveUser ? annualPackage : null,
    managementUrl: hasActiveUser ? managementUrl : null,
    isPurchasing,
    purchase,
    restore,
    refresh,
    manageSubscription,
  }), [
    annualPackage,
    canPreview,
    isPreview,
    managementUrl,
    setPreviewEnabled,
    isPremium,
    hasActiveUser,
    isPurchasing,
    manageSubscription,
    message,
    monthlyPackage,
    purchase,
    refresh,
    status,
    restore,
  ]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) throw new Error('usePremium doit être utilisé dans PremiumProvider.');
  return context;
}
