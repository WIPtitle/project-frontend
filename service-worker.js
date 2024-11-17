let ntfyCredentials = null;
let eventSource = null;
let hostname = null;

self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(startNtfyListener());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetchWithRetry(event.request, 10)
  );
});

function fetchWithRetry(request, retries) {
  return fetch(request).then(response => {
    if (!response.ok && response.status === 502 && retries > 0) {
      console.log(`Retrying request: ${request.url}, attempts left: ${retries - 1}`);
      return new Promise(resolve => setTimeout(resolve, 500)).then(() => fetchWithRetry(request, retries - 1));
    }
    return response;
  }).catch(error => {
    if (retries > 0) {
      console.log(`Retrying request: ${request.url}, attempts left: ${retries - 1}`);
      return new Promise(resolve => setTimeout(resolve, 500)).then(() => fetchWithRetry(request, retries - 1));
    } else {
      throw error;
    }
  });
}

self.addEventListener('message', function(event) {
    console.log("Received credentials");
    if (event.data.type === 'SET_NTFY_CREDENTIALS') {
        ntfyCredentials = event.data.credentials;
        hostname = event.data.hostname;
        if (eventSource) {
            eventSource.close();
        }
        startEventSource();
    }
});

async function startEventSource() {
    const { topic, user, password } = ntfyCredentials;
    const url = `http://${hostname}:8080`
    const completeUrl = `${url}/${topic}/json`;

    const headers = new Headers({
        'Authorization': 'Basic ' + btoa(`${user}:${password}`)
    });

    try {
        const response = await fetch(completeUrl, { headers });

        if (!response.ok) {
            console.error('Failed to connect to ntfy');
            setTimeout(startEventSource, 5000);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n');
            for (const line of lines) {
                if (line) {
                    const message = JSON.parse(line);
                    if (message.event && ['open', 'keepalive', 'close'].includes(message.event)) {
                        continue; // Ignore ntfy configuration events
                    }
                    console.log('Message received:', line);
                    await showNotification({ message: line });
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => client.postMessage(line));
                    });
                }
            }
        }

        reader.releaseLock();

    } catch (error) {
        console.error('Error while listening to events:', error);
    } finally {
        setTimeout(startEventSource, 5000);
    }
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
