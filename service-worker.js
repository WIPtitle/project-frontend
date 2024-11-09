self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker activated');
    startEventSource();
});

self.addEventListener('message', function(event) {
    console.log('Message received:', event.data);
});

function startEventSource() {
    const topic = 'mytopic';
    const username = 'username';
    const password = 'password';
    const url = `https://ntfy.sh/${topic}/sse`;

    const headers = new Headers({
        'Authorization': 'Basic ' + btoa(`${username}:${password}`)
    });

    const eventSourceInit = {
        headers: headers
    };

    const eventSource = new EventSource(url, eventSourceInit);

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
