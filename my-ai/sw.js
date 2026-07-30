const CACHE_NAME = 'pwa-chat-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('AIChatDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

function setDB(key, val) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('store', 'readwrite');
        tx.objectStore('store').put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.endsWith('/share-target') && event.request.method === 'POST') {
        event.respondWith((async () => {
            const formData = await event.request.formData();
            const sharedFiles = formData.getAll('shared_files');
            const processedFiles = [];

            for (const file of sharedFiles) {
                if (typeof file === 'string') {
                    if (file.trim()) {
                        processedFiles.push({
                            name: 'shared_text.txt',
                            content: file,
                            type: 'text/plain',
                            isBase64: false
                        });
                    }
                } else if (file && file.name) {
                    const isText = file.type.startsWith('text/') || 
                                   file.name.endsWith('.js') || 
                                   file.name.endsWith('.py') || 
                                   file.name.endsWith('.json') || 
                                   file.name.endsWith('.css') || 
                                   file.name.endsWith('.html');
                    if (isText) {
                        const text = await file.text();
                        processedFiles.push({
                            name: file.name,
                            content: text,
                            type: file.type,
                            isBase64: false
                        });
                    } else {
                        const buffer = await file.arrayBuffer();
                        let binary = '';
                        const bytes = new Uint8Array(buffer);
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        const base64 = 'data:' + file.type + ';base64,' + btoa(binary);
                        processedFiles.push({
                            name: file.name,
                            content: base64,
                            type: file.type,
                            isBase64: true
                        });
                    }
                }
            }

            if (processedFiles.length > 0) {
                await setDB('pendingSharedFiles', processedFiles);
            }

            return Response.redirect('./?shared=true', 303);
        })());
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});