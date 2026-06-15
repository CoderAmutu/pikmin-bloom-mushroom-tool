const CACHE_NAME = "pikmin-mushroom-v1";
const CACHED_URLS = [
    "./",
    "./index.html",
    "./styles.css",
    "./script.js",
    "./favicon.ico",
    "./images/Pikmin-bg-desktop.jpg",
    "./images/Pikmin-bg-mobile.jpg",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHED_URLS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});

// --- 背景通知排程 ---

const scheduledNotifications = new Map(); // rowId -> { leadTimeoutId, respawnTimeoutId }

function formatTaipeiTime(timestamp) {
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}

async function isPageVisible() {
    const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    return windowClients.some((c) => c.visibilityState === "visible");
}

function cancelRowNotifications(rowId) {
    const existing = scheduledNotifications.get(rowId);
    if (!existing) return;
    clearTimeout(existing.leadTimeoutId);
    clearTimeout(existing.respawnTimeoutId);
    scheduledNotifications.delete(rowId);
}

function cancelAllNotifications() {
    for (const [, ids] of scheduledNotifications) {
        clearTimeout(ids.leadTimeoutId);
        clearTimeout(ids.respawnTimeoutId);
    }
    scheduledNotifications.clear();
}

function scheduleRowNotifications({ rowId, name, respawnTimestamp, leadTimestamp, notificationUrl }) {
    cancelRowNotifications(rowId);

    const now = Date.now();
    const ids = {};

    if (leadTimestamp && leadTimestamp > now) {
        ids.leadTimeoutId = setTimeout(async () => {
            if (await isPageVisible()) return;
            const secondsLeft = Math.max(0, Math.round((respawnTimestamp - Date.now()) / 1000));
            self.registration.showNotification(`還有 ${secondsLeft} 秒：${name}`, {
                body: `預計 ${formatTaipeiTime(respawnTimestamp)} 重生。`,
                icon: "./favicon.ico",
                badge: "./favicon.ico",
                tag: `pikmin-lead-${rowId}`,
                data: { url: notificationUrl },
            });
        }, leadTimestamp - now);
    }

    if (respawnTimestamp && respawnTimestamp > now) {
        ids.respawnTimeoutId = setTimeout(async () => {
            if (await isPageVisible()) return;
            self.registration.showNotification(`${name} 已重生`, {
                body: "可以準備重新挑戰這朵蘑菇了。",
                icon: "./favicon.ico",
                badge: "./favicon.ico",
                tag: `pikmin-respawn-${rowId}`,
                renotify: true,
                data: { url: notificationUrl },
            });
        }, respawnTimestamp - now);
    }

    if (ids.leadTimeoutId !== undefined || ids.respawnTimeoutId !== undefined) {
        scheduledNotifications.set(rowId, ids);
    }
}

self.addEventListener("message", (event) => {
    const { type } = event.data || {};
    if (type === "SCHEDULE_NOTIFICATION") {
        scheduleRowNotifications(event.data);
    } else if (type === "CANCEL_NOTIFICATION") {
        cancelRowNotifications(event.data.rowId);
    } else if (type === "CANCEL_ALL_NOTIFICATIONS") {
        cancelAllNotifications();
    }
});

// --- Web Push 接收 ---

self.addEventListener("push", (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "./images/ICON_192.png",
            badge: "./images/ICON_192.png",
            tag: data.tag,
            renotify: true,
            data: { url: self.location.origin },
        })
    );
});

// --- 通知點擊處理 ---

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || self.location.origin;

    event.waitUntil((async () => {
        const windowClients = await clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });

        for (const client of windowClients) {
            try {
                const clientUrl = new URL(client.url);
                const notificationUrl = new URL(targetUrl, self.location.origin);

                if (clientUrl.origin === notificationUrl.origin) {
                    if ("focus" in client) {
                        await client.focus();
                    }

                    if ("navigate" in client && client.url !== notificationUrl.href) {
                        await client.navigate(notificationUrl.href);
                    }
                    return;
                }
            } catch {
                // ignore malformed URL
            }
        }

        if (clients.openWindow) {
            await clients.openWindow(targetUrl);
        }
    })());
});
