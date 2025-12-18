import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY"; // Replace with your VAPID key

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

  useEffect(() => {
    const checkSupport = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);

      if (supported) {
        const permission = Notification.permission;
        setIsPermissionGranted(permission === "granted");

        if (permission === "granted") {
          const registration = await navigator.serviceWorker.ready;
          const existingSub = await registration.pushManager.getSubscription();
          setSubscription(existingSub);
        }
      }
    };

    checkSupport();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setIsPermissionGranted(granted);

      if (granted) {
        toast.success("Notifications enabled!");
      } else {
        toast.error("Notification permission denied");
      }

      return granted;
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to request notification permission");
      return false;
    }
  };

  const subscribe = useCallback(async (): Promise<PushSubscriptionData | null> => {
    if (!isSupported || !isPermissionGranted) {
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
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      setSubscription(sub);

      const subJson = sub.toJSON();
      return {
        endpoint: sub.endpoint,
        p256dh: subJson.keys?.p256dh || "",
        auth_key: subJson.keys?.auth || "",
      };
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to enable push notifications");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isPermissionGranted]);

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

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (!isPermissionGranted) return;

    try {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    } catch (error) {
      // Fallback for when Notification constructor fails
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          ...options,
        });
      });
    }
  };

  return {
    isSupported,
    isPermissionGranted,
    subscription,
    isLoading,
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
