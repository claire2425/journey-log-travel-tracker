/*
 * Journey Log's offline cache deliberately contains only the public app shell.
 * Trips and expenses remain in IndexedDB; authenticated API traffic, map tiles,
 * carrier logos, and every other cross-origin request always go to the network.
 */

const CACHE_VERSION = "journey-log-v1";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const APP_SHELL_ROUTES = ["/", "/expenses"];
const AUTH_QUERY_PARAMETERS = [
  "access_token",
  "code",
  "error_code",
  "refresh_token",
  "token_hash",
];

function hasAuthenticationParameter(url) {
  return AUTH_QUERY_PARAMETERS.some((parameter) => url.searchParams.has(parameter));
}

function isSensitiveRequest(request, url) {
  return (
    request.headers.has("authorization") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth") ||
    hasAuthenticationParameter(url)
  );
}

async function cacheShellRoute(cache, route) {
  try {
    const response = await fetch(new Request(route, { cache: "reload" }));

    if (response.ok) {
      await cache.put(route, response.clone());
    }
  } catch {
    // A first install can happen without a stable connection. Runtime caching
    // will populate this entry the next time the route is visited online.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      await Promise.all(APP_SHELL_ROUTES.map((route) => cacheShellRoute(cache, route)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("journey-log-") && !cacheName.startsWith(CACHE_VERSION))
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const home = await cache.match("/");
    if (home) {
      return home;
    }

    return new Response("Journey Log is offline. Reconnect to continue.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Third-party map, image, logo, and Supabase requests are intentionally not
  // intercepted. This also prevents authenticated cloud data entering Cache Storage.
  if (url.origin !== self.location.origin || isSensitiveRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // The PNG report's world basemap is public reference data; caching it lets
  // a recap image be created offline after it has been downloaded once.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/reference-data/world-countries-50m.json") {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});
