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
