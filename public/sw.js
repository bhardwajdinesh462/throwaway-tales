// Enhanced Service Worker for Push Notifications and Offline Support
// VERSION is checked on each build - changing it triggers cache invalidation
const SW_VERSION = "3.1.0";
const CACHE_NAME = `nullsto-${SW_VERSION}`;
const STATIC_CACHE = `nullsto-static-${SW_VERSION}`;
const DYNAMIC_CACHE = `nullsto-dynamic-${SW_VERSION}`;
const DATA_CACHE = `nullsto-data-${SW_VERSION}`;

// All cache names for this version
const CURRENT_CACHES = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE, DATA_CACHE];

// Static assets to cache on install
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/nullsto-favicon.png",
];

// API routes that should NEVER be cached (always fetch fresh)
const NEVER_CACHE_ROUTES = [
  "/rest/v1/app_settings",
  "/rest/v1/subscription_tiers",
];

// API routes that CAN be cached for offline access (less dynamic data)
const CACHEABLE_API_ROUTES = [
  "/rest/v1/domains",
  "/rest/v1/blogs",
];

// Check if a URL should never be cached
function shouldNeverCache(url) {
  return NEVER_CACHE_ROUTES.some(route => url.includes(route));
}

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing version ${SW_VERSION}...`);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log("[SW] Some static assets failed to cache:", err);
      });
    })
  );
  // Force activation of new service worker immediately
  self.skipWaiting();
});

// Activate event - clean up ALL old caches from previous versions
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating version ${SW_VERSION}...`);
  event.waitUntil(
    (async () => {
      // Get all cache names
      const cacheNames = await caches.keys();
      
      // Delete any cache that doesn't match current version
      const deletionPromises = cacheNames
        .filter((name) => {
          // Keep only caches that belong to current version
          const belongsToCurrentVersion = CURRENT_CACHES.includes(name);
          if (!belongsToCurrentVersion) {
            console.log(`[SW] Deleting old cache: ${name}`);
          }
          return !belongsToCurrentVersion;
        })
        .map((name) => caches.delete(name));
      
      await Promise.all(deletionPromises);
      
      // Notify all clients about the update
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({
          type: "SW_UPDATED",
          version: SW_VERSION,
          message: "New version available! Page will refresh for latest updates.",
        });
      });
      
      // Take control of all clients immediately
      await self.clients.claim();
      console.log(`[SW] Version ${SW_VERSION} now active and controlling all clients`);
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

  // CRITICAL: Never cache app_settings and subscription_tiers - always network only
  if (shouldNeverCache(url.pathname) || shouldNeverCache(url.href)) {
    event.respondWith(networkOnly(request));
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

// Network-only strategy (for dynamic settings that must always be fresh)
async function networkOnly(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log("Network-only request failed for:", request.url);
    return new Response(
      JSON.stringify({ error: "Network request failed", offline: true }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

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
