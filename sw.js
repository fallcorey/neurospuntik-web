const CACHE_NAME = 'neuro-sputnik-v1.0.0';
const RUNTIME_CACHE = 'runtime-cache';

// Файлы для кэширования при установке
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/ollama-engine/ollama-web.js',
    '/ollama-engine/engine.js',
    '/games/memory-game.html',
    '/games/quiz-game.html',
    '/games/coding-game.html',
    '/learning/dataset-builder.js',
    '/learning/model-trainer.js',
    '/resources/models/tiny-llama.json',
    '/resources/icons/icon-192.png',
    '/resources/icons/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('🛠️ Service Worker устанавливается...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Кэшируем файлы приложения');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker активирован');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('🗑️ Удаляем старый кэш:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    // Пропускаем неподдерживаемые схемы
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Возвращаем кэшированный response если есть
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Иначе делаем сетевой запрос
                return caches.open(RUNTIME_CACHE).then(cache => {
                    return fetch(event.request).then(response => {
                        // Кэшируем только успешные запросы
                        if (response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(error => {
                        // Fallback для ошибок сети
                        console.log('🌐 Ошибка сети, используем кэш:', error);
                        return new Response(JSON.stringify({
                            error: 'Оффлайн режим',
                            message: 'Приложение работает без интернета'
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                });
            })
    );
});

// Фоновая синхронизация данных обучения
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('🔄 Фоновая синхронизация данных обучения');
        event.waitUntil(syncLearningData());
    }
});

async function syncLearningData() {
    // Здесь будет синхронизация данных обучения
    // когда появится интернет
    console.log('Синхронизируем данные обучения...');
}
