// 答题与测验核心逻辑
function startQuiz(mode) {
    let src = mode === 'mistakes' ? userMistakes : globalWordData;
    
    if (!src || src.length === 0) {
        alert("当前年级词库还没准备好，或者没有错题哦！");
        return;
    }
    
    let req = mode === 'mistakes' ? src.length : parseInt(document.getElementById('question-count').value);
    currentQuestions = []; // 清空当前题目列表

    if (mode === 'mistakes') {
        // 错题本模式：保持原来的随机抽取即可，因为错题本来就是要反复练的
        currentQuestions = shuffleArray([...src]).slice(0, Math.min(req || 20, src.length));
    } else {
        // 【全新逻辑】：全库测验模式，优先抽完一整轮不重复的单词
        const username = document.getElementById('display-name').innerText;
        const grade = document.getElementById('grade-select').value;
        
        // 为当前用户、当前年级生成一个专属的本地存储 Key
        const storageKey = `untested_words_${username}_${grade}`;

        // 从本地缓存读取还没做的单词列表 (只存了单词的英文，节省空间)
        let remainingWords = JSON.parse(localStorage.getItem(storageKey) || '[]');

        // 过滤脏数据（防止你在后台修改了 txt 词库文件，删掉了一些词，这里会报错）
        const allWordsInCurrentGrade = globalWordData.map(w => w.word);
        remainingWords = remainingWords.filter(w => allWordsInCurrentGrade.includes(w));

        // 只要要求的题数还没抽满，就一直抽
        while (currentQuestions.length < req) {
            
            // 如果池子抽空了（或者第一次进来池子没建立），重新装满一整本词汇，开启新一轮复习！
            if (remainingWords.length === 0) {
                remainingWords = [...allWordsInCurrentGrade];
            }

            // 把剩下的词打乱顺序
            remainingWords = shuffleArray(remainingWords);

            // 计算当前还缺几道题
            let needed = req - currentQuestions.length;

            // 从剩下的词中切出需要的数量（splice 会把抽出的词从 remainingWords 里彻底删掉）
            let chunk = remainingWords.splice(0, needed);

            // 将刚才抽出的英文单词字符串，映射回包含音标和翻译的完整对象
            let chunkObjects = chunk.map(w => globalWordData.find(g => g.word === w));
            currentQuestions = currentQuestions.concat(chunkObjects);
        }

        // 极其关键：把被抽走后【最新剩下的单词】存回手机本地，下次测验接着这个进度抽！
        localStorage.setItem(storageKey, JSON.stringify(remainingWords));
    }

    // 初始化答题进度
    currentIndex = 0; 
    score = 0; 
    currentWrongAnswers = []; 
    currentCorrectAnswers = [];
    
    switchScreen('quiz-screen'); 
    loadQuestion();
}

function loadQuestion() {
    canClick = true;
    const total = currentQuestions.length;
    const cur = currentIndex + 1;
    document.getElementById('progress-text').innerText = `${cur} / ${total}`;
    document.getElementById('progress-bar').style.width = `${(cur/total)*100}%`;
    
    const item = currentQuestions[currentIndex];
    const isEnglishToChinese = Math.random() > 0.5; 
    let correct = isEnglishToChinese ? item.translation : item.word;

    const elWord = document.getElementById('q-word');
    const elPhonetic = document.getElementById('q-phonetic');
    const elTrans = document.getElementById('q-trans');

    if (isEnglishToChinese) {
        // 考英文释义：显示英文，允许点击发音
        elWord.innerText = item.word;
        elWord.style.color = 'var(--text-main)';
        elWord.style.cursor = 'pointer'; 
        elWord.onclick = () => playWordAudio(item.word);
        
        const phoneticText = item.phonetic ? item.phonetic + " " : "";
        elPhonetic.innerHTML = `${phoneticText}<span style="cursor: pointer;" title="点击发音">🔊</span>`;
        elPhonetic.onclick = () => playWordAudio(item.word);
        
        elTrans.innerText = "_________";
        elTrans.style.color = 'var(--text-muted)';
        
        // 【关键修改】：延迟 1000毫秒（1秒）后再自动发音
        setTimeout(() => {
            // 增加安全判断：如果小朋友在这 1 秒内已经秒答了题（canClick 变成 false），就不自动播报了，防止声音冲突
            if (canClick) {
                playWordAudio(item.word);
            }
        }, 800);
        
    } else {
        // 考中文对应英文：隐藏英文，不允许点击
        elWord.innerText = "_________";
        elWord.style.color = 'var(--text-muted)';
        elWord.style.cursor = 'default';
        elWord.onclick = null;
        
        elPhonetic.innerHTML = ""; 
        elPhonetic.onclick = null;
        
        elTrans.innerText = item.translation;
        elTrans.style.color = 'var(--text-main)';
    }

    let opts = [correct];
    while(opts.length < 3) {
        let r = globalWordData[Math.floor(Math.random()*globalWordData.length)];
        let d = isEnglishToChinese ? r.translation : r.word;
        if(!opts.includes(d)) opts.push(d);
    }
    opts = shuffleArray(opts);
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    ['A','B','C'].forEach((l, i) => {
        const b = document.createElement('button');
        b.className = 'option-btn';
        b.style.padding = "22px 24px";
        b.style.borderRadius = "20px";
        b.style.marginBottom = "16px";
        b.innerHTML = `<span class="option-label" style="width:36px; height:36px; font-size:18px;">${l}</span><span class="option-text" style="font-size:18px;">${opts[i]}</span>`;
        b.onclick = () => checkAnswer(b, opts[i], correct);
        container.appendChild(b);
    });
    
    startTimer(correct);
}

function startTimer(correct) {
    clearInterval(timerInterval);
    timeLeft = TIME_LIMIT;
    const bar = document.getElementById('timer-bar');
    timerInterval = setInterval(() => {
        timeLeft -= 50;
        let p = (timeLeft/TIME_LIMIT)*100;
        bar.style.width = p+'%';
        bar.style.backgroundColor = p > 50 ? 'var(--correct)' : p > 20 ? '#f59e0b' : 'var(--wrong)';
        if(timeLeft <= 0) { clearInterval(timerInterval); checkAnswer(null, null, correct); }
    }, 50);
}

function checkAnswer(btn, sel, correct) {
    if(!canClick) return; canClick = false; clearInterval(timerInterval);
    const curItem = currentQuestions[currentIndex];
    
    // 【关键新增】：不管答对还是答错，在公布答案时都会读一遍纯正英音！
    playWordAudio(curItem.word);
    
    // 【细节优化】：如果是考“看中文选英文”，答完题后把上面隐藏的英文单词和音标展示出来
    const isEnglishToChinese = (document.getElementById('q-word').innerText !== "_________");
    if (!isEnglishToChinese) {
        const elWord = document.getElementById('q-word');
        elWord.innerText = curItem.word;
        // 答对单词标绿，答错单词标红
        elWord.style.color = (sel === correct) ? 'var(--correct)' : 'var(--wrong)'; 
        document.getElementById('q-phonetic').innerText = curItem.phonetic || "";
    }

    if(sel === correct) {
        if(btn) btn.classList.add('correct-btn');
        score++;
        currentCorrectAnswers.push({word: curItem.word});
    } else {
        if(btn) btn.classList.add('wrong-btn');
        currentWrongAnswers.push({word: curItem.word, phonetic: curItem.phonetic, translation: curItem.translation});
        Array.from(document.querySelectorAll('.option-btn')).forEach(b => {
            if(b.querySelector('.option-text').innerText === correct) b.classList.add('correct-btn');
        });
    }
    
    // 稍微延长跳转时间到2秒 (2000ms)，让发音有充足的时间播完
    setTimeout(() => {
        currentIndex++;
        if(currentIndex < currentQuestions.length) loadQuestion();
        else submitResult();
    }, 1500); 
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