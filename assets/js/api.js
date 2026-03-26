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
        document.getElementById('my-total-qs').innerText = data.stats.total;
        document.getElementById('my-accuracy').innerText = data.stats.accuracy + '%';
        
        if(data.grade) { document.getElementById('grade-select').value = data.grade; }

        userMistakes = data.mistakes; 
        renderMistakes(userMistakes);
        
        const rRes = await fetch('/api/leaderboard');
        renderLeaderboard(await rRes.json(), data.name);
        
        historyRecords = data.history;
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

async function submitResult() {
    document.getElementById('final-score').innerText = `得分: ${score} / ${currentQuestions.length}`;
    switchScreen('result-screen');
    
    try {
        const res = await fetch('/api/submit', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                score, 
                total: currentQuestions.length, 
                wrong_answers: currentWrongAnswers, 
                correct_answers: currentCorrectAnswers
            })
        });
        
        if (res.ok) {
            document.getElementById('saving-status').innerText = "✅ 数据已同步";
            await loadDashboard(); 
        }
    } catch (e) {
        document.getElementById('saving-status').innerText = "❌ 同步失败，请刷新";
    }
}