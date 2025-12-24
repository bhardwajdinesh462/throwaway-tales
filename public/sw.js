// Enhanced Service Worker for Push Notifications and Offline Support
const CACHE_NAME = "nullsto-v3";
const STATIC_CACHE = "nullsto-static-v3";
const DYNAMIC_CACHE = "nullsto-dynamic-v3";
const DATA_CACHE = "nullsto-data-v3";

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/nullsto-favicon.png",
];

// API routes that should be cached for offline access
const CACHEABLE_API_ROUTES = [
  "/rest/v1/domains",
  "/rest/v1/subscription_tiers",
  "/rest/v1/app_settings",
  "/rest/v1/blogs",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("Caching static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log("Some static assets failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated.");
  event.waitUntil(
    (async () => {
      // Clean old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== DATA_CACHE
            );
          })
          .map((name) => {
            console.log("Deleting old cache:", name);
            return caches.delete(name);
          })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // API requests - Network first, then cache
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/functions/v1/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache first
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - Network first with cache fallback
  if (request.destination === "document" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirst(request));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Return cached version and update cache in background
    updateCache(request);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("Fetch failed for:", request.url);
    return new Response("Offline", { status: 503 });
  }
}

// Network-first strategy (for dynamic content and API)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log("Network failed, checking cache for:", request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for document requests
    if (request.destination === "document") {
      const offlineResponse = await caches.match("/");
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response(
      JSON.stringify({ error: "You are offline", offline: true }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Update cache in background
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - we already have cached version
  }
}

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  let data = {
    title: "New Email Received",
    body: "You have a new email in your inbox",
    icon: "/nullsto-favicon.png",
    badge: "/nullsto-favicon.png",
    data: { url: "/" },
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: data.data,
    actions: [
      { action: "view", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: true,
    tag: "email-notification", // Prevents duplicate notifications
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click:", event);
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      // Check if there's already a window/tab open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // If not, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("Background sync:", event.tag);
  
  if (event.tag === "sync-emails") {
    event.waitUntil(syncEmails());
  }
  
  if (event.tag === "sync-saved-emails") {
    event.waitUntil(syncSavedEmails());
  }
});

// Sync emails when back online
async function syncEmails() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_EMAILS" });
    });
  } catch (error) {
    console.error("Failed to sync emails:", error);
  }
}

// Sync saved emails when back online
async function syncSavedEmails() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_SAVED_EMAILS" });
    });
  } catch (error) {
    console.error("Failed to sync saved emails:", error);
  }
}

// Message handling from main app
self.addEventListener("message", (event) => {
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name)))
      )
    );
  }
  
  if (event.data.type === "CACHE_EMAILS") {
    event.waitUntil(cacheEmails(event.data.emails));
  }
});

// Cache emails for offline access
async function cacheEmails(emails) {
  try {
    const cache = await caches.open(DATA_CACHE);
    const response = new Response(JSON.stringify(emails), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put("/offline-emails", response);
    console.log("Emails cached for offline access");
  } catch (error) {
    console.error("Failed to cache emails:", error);
  }
}

// Periodic sync for fresh data (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-emails") {
    event.waitUntil(syncEmails());
  }
});
