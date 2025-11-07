# 多阶段构建 Dockerfile for Railway
# 包含 Java 运行时和 Python 环境
# 注意：构建上下文应该是 backend/epaperdoorplate/ 目录

# 阶段 1：构建
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# 复制 Maven 配置文件
COPY pom.xml .
COPY src ./src

# 构建应用
RUN mvn clean package -DskipTests

# 阶段 2：运行时
FROM eclipse-temurin:21-jre

# 安装 Python 和依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制构建的 JAR
COPY --from=build /app/target/epaperdoorplate-1.0-SNAPSHOT.jar app.jar

# 复制 Python 脚本和依赖
# Python 脚本现在与 JAR 文件在同一目录
COPY render_doorplate_fixed.py /app/render_doorplate_fixed.py
COPY requirements.txt /app/requirements.txt

# 安装 Python 依赖
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# 暴露端口（Railway 会自动设置 PORT 环境变量）
EXPOSE 8080

# 启动应用
# Railway 会自动设置 PORT 环境变量，应用会从环境变量读取
ENTRYPOINT ["java", "-jar", "app.jar"]

