from flask import Flask, request, jsonify, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
import os
import re
import time
from datetime import datetime, timedelta

# ================= 时区强力补丁 =================
os.environ['TZ'] = 'Asia/Shanghai'
if hasattr(time, 'tzset'):
    time.tzset()

app = Flask(__name__, static_folder='.', static_url_path='')

# ================= 配置区 =================
app.secret_key = 'secret_key_for_class_english_study_2026'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30) 
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax' 

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://",
    strategy="fixed-window"
)

# ================= 赛季时间计算 (每月1号凌晨2点重置) =================
def get_current_period_start():
    """计算当前排行榜周期的起始时间界限"""
    now = datetime.now()
    # 构造本月1号凌晨 02:00:00 的时间阈值
    threshold = now.replace(day=1, hour=2, minute=0, second=0, microsecond=0)
    
    if now >= threshold:
        # 当前时间已过本月1号凌晨2点，处于【本月赛季】
        return threshold.strftime("%Y-%m-%d %H:%M")
    else:
        # 当前时间在本月1号凌晨2点之前，还在【上个月赛季】
        # 往前推2天回到上个月，再取上个月的1号凌晨2点
        prev_month_date = threshold - timedelta(days=2)
        prev_threshold = prev_month_date.replace(day=1, hour=2, minute=0, second=0, microsecond=0)
        return prev_threshold.strftime("%Y-%m-%d %H:%M")

# ================= PWA 核心文件 =================
def init_pwa_files():
    if not os.path.exists('manifest.json'):
        with open('manifest.json', 'w', encoding='utf-8') as f:
            f.write('''{
  "name": "班级英语挑战",
  "short_name": "英语挑战",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f1f5f9",
  "theme_color": "#4f46e5",
  "icons": []
}''')
    if not os.path.exists('sw.js'):
        with open('sw.js', 'w', encoding='utf-8') as f:
            f.write('''const CACHE_NAME = 'english-app-v1';
self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => {
        return new Response('<h2 style="text-align:center; margin-top:50px; color:#ef4444;">网络断开连接📶</h2><p style="text-align:center;">必须连接网络才能同步成绩，请检查网络后刷新重试！</p>', { status: 503, headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }) });
    }));
});''')

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('.', 'manifest.json')

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('.', 'sw.js')

# ================= 数据库操作 =================
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row  
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    name TEXT UNIQUE, 
                    password TEXT)''')
    conn.commit()
    
    try:
        c.execute("ALTER TABLE users ADD COLUMN grade TEXT DEFAULT '1a'")
        conn.commit()
    except Exception:
        pass

    c.execute('''CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    user_id INTEGER, 
                    score INTEGER, 
                    total INTEGER, 
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS mistakes (
                    user_id INTEGER, 
                    word TEXT, 
                    phonetic TEXT, 
                    translation TEXT, 
                    wrong_count INTEGER DEFAULT 1, 
                    UNIQUE(user_id, word))''')
    conn.commit()
    conn.close()

def get_allowed_names():
    if not os.path.exists('班级名单.txt'):
        return []
    with open('班级名单.txt', 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "操作太快啦！请休息 1 分钟后再试"}), 429

# ================= 核心接口 =================

@app.route('/api/register', methods=['POST'])
@limiter.limit("3 per minute")
def register():
    data = request.json
    name = data.get('name', '').strip()
    password = data.get('password', '').strip()

    if not name or not password:
        return jsonify({"error": "姓名和密码不能为空！"}), 400

    allowed_names = get_allowed_names()
    if name not in allowed_names:
        return jsonify({"error": "抱歉，你的姓名不在班级名单中，无法注册！"}), 403

    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute("SELECT id FROM users WHERE name=?", (name,))
    if c.fetchone():
        conn.close()
        return jsonify({"error": "该姓名已经注册过了，请直接登录！"}), 400

    hashed_pw = generate_password_hash(password)
    c.execute("INSERT INTO users (name, password, grade) VALUES (?, ?, '1a')", (name, hashed_pw))
    user_id = c.lastrowid
    conn.commit()
    conn.close()

    session.permanent = True
    session['user_id'] = user_id
    session['user_name'] = name
    return jsonify({"status": "success", "name": name})

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.json
    name = data.get('name', '').strip()
    password = data.get('password', '').strip()
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, password FROM users WHERE name=?", (name,))
    user = c.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "姓名未注册或密码错误，忘记密码请联系管理员"}), 401
    
    session.permanent = True
    session['user_id'] = user['id']
    session['user_name'] = name
    return jsonify({"status": "success", "name": name})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "请先登录"}), 401
    
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute("SELECT grade FROM users WHERE id=?", (user_id,))
    user_info = c.fetchone()
    current_grade = user_info['grade'] if user_info and user_info['grade'] else '1a'

    c.execute("SELECT score, total, date FROM history WHERE user_id=? ORDER BY date DESC", (user_id,))
    history = [dict(row) for row in c.fetchall()]
    
    c.execute("SELECT word, phonetic, translation, wrong_count FROM mistakes WHERE user_id=? ORDER BY wrong_count DESC", (user_id,))
    mistakes = [dict(row) for row in c.fetchall()]
    
    c.execute("SELECT SUM(score) as s_score, SUM(total) as s_total FROM history WHERE user_id=?", (user_id,))
    totals = c.fetchone()
    my_correct = totals['s_score'] or 0
    my_total = totals['s_total'] or 0
    my_accuracy = round((my_correct / my_total * 100), 1) if my_total > 0 else 0
    
    conn.close()
    return jsonify({
        "name": session.get('user_name'),
        "grade": current_grade,
        "history": history,
        "mistakes": mistakes,
        "stats": {"total": my_total, "correct": my_correct, "accuracy": my_accuracy}
    })

@app.route('/api/update_grade', methods=['POST'])
def update_grade():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "未登录"}), 401
    
    grade = request.json.get('grade', '1a')
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET grade=? WHERE id=?", (grade, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/submit', methods=['POST'])
def submit():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "未登录"}), 401
    
    data = request.json
    score = data.get('score')
    total = data.get('total')
    wrong_answers = data.get('wrong_answers', [])
    correct_answers = data.get('correct_answers', [])

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("INSERT INTO history (user_id, score, total, date) VALUES (?, ?, ?, ?)", (user_id, score, total, now_str))
        for item in wrong_answers:
            c.execute('''INSERT INTO mistakes (user_id, word, phonetic, translation, wrong_count) 
                         VALUES (?, ?, ?, ?, 1)
                         ON CONFLICT(user_id, word) DO UPDATE SET wrong_count = wrong_count + 1''', 
                      (user_id, item.get('word'), item.get('phonetic'), item.get('translation')))
        for item in correct_answers:
            c.execute("DELETE FROM mistakes WHERE user_id=? AND word=?", (user_id, item.get('word')))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
        
    return jsonify({"status": "success"})

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    conn = get_db_connection()
    c = conn.cursor()
    
    # 获取本赛季起始时间（每月1号凌晨2点）
    period_start = get_current_period_start()
    
    # 【核心修改】：通过 WHERE h.date >= ? 动态过滤掉上个月的数据，实现赛季清零！
    query = '''
        SELECT u.name, SUM(h.score) as correct, SUM(h.total) as total, 
               (SUM(h.score) * 100.0 / SUM(h.total)) as accuracy
        FROM history h
        JOIN users u ON h.user_id = u.id
        WHERE h.date >= ? 
        GROUP BY h.user_id
        HAVING SUM(h.total) >= 100
        ORDER BY accuracy DESC, total DESC
        LIMIT 10
    '''
    c.execute(query, (period_start,))
    results = [dict(row) for row in c.fetchall()]
    for r in results:
        r['accuracy'] = round(r['accuracy'], 1)
    conn.close()
    return jsonify(results)

@app.route('/api/clear_record', methods=['POST'])
def clear_record():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "未登录"}), 401
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM history WHERE user_id=?", (user_id,))
    c.execute("DELETE FROM mistakes WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/words', methods=['GET'])
def get_words():
    user_id = session.get('user_id')
    grade = '1a' 
    if user_id:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT grade FROM users WHERE id=?", (user_id,))
        user = c.fetchone()
        if user and user['grade']:
            grade = user['grade']
        conn.close()

    filename = f'generate_words/words_{grade}.txt'
    default_filename = 'generate_words/words.txt'
    
    target_file = filename if os.path.exists(filename) else default_filename

    words = []
    if os.path.exists(target_file):
        with open(target_file, 'r', encoding='utf-8') as f:
            for line in f:
                parts = [p.strip() for p in line.split('|') if p.strip()]
                if len(parts) >= 2:
                    word = parts[0]
                    phonetic = ""
                    translation_parts = []
                    for p in parts[1:]:
                        if '[' in p and ']' in p and not phonetic:
                            match = re.search(r'\[([^\]]+)\]', p)
                            if match: phonetic = f"[{match.group(1)}]"
                        else:
                            translation_parts.append(p)
                    
                    if not phonetic and len(parts) > 2:
                        phonetic = f"[{parts[1]}]" if not parts[1].startswith('[') else parts[1]
                        translation = " ".join(parts[2:])
                    else:
                        translation = " ".join(translation_parts)

                    words.append({
                        "word": word,
                        "phonetic": phonetic,
                        "translation": translation
                    })
    
    print(f"DEBUG: 正在尝试读取文件: {target_file}, 成功读取单词数: {len(words)}")
    
    return jsonify(words)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# ================= 启动逻辑 =================
init_db()
init_pwa_files()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
