// 每次你修改了 CSS、JS 代码，只需要把这里的 v1 改成 v2, v3... 
// 手机就会自动知道有新版本，在后台静默更新！
const CACHE_NAME = 'english-app-v2'; 

// 1. 安装阶段：立即接管控制权
self.addEventListener('install', (event) => { 
    self.skipWaiting(); 
});

// 2. 激活阶段：清理旧版本的缓存垃圾（比如 v1 升级到 v2 时，删掉 v1）
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
        event.respondWith(
            fetch(req)
                .then((networkResponse) => {
                    // 如果网络通畅，获取最新数据，并顺手在缓存里备份一份
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    // 如果断网了，去缓存里找上一次备份的数据顶上
                    return caches.match(req);
                })
        );
        return; // 处理完毕，直接返回
    }

    // ==========================================
    // 策略 B：静态资源 (HTML/CSS/JS) -> 【缓存优先】
    // ==========================================
    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            // 如果缓存里有这个文件，直接瞬间返回，实现“秒开”
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // 如果缓存里没有（比如第一次打开网页），就去网络下载
            return fetch(req)
                .then((networkResponse) => {
                    // 下载成功后，存进缓存，下次就能秒开了
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(req, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    // 如果既没有缓存，又断网了，且请求的是网页(HTML)
                    if (req.headers.get('accept').includes('text/html')) {
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