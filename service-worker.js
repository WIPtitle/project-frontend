self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
