// 后端 API 请求逻辑
async function submitAuth() {
    hideAuthError(); 
    const name = document.getElementById('username-input').value.trim();
    const pwd = document.getElementById('password-input').value.trim();
    if (!name || !pwd) { showAuthError("请输入姓名和密码"); return; }
    
    const btn = document.getElementById('auth-btn');
    btn.innerText = "处理中..."; btn.disabled = true;

    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    try {
        const res = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password: pwd })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('class_english_logged_in', 'true');
            await loadDashboard();
        } else { showAuthError(data.error); }
    } catch (err) { showAuthError("网络连接失败"); }
    finally { btn.innerText = isRegisterMode ? "立即注册" : "立即登录"; btn.disabled = false; }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('class_english_logged_in');
    switchScreen('auth-screen');
}

async function loadDashboard() {
    switchScreen('dashboard-screen');
    try {
        const res = await fetch('/api/dashboard');
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        
        document.getElementById('display-name').innerText = data.name;
        
        // ==========================================
        // 🌟 核心修改 1：对接主页的高级看板与图表
        // ==========================================
        historyRecords = data.history;      // 给原有的日历组件使用
        globalHistoryData = data.history;   // 给新加的图表和下拉菜单使用
        
        // 呼叫更新函数，它会自动读取下拉菜单（默认7天），计算数字并画图
        if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }
        
        if(data.grade) { document.getElementById('grade-select').value = data.grade; }

        userMistakes = data.mistakes; 
        renderMistakes(userMistakes);
        
        const rRes = await fetch('/api/leaderboard');
        renderLeaderboard(await rRes.json(), data.name);
        
        renderCalendar();

    } catch (e) { console.error(e); }
}

async function changeGrade() {
    const newGrade = document.getElementById('grade-select').value;
    await fetch('/api/update_grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade })
    });
    await fetchWordData();
}

async function fetchWordData() {
    try {
        const res = await fetch('/api/words');
        if (!res.ok) throw new Error('后端词库接口报错');
        globalWordData = await res.json();
        document.getElementById('question-count').max = globalWordData.length;
    } catch (err) {
        console.error("加载词库失败：", err);
        globalWordData = []; 
    }
}

async function clearRecord() {
    if (!confirm("确定要清空所有记录吗？")) return;
    await fetch('/api/clear_record', { method: 'POST', headers: {'Content-Type': 'application/json'} });
    await loadDashboard();
}

// ==========================================
// 🌟 核心修改 2：拦截提交跳转，显示高级结算图表
// ==========================================
async function submitResult() {
    const total = currentQuestions.length;
    const correct = score;
    
    // 调用 ui.js 里的专属结算面板，自动算出正确率并画出近期图表
    if (typeof renderResultScreen === 'function') {
        renderResultScreen(correct, total, typeof historyRecords !== 'undefined' ? historyRecords : []);
    } else {
        switchScreen('result-screen');
    }
    
    document.getElementById('saving-status').innerText = "☁️ 正在保存成绩...";

    try {
        const res = await fetch('/api/submit', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                score: correct, 
                total: total, 
                wrong_answers: currentWrongAnswers, 
                correct_answers: currentCorrectAnswers
            })
        });
        
        if (res.ok) {
            // 【关键】：这里去掉了 await loadDashboard()，所以它绝对不会强行跳回主页了！
            document.getElementById('saving-status').innerText = "✅ 成绩已安全保存至云端，请点击下方按钮返回";
        } else {
            document.getElementById('saving-status').innerText = "❌ 服务器开了小差，保存失败";
        }
    } catch (e) {
        document.getElementById('saving-status').innerText = "📶 似乎断网了，请检查网络连接";
    }
}
