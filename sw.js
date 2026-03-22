const CACHE_NAME = 'talkboy-v3';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/web-speech.js',
    './js/sherpa-transcriber.js',
    './js/audio-processor.js',
    './js/ui-controller.js',
    './js/utils.js',
    './js/gemini-api.js',
    './js/vu-meter.js',
    './js/word-cloud.js',
    './js/debug-panel.js',
    './images/favicon.png',
    './images/logo.png'
];

// Install - cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate - clean old caches (keep sherpa model cache)
self.addEventListener('activate', (event) => {
    const keepCaches = [CACHE_NAME, SHERPA_CACHE];
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => !keepCaches.includes(key))
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Sherpa-ONNX CDN — cache these persistently (model files never change)
const SHERPA_CDN = 'huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en';
const SHERPA_CACHE = 'sherpa-model-v1';

// Fetch handler
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Sherpa CDN files: cache-first (they never change, ~191MB total)
    if (url.hostname === 'huggingface.co' && url.pathname.includes('web-assembly-asr-sherpa-onnx-en')) {
        event.respondWith(
            caches.open(SHERPA_CACHE).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return fetch(event.request).then((response) => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }

    // Skip other cross-origin requests
    if (url.origin !== location.origin) return;

    // App files: network-first, fall back to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
