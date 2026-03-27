const CACHE_NAME = 'english-app-v1.05';

// 1. 安装阶段：立即接管控制权
self.addEventListener('install', (event) => { 
    self.skipWaiting(); 
});

// 2. 激活阶段：清理旧版本的缓存垃圾
self.addEventListener('activate', (event) => { 
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim()); 
});

// 3. 拦截请求阶段：智能分流
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // ==========================================
    // 策略 A：动态数据 (API 接口) -> 【网络优先】
    // ==========================================
    if (req.url.includes('/api/')) {
        
        // 🚨 【核心修复】：绝不缓存 POST 请求（如提交成绩、登录注册）
        if (req.method !== 'GET') {
            event.respondWith(fetch(req));
            return;
        }

        // 对于 GET 请求（如获取排行榜、词库），进行网络优先 + 缓存备份
        event.respondWith(
            fetch(req)
                .then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(req);
                })
        );
        return; // 处理完毕，直接返回
    }

    // ==========================================
    // 策略 B：静态资源 (HTML/CSS/JS) -> 【缓存优先】
    // ==========================================
    
    // 【安全护盾】：哪怕走到静态资源，也只缓存 GET 请求
    if (req.method !== 'GET') {
        event.respondWith(fetch(req));
        return;
    }

    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(req)
                .then((networkResponse) => {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
                        return new Response(
                            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f3f4f6;">' +
                            '<h2 style="color:#ef4444;margin-bottom:10px;">网络断开连接 📶</h2>' +
                            '<p style="color:#6b7280;text-align:center;padding:0 20px;">请检查手机网络后重新打开应用</p></div>', 
                            { status: 503, headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }) }
                        );
                    }
                });
        })
    );
});
