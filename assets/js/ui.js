// UI 渲染与交互逻辑
function hideAuthError() { document.getElementById('auth-error-msg').style.display = 'none'; }
function showAuthError(msg) {
    const el = document.getElementById('auth-error-msg');
    el.innerText = msg; el.style.display = 'block';
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? "账号注册" : "账号登录";
    document.getElementById('auth-btn').innerText = isRegisterMode ? "立即注册" : "立即登录";
    document.getElementById('auth-toggle-text').innerText = isRegisterMode ? "已有账号？点此登录" : "第一次来？点此注册";
    document.getElementById('password-input').value = "";
    hideAuthError(); 
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

/* ======== 日历组件 ======== */
function renderCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    document.getElementById('cal-month-year').innerText = `${year}年${month + 1}月`;
    document.getElementById('daily-stats-display').innerHTML = '👆 点击日期即可查看当天打卡成绩';

    const dailyData = {};
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    historyRecords.forEach(item => {
        const dayStr = item.date.substring(0, 10); 
        if (dayStr.startsWith(monthPrefix)) {
            if (!dailyData[dayStr]) {
                dailyData[dayStr] = { score: 0, total: 0, times: 0 };
            }
            dailyData[dayStr].score += item.score;
            dailyData[dayStr].total += item.total;
            dailyData[dayStr].times += 1;
        }
    });

    const firstDay = new Date(year, month, 1).getDay();
    const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('cal-grid');
    let html = '';

    for (let i = 0; i < emptyDays; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    const today = new Date();
    const isThisMonth = year === today.getFullYear() && month === today.getMonth();

    for (let i = 1; i <= totalDays; i++) {
        const isToday = isThisMonth && i === today.getDate();
        const borderStyle = isToday ? 'border: 2px solid var(--primary);' : '';
        
        const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayStats = dailyData[currentDayStr];
        
        const isSelected = (currentDayStr === selectedDateStr);
        const selectedClass = isSelected ? ' selected' : '';
        const activeClass = dayStats ? ' active-day' : '';

        if (dayStats) {
            html += `<div class="cal-day${activeClass}${selectedClass}" data-date="${currentDayStr}" style="${borderStyle}" onclick="handleDateClick('${currentDayStr}', ${dayStats.score}, ${dayStats.total}, ${dayStats.times})">${i}</div>`;
        } else {
            html += `<div class="cal-day${selectedClass}" data-date="${currentDayStr}" style="${borderStyle}" onclick="handleDateClick('${currentDayStr}', 0, 0, 0)">${i}</div>`;
        }
    }
    grid.innerHTML = html;
}

function handleDateClick(dateStr, score, total, times) {
    selectedDateStr = dateStr;
    document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
    const targetEl = document.querySelector(`.cal-day[data-date="${dateStr}"]`);
    if (targetEl) targetEl.classList.add('selected');

    if (times > 0) {
        const acc = Math.round((score / total) * 100);
        document.getElementById('daily-stats-display').innerHTML = `
            <div style="color: var(--text-main); margin-bottom: 6px; font-size: 15px;">📅 <span style="font-weight:900;">${dateStr}</span> 打卡 <span style="color:var(--primary); font-weight:900;">${times}</span> 次</div>
            <div style="font-size: 13px;">共答题 ${total} 道，做对 <span style="color:var(--correct); font-weight:900;">${score}</span> 道（正确率 ${acc}%）</div>
        `;
    } else {
        document.getElementById('daily-stats-display').innerHTML = `
            <div style="color: var(--text-main); margin-bottom: 4px; font-size: 15px;">📅 <span style="font-weight:900;">${dateStr}</span></div>
            <div style="font-size: 13px;">当日无打卡记录，继续加油哦！💪</div>
        `;
    }
}

function prevMonth() {
    selectedDateStr = null; 
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    selectedDateStr = null; 
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderCalendar();
}

/* ======== 数据看板与错题本 ======== */
function renderLeaderboard(list, myName) {
    const container = document.getElementById('dashboard-leaderboard');
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">暂无榜单数据</p>';
        return;
    }
    let html = '';
    list.forEach((user, i) => {
        let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="color:var(--text-muted); font-size:16px;">${i+1}</span>`;
        const isMe = user.name === myName;
        html += `
            <div class="rank-item" style="${isMe ? 'border:2px solid var(--primary);' : ''}">
                <div class="rank-medal">${medal}</div>
                <div class="rank-info">
                    <span class="rank-name" style="${isMe ? 'color:var(--primary);font-weight:900;' : ''}">${user.name}</span>
                    <div class="rank-details">
                        <span class="rank-acc">${user.accuracy}%</span>
                        <span class="rank-count">对${user.correct} / 共${user.total}</span>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function renderMistakes(list) {
    const container = document.getElementById('dashboard-mistakes');
    document.getElementById('mistake-count').innerText = list.length;
    document.getElementById('practice-mistakes-btn').style.display = list.length > 0 ? 'block' : 'none';
    
    if (list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">暂无错题</p>';
        return;
    }
    let html = '';
    list.forEach((item, index) => {
        html += `
            <div class="mistake-item" onclick="openModal(${index})">
                <span class="m-word">${item.word}</span>
                <span class="m-count">错 ${item.wrong_count} 次</span>
                <span class="m-trans">${item.translation}</span>
            </div>`;
    });
    container.innerHTML = html;
}

/* ======== 滑动弹窗逻辑 ======== */
function openModal(index) {
    currentModalIndex = index;
    updateModalContent();
    const m = document.getElementById('word-modal');
    m.style.display = 'flex';
    document.body.classList.add('stop-scroll');
    setTimeout(() => m.classList.add('show'), 10);
}

/* ======== 滑动弹窗逻辑与原声发音 ======== */

let maleVoice = null;
let femaleVoice = null;
let isMaleTurn = false;   
let lastSpokenWord = "";  
let currentUtterance = null; // 【防吞音补丁】：保存全局引用，防止被浏览器误当垃圾回收

function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // 【核心修复 1】：优先筛选出“纯本地”的语音包，彻底杜绝云端加载的卡顿和无声
    let localVoices = voices.filter(v => v.localService === true);
    // 如果浏览器不支持 localService 属性，就退一步使用所有语音
    if (localVoices.length === 0) localVoices = voices;

    // 筛选出英语发音
    const englishVoices = localVoices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length === 0) return;

    // 优先找英音 (en-GB)
    let ukVoices = englishVoices.filter(v => v.lang === 'en-GB');
    if (ukVoices.length === 0) ukVoices = englishVoices;

    // 尝试根据名字区分男女
    const maleNames = ['male', 'daniel', 'arthur', 'george'];
    const femaleNames = ['female', 'serena', 'hazel', 'martha', 'susan', 'alice', 'karen'];

    let males = ukVoices.filter(v => maleNames.some(name => v.name.toLowerCase().includes(name)));
    let females = ukVoices.filter(v => femaleNames.some(name => v.name.toLowerCase().includes(name)));

    // 分配声音
    maleVoice = males.length > 0 ? males[0] : ukVoices[0];
    femaleVoice = females.length > 0 ? females[0] : ukVoices[ukVoices.length - 1];

    // 【核心修复 2】：如果男女声不小心撞车了，强制在本地库里找一个不一样的！
    if (maleVoice === femaleVoice && englishVoices.length > 1) {
        femaleVoice = englishVoices.find(v => v.name !== maleVoice.name) || femaleVoice;
    }
}

if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

function playWordAudio(word) {
    if (!maleVoice || !femaleVoice) loadVoices(); 

    window.speechSynthesis.cancel(); 
    
    // 【核心修改】：删除了单词判断锁，现在每一次调用都会无条件切换男女声！
    isMaleTurn = !isMaleTurn; 
    
    currentUtterance = new SpeechSynthesisUtterance(word);
    currentUtterance.lang = 'en-GB'; 
    
    // 男女声差异化参数设置
    if (isMaleTurn && maleVoice) {
        currentUtterance.voice = maleVoice;
        currentUtterance.rate = 0.85;   // 男声语速
        currentUtterance.pitch = 0.95;  // 男声音调
        currentUtterance.volume = 0.85; // 男声音量
    } else if (!isMaleTurn && femaleVoice) {
        currentUtterance.voice = femaleVoice;
        currentUtterance.rate = 0.9;    // 女声语速
        currentUtterance.pitch = 1.05;  // 女声音调
        currentUtterance.volume = 1.0;  // 女声音量
    }
    
    setTimeout(() => {
        window.speechSynthesis.speak(currentUtterance);
    }, 50);
}

// 3. 更新弹窗内容（取消自动发音，精准绑定图标）
function updateModalContent() {
    if (!userMistakes || userMistakes.length === 0) return;
    const item = userMistakes[currentModalIndex];
    
    document.getElementById('modal-counter').innerText = `${currentModalIndex + 1} / ${userMistakes.length}`;
    
    const wordEl = document.getElementById('modal-word');
    const phoneticEl = document.getElementById('modal-phonetic');
    
    // 单词纯展示，取消点击事件
    wordEl.innerText = item.word;
    wordEl.style.cursor = 'default';
    wordEl.onclick = null; 
    
    // 将音标和独立的喇叭图标组合，给喇叭图标加上专属的 id
    const phoneticText = item.phonetic ? item.phonetic + " " : "";
    phoneticEl.innerHTML = `${phoneticText}<span id="speaker-icon" style="cursor: pointer; display: inline-block; padding: 5px; border-radius: 50%; transition: 0.2s;" title="点击发音">🔊</span>`;
    
    document.getElementById('modal-trans').innerText = item.translation;

    // 只有点击喇叭图标时，才触发发音
    const speakerIcon = document.getElementById('speaker-icon');
    speakerIcon.onclick = (e) => {
        e.stopPropagation(); // 防止点击穿透触发背景关闭
        
        // 给小喇叭加个点击缩放的微小动画反馈
        speakerIcon.style.transform = 'scale(0.8)';
        setTimeout(() => speakerIcon.style.transform = 'scale(1)', 150);
        
        playWordAudio(item.word);
    };
}

function prevMistake() {
    if (currentModalIndex > 0) { currentModalIndex--; } else { currentModalIndex = userMistakes.length - 1; }
    updateModalContent();
}

function nextMistake() {
    if (currentModalIndex < userMistakes.length - 1) { currentModalIndex++; } else { currentModalIndex = 0; }
    updateModalContent();
}

function closeModal(e) {
    if(e) e.stopPropagation();
    const m = document.getElementById('word-modal');
    m.classList.remove('show');
    document.body.classList.remove('stop-scroll');
    setTimeout(() => m.style.display = 'none', 200);
}

// 绑定触摸滑动监听
document.addEventListener("DOMContentLoaded", () => {
    const modalCard = document.getElementById('modal-card');
    if (modalCard) {
        modalCard.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        modalCard.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });
    }
});

function handleSwipe() {
    const swipeThreshold = 50; 
    if (Math.abs(touchEndX - touchStartX) > swipeThreshold) {
        if (touchEndX < touchStartX) { nextMistake(); } else { prevMistake(); }
    }
}