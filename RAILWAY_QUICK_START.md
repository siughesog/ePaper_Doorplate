# 🚂 Railway 快速部署指南

## 📋 部署前准备

### **必须准备：**
1. ✅ GitHub 仓库（代码已提交）
2. ✅ MongoDB Atlas 连接字符串
3. ✅ AWS S3 凭证（如果使用 S3）
4. ✅ Railway 账户（https://railway.app）

---

## 🚀 快速部署步骤

### **步骤 1：在 Railway 创建项目**

1. 访问 https://railway.app
2. 登录（使用 GitHub）
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择你的仓库

### **步骤 2：设置根目录**

在 Railway 项目设置中：
- **Root Directory：** `backend/epaperdoorplate`
- 或者选择整个仓库，Railway 会自动检测

### **步骤 3：设置环境变量**

在 Railway 项目 → "Variables" 中添加：

```env
# 必须设置
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/test_for_Epaper_http_request?retryWrites=true&w=majority
JWT_SECRET=your-64-character-random-secret-key-here
SERVER_PORT=$PORT
SERVER_SSL_ENABLED=false
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ALLOW_LOCALHOST=false
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-key
STORAGE_S3_SECRET_KEY=your-secret
```

### **步骤 4：部署**

Railway 会自动：
- 检测 Maven 项目
- 安装 Python（通过 nixpacks.toml）
- 构建项目
- 启动应用

### **步骤 5：获取部署 URL**

部署成功后，Railway 会提供：
- 临时 URL：`https://your-project.up.railway.app`
- 可以设置自定义域名

---

## ⚙️ 重要配置说明

### **1. SERVER_PORT=$PORT**

**必须使用 `$PORT`**，Railway 会自动设置：
```env
SERVER_PORT=$PORT
```

### **2. SERVER_SSL_ENABLED=false**

Railway 提供平台 SSL，不需要自己的证书：
```env
SERVER_SSL_ENABLED=false
```

### **3. Python 脚本路径**

确保 `render_doorplate_fixed.py` 在 `backend/` 目录。

Railway 中的工作目录可能是 `/app/`，`getBackendPath()` 应该能找到脚本。

---

## 🔍 验证部署

部署后检查：

1. **查看日志：**
   - Railway 控制台 → "Deployments" → 查看日志
   - 确认应用启动成功
   - 确认 Python 脚本路径正确

2. **测试 API：**
   ```bash
   curl https://your-project.up.railway.app/
   ```

3. **检查环境变量：**
   - 确认所有环境变量已设置
   - 确认值正确

---

## 📝 完整环境变量列表

见 `RAILWAY_ENV_VARIABLES.md`

---

## 🐛 常见问题

### **问题 1：Python 脚本找不到**

**解决：**
- 确保 `render_doorplate_fixed.py` 在 `backend/` 目录
- 检查构建日志中的路径信息

### **问题 2：构建失败**

**解决：**
- 检查 Maven 构建日志
- 确认所有依赖可用
- 检查 Java 版本（需要 Java 21）

### **问题 3：端口错误**

**解决：**
- 确保 `SERVER_PORT=$PORT`
- 不要硬编码端口

---

## 📚 详细文档

- [完整部署指南](./RAILWAY_DEPLOYMENT_GUIDE.md)
- [环境变量清单](./RAILWAY_ENV_VARIABLES.md)
- [云端部署配置清单](./CLOUD_DEPLOYMENT_CONFIG_CHECKLIST.md)

