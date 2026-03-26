FROM python:3.10-slim
WORKDIR /app
# 基础优化
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# 安装系统工具
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
# 先安装依赖（利用缓存机制，提高构建速度）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# 注意：这里我们不 COPY 代码，因为我们要用 Compose 实时挂载
EXPOSE 5000
