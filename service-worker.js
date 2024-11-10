self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker activated');
});

self.addEventListener('message', function(event) {
    if (event.data.type === 'SET_NTFY_CREDENTIALS') {
        ntfyCredentials = event.data.credentials;
        startEventSource();
    }
});

function startEventSource() {
    const { topic, username, password, url } = ntfyCredentials;
    const completeUrl = `${url}/${topic}/sse`;

    const headers = new Headers({
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Bypass-Tunnel-Reminder': 'true'
    });


    const eventSourceInit = {
        headers: headers
    };

    const eventSource = new EventSource(completeUrl, eventSourceInit);

    eventSource.onmessage = function(event) {
        console.log('EventSource message received:', event.data);
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
