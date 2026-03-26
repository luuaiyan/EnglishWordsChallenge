// PWA 注册与桌面安装逻辑
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if(installBtn) installBtn.style.display = 'block'; 
});

const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if (isIos() && !isStandalone() && installBtn) {
    installBtn.style.display = 'block';
}

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') { installBtn.style.display = 'none'; }
            deferredPrompt = null;
        } else if (isIos()) {
            alert("🍎 苹果手机添加桌面步骤：\n\n1. 点击浏览器底部的【分享】图标(带向上箭头的方块)\n2. 向上滑动菜单，点击【添加到主屏幕】\n3. 点击右上角【添加】即可！");
        } else {
            alert("请在浏览器菜单右上角的【⋮】选项中寻找【添加到主屏幕】。");
        }
    });
}