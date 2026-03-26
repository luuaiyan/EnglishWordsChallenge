// 全局配置与状态变量
const TIME_LIMIT = 10000;   //每题时间限制（毫秒）

let globalWordData = []; 
let userMistakes = [];   
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let currentWrongAnswers = []; 
let currentCorrectAnswers = []; 
let canClick = true;
let timerInterval;
let timeLeft = TIME_LIMIT;
let isRegisterMode = false; 

let currentModalIndex = 0;
let touchStartX = 0;
let touchEndX = 0;
let calCurrentDate = new Date();
let historyRecords = [];
let selectedDateStr = null; 

// 页面初始化逻辑
window.onload = async () => {
    const enterHandler = (e) => { if (e.key === 'Enter') submitAuth(); };
    document.getElementById('username-input').addEventListener('keyup', enterHandler);
    document.getElementById('password-input').addEventListener('keyup', enterHandler);

    await fetchWordData();
    
    try {
        if (localStorage.getItem('class_english_logged_in') === 'true') {
            await loadDashboard();
        } else {
            switchScreen('auth-screen');
        }
    } catch (e) {
        switchScreen('auth-screen');
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
};

// 基础工具函数：数组打乱
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}