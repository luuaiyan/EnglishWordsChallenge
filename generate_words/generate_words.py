import json
import re
import os

def shorten_translation(def_str):
    if not def_str: return "无释义"
    res = def_str
    # 截断过于详细的释义（如第3义项以后的内容）
    match = re.search(r'(\b3\.| 3 |③)', res)
    if match: res = res[:match.start()].strip()
    if '|' in res: res = res.split('|')[0].strip()
    for sep in ['；', ';']:
        if sep in res:
            parts = res.split(sep)
            if len(parts) > 2: res = sep.join(parts[:2])
    if len(res) > 55: res = res[:52] + "..."
    res = re.sub(r'[,，。；;]$', '', res)
    return res

def main():
    json_file = '../现代英汉词典.json'

    # --- 1. 输入原始单词文件名 ---
    while True:
        input_name = input("请输入原始单词文件名 (直接回车默认使用 '单词.txt'): ").strip()
        if not input_name: 
            txt_file = "单词.txt"
        else:
            txt_file = input_name if input_name.lower().endswith('.txt') else input_name + ".txt"
        
        if os.path.exists(txt_file):
            break
        print(f"❌ 找不到文件 '{txt_file}'，请确认文件名是否正确并重新输入！")

    # --- 2. 输入要生成的输出文件名 ---
    while True:
        output_name = input("请输入要生成的词库文件名 (例如 words_1a): ").strip()
        if output_name:
            output_file = output_name if output_name.lower().endswith('.txt') else output_name + ".txt"
            break
        print("⚠️ 输出文件名不能为空！")

    # 检查词典文件
    if not os.path.exists(json_file):
        print(f"错误：请确保 {json_file} 在当前目录下！")
        return

    print(f"正在读取原始文件并自动去重: {txt_file} ...")
    
    # --- 新增：顺序去重逻辑 ---
    syllabus_words = []
    seen = set()
    with open(txt_file, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip()
            if word:
                # 转为小写进行重复判断，防止 "Apple" 和 "apple" 重复出现
                word_lower = word.lower()
                if word_lower not in seen:
                    syllabus_words.append(word)
                    seen.add(word_lower)
    
    duplicate_count = len(seen) - len(syllabus_words) # 这里其实逻辑上 syllabus_words 就是去重后的
    # 修正：实际重复数 = 原总行数 - 去重后的行数
    # 为了准确，我们重新算一下：
    with open(txt_file, 'r', encoding='utf-8') as f:
        raw_lines = [l.strip() for l in f if l.strip()]
    actual_duplicates = len(raw_lines) - len(syllabus_words)
    
    if actual_duplicates > 0:
        print(f"💡 提示：检测到并剔除了 {actual_duplicates} 个重复单词。")
    # -----------------------

    print("正在解析现代英汉词典 (请稍候)...")
    with open(json_file, 'r', encoding='utf-8') as f:
        dict_array = json.load(f)

    dict_exact = {} 
    dict_lower = {} 

    for item in dict_array:
        if 'headword' in item and item['headword']:
            hw = item['headword']
            dict_exact[hw] = item
            hw_lower = hw.lower()
            if hw_lower not in dict_lower or hw == hw_lower:
                dict_lower[hw_lower] = item

    output_lines = []
    
    print(f"正在匹配词汇并生成 {output_file} ...")
    for word in syllabus_words:
        word_info = dict_exact.get(word)
        if not word_info:
            word_info = dict_lower.get(word.lower())

        if word_info and word_info.get('def', '').startswith("►@@@LINK="):
            target_word = word_info['def'].replace("►@@@LINK=", "").strip()
            word_info = dict_exact.get(target_word) or dict_lower.get(target_word.lower())

        if word_info:
            real_word = word_info.get('headword', word)
            pron = word_info.get('pron')
            pron = pron.strip() if isinstance(pron, str) else ""
            
            if pron:
                phonetic_str = pron if (pron.startswith('[') and pron.endswith(']')) else f"[{pron}]"
            else:
                phonetic_str = ""
            
            raw_def = word_info.get('def')
            raw_def = str(raw_def) if raw_def is not None else "无释义"
            translation_str = shorten_translation(raw_def)
            
            line = f"{real_word} | {phonetic_str} | {translation_str}"
            output_lines.append(line)
        else:
            output_lines.append(f"{word} | | ")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(output_lines))

    print("-" * 30)
    print(f"✅ 处理完成！已保存为: {output_file}")
    print(f"有效单词总数: {len(output_lines)} (已去重)")

if __name__ == '__main__':
    main()