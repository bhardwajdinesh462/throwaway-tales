import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);

      if (supported) {
        const permission = Notification.permission;
        setIsPermissionGranted(permission === "granted");

        if (permission === "granted") {
          try {
            const registration = await navigator.serviceWorker.ready;
            const existingSub = await registration.pushManager.getSubscription();
            setSubscription(existingSub);
          } catch (error) {
            console.log("Could not get existing subscription:", error);
          }
        }
      }
    };

    // Try to load VAPID key from settings
    const loadVapidKey = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'push_notifications')
          .single();
        
        const value = data?.value as { vapidPublicKey?: string } | null;
        if (value?.vapidPublicKey) {
          setVapidKey(value.vapidPublicKey);
        }
      } catch (error) {
        console.log("VAPID key not configured");
      }
    };

    checkSupport();
    loadVapidKey();
  }, []);

  const isInIframe = () => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    // Browsers commonly block permission prompts inside embedded previews/iframes.
    if (isInIframe()) {
      toast.error("Notifications can’t be enabled in the embedded preview. Open the app in a new tab, then try again.");
      return false;
    }

    // If already blocked, we cannot re-prompt programmatically.
    if (Notification.permission === "denied") {
      toast.error("Notification permission is blocked in your browser settings for this site.");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setIsPermissionGranted(granted);

      if (granted) {
        toast.success("Notifications enabled!");
      } else if (permission === "denied") {
        toast.error("Notification permission denied. Please enable it in browser settings.");
      } else {
        toast.info("Notification permission dismissed");
      }

      return granted;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to request notification permission");
      return false;
    }
  };

  const subscribe = useCallback(async (): Promise<PushSubscriptionData | null> => {
    if (!isSupported) {
      toast.error("Push notifications are not supported");
      return null;
    }

    if (!isPermissionGranted) {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    if (!vapidKey) {
      console.log("VAPID key not configured, using local notifications only");
      return null;
    }

    setIsLoading(true);

    try {
      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      }

      // Check for existing subscription
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        // Create new subscription
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      setSubscription(sub);

      const subJson = sub.toJSON();
      return {
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh || "",
        auth_key: subJson.keys?.auth || "",
      };
    } catch (error: any) {
      console.error("Error subscribing to push:", error);
      
      // Provide more specific error messages
      if (error.message?.includes("applicationServerKey")) {
        toast.error("Push notification setup incomplete. VAPID key may be invalid.");
      } else {
        toast.error("Failed to enable push notifications");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isPermissionGranted, vapidKey]);

  const unsubscribe = async (): Promise<boolean> => {
    if (!subscription) return true;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success("Notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable notifications");
      return false;
    }
  };

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isPermissionGranted) {
      console.log("Cannot show notification: permission not granted");
      return;
    }

    try {
      // Try service worker notification first (works better on mobile)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            ...options,
          });
        }).catch(() => {
          // Fallback to regular notification
          new Notification(title, {
            icon: "/favicon.ico",
            ...options,
          });
        });
      } else {
        new Notification(title, {
          icon: "/favicon.ico",
          ...options,
        });
      }
    } catch (error) {
      console.log("Could not show notification:", error);
    }
  }, [isPermissionGranted]);

  return {
    isSupported,
    isPermissionGranted,
    subscription,
    isLoading,
    vapidKey,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export default usePushNotifications;
