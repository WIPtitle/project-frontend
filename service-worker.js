let ntfyCredentials = null;
let eventSource = null;

self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(startNtfyListener());
});

self.addEventListener('message', function(event) {
    console.log("Received credentials");
    if (event.data.type === 'SET_NTFY_CREDENTIALS') {
        ntfyCredentials = event.data.credentials;
        if (eventSource) {
            eventSource.close();
        }
        startEventSource();
    }
});

async function startEventSource() {
    const { topic, username, password, url } = ntfyCredentials;
    const completeUrl = `${url}/${topic}/sse`;

    const headers = new Headers({
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Bypass-Tunnel-Reminder': 'true'
    });

    const eventSourceInit = {
        headers: headers
    };

    eventSource = new EventSource(completeUrl, eventSourceInit);

    eventSource.onmessage = async function(event) {
        console.log('EventSource message received:', event.data);
        await showNotification({ message: event.data });
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage(event.data));
        });
    };

    eventSource.onerror = function(error) {
        console.log('EventSource error:', error);
        eventSource.close();
        setTimeout(startEventSource, 5000);
    };
}

async function showNotification(message) {
  await self.registration.showNotification('New Message', {
    body: message.message,
    icon: '/icon.png',
    data: message
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'restart-ntfy-listener') {
    event.waitUntil(startNtfyListener());
  }
});

async function startNtfyListener() {
    if (ntfyCredentials) {
        await startEventSource();
    }
}
