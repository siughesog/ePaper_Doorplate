# 🌐 云端部署配置检查清单

本文档列出部署到云端所需的所有配置项。

---

## ✅ 必须配置的环境变量

### 1. **数据库配置（MongoDB）**

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/epaperdoorplate?retryWrites=true&w=majority
```

**说明：**
- 使用 MongoDB Atlas 连接字符串
- 确保网络访问白名单已配置
- 密码需要 URL 编码（特殊字符）

---

### 2. **JWT 配置（安全关键）**

```env
JWT_SECRET=your-very-long-random-secret-key-minimum-64-characters-here
JWT_EXPIRATION=86400000
```

**生成强密钥的方法：**

**PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

**Linux/macOS:**
```bash
openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
```

**在线工具：**
- https://www.grc.com/passwords.htm
- 选择 "64 Random Printable Characters"

**⚠️ 重要：**
- 至少 64 个字符
- 使用随机生成的强密钥
- 不要使用默认值
- 妥善保管，不要泄露

---

### 3. **HTTPS/SSL 配置**

#### 选项 A：使用平台提供的 SSL（推荐）

**Railway/Render/Vercel 等平台：**
- 平台自动提供 SSL 证书
- 不需要配置 keystore
- 需要禁用 Spring Boot 内置 HTTPS

**配置：**
```env
# 禁用 Spring Boot 内置 HTTPS（使用平台 SSL）
SERVER_SSL_ENABLED=false
SERVER_PORT=8080
```

**修改 `application.yml`：**
```yaml
server:
  port: ${SERVER_PORT:8080}
  ssl:
    enabled: ${SERVER_SSL_ENABLED:false}  # 改为 false
```

#### 选项 B：使用自己的 SSL 证书

如果需要使用自己的证书：

```env
KEYSTORE_PASSWORD=your-keystore-password
```

**需要准备：**
1. `keystore.p12` 文件（PKCS12 格式）
2. 证书密码
3. 将证书文件放在 `src/main/resources/` 目录

**生成自签名证书（仅用于测试）：**
```bash
keytool -genkeypair -alias tomcat -keyalg RSA -keysize 2048 \
  -storetype PKCS12 -keystore keystore.p12 \
  -validity 365 -storepass your-password
```

**⚠️ 注意：**
- 生产环境应使用正式 CA 签发的证书（Let's Encrypt 等）
- 自签名证书会导致浏览器警告

---

### 4. **CORS 配置（重要）**

#### 开发环境（本地调试）

**默认配置：**
- `ALLOW_LOCALHOST=true`（默认值）
- 自动允许以下 localhost 地址：
  - `http://localhost:3000`
  - `https://localhost:3000`
  - `http://localhost:8080`
  - `https://localhost:8080`
  - `http://127.0.0.1:3000`
  - `https://127.0.0.1:3000`
  - `http://127.0.0.1:8080`
  - `https://127.0.0.1:8080`

**说明：**
- 开发环境默认允许 localhost，无需额外配置
- 启动时会看到：`🔧 開發模式：已允許 localhost 訪問`

#### 生产环境（云端部署）

```env
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
ALLOW_LOCALHOST=false
```

**说明：**
- **必须设置 `ALLOWED_ORIGINS`**：包含所有生产环境域名
- **设置 `ALLOW_LOCALHOST=false`**：禁用 localhost 访问（安全）
- **只包含生产环境的域名**：不要包含开发环境域名
- **移除 `localhost` 和 `*`**：系统会自动拒绝这些值
- **多个域名用逗号分隔**：不需要空格
- **必须包含 `https://` 协议**：系统会自动拒绝 `http://` 协议
- **自动验证**：系统会验证所有域名格式，无效的域名会被拒绝

**验证规则（生产环境）：**
- ✅ 必须以 `https://` 开头
- ✅ 不能包含 `localhost` 或 `127.0.0.1`
- ✅ 不能是 `*` 通配符
- ✅ 域名格式必须正确

**示例：**
```env
# ✅ 正确（生产环境）
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOWED_ORIGINS=https://your-app.vercel.app
ALLOW_LOCALHOST=false

# ❌ 错误（会被自动拒绝）
ALLOWED_ORIGINS=*                                    # 不允许通配符
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000  # 不允许 localhost 和 http://
ALLOWED_ORIGINS=http://yourdomain.com               # 必须使用 https://
```

**启动时检查：**
- 开发环境：`🔧 開發模式：已允許 localhost 訪問`
- 生产环境：`✅ CORS 已配置，允許的來源: [https://yourdomain.com]`
- 如果配置错误，会看到详细的错误信息，说明哪些域名被拒绝及原因

---

### 5. **存储配置（S3）**

```env
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket-name
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-access-key-id
STORAGE_S3_SECRET_KEY=your-secret-access-key
```

**说明：**
- `STORAGE_TYPE` 必须设置为 `s3`
- Bucket 名称必须全局唯一
- Region 选择离用户最近的区域
- Access Key 和 Secret Key 从 AWS IAM 获取

---

### 6. **Spring Security 配置（可选）**

```env
SPRING_SECURITY_USER_NAME=admin
SPRING_SECURITY_USER_PASSWORD=your-secure-password
```

**说明：**
- 这是 Spring Security 的默认用户（如果使用）
- 生产环境建议使用强密码
- 如果只使用 JWT，这个可以忽略

---

### 7. **服务器配置**

```env
SERVER_PORT=8080
SERVER_ADDRESS=0.0.0.0
```

**说明：**
- `SERVER_PORT` 通常由平台自动设置
- `SERVER_ADDRESS=0.0.0.0` 允许外部访问

---

## 📋 完整环境变量清单

### Railway/Render 部署平台

在平台的环境变量设置中添加：

```env
# ============================================
# 数据库配置
# ============================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/epaperdoorplate?retryWrites=true&w=majority

# ============================================
# JWT 配置（必须！）
# ============================================
JWT_SECRET=your-64-character-random-secret-key-here
JWT_EXPIRATION=86400000

# ============================================
# HTTPS/SSL 配置
# ============================================
# 如果使用平台 SSL（推荐），设置为 false
SERVER_SSL_ENABLED=false
SERVER_PORT=8080

# 如果使用自己的证书，需要设置：
# KEYSTORE_PASSWORD=your-keystore-password

# ============================================
# CORS 配置（必须！）
# ============================================
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ALLOW_LOCALHOST=false  # 生产环境禁用 localhost

# ============================================
# 存储配置（S3）
# ============================================
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket-name
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-access-key-id
STORAGE_S3_SECRET_KEY=your-secret-access-key

# ============================================
# Spring Security（可选）
# ============================================
SPRING_SECURITY_USER_NAME=admin
SPRING_SECURITY_USER_PASSWORD=your-secure-password
```

---

## 🔧 需要修改的配置文件

### 1. **application.yml - HTTPS 配置**

**如果使用平台 SSL（推荐）：**

```yaml
server:
  port: ${SERVER_PORT:8080}
  ssl:
    enabled: ${SERVER_SSL_ENABLED:false}  # 改为 false
    # 注释掉或删除以下行：
    # key-store: classpath:keystore.p12
    # key-store-password: ${KEYSTORE_PASSWORD:123456}
    # key-store-type: PKCS12
    # key-alias: tomcat
```

**如果使用自己的证书：**

保持当前配置，但确保：
- `keystore.p12` 文件存在
- `KEYSTORE_PASSWORD` 环境变量已设置

---

## 📝 部署前检查清单

### 后端配置

- [ ] **MongoDB URI** 已配置（MongoDB Atlas）
- [ ] **JWT_SECRET** 已设置（强密钥，至少 64 字符）
- [ ] **HTTPS 配置**：
  - [ ] 如果使用平台 SSL：`SERVER_SSL_ENABLED=false`
  - [ ] 如果使用自己的证书：`keystore.p12` 已准备
- [ ] **CORS** 已配置（只包含生产域名）
- [ ] **S3 配置** 已设置（如果使用 S3）
- [ ] **ALLOWED_ORIGINS** 已更新为前端域名

### 前端配置

- [ ] **REACT_APP_API_BASE_URL** 已设置为后端 URL
- [ ] 构建命令：`npm run build`
- [ ] 输出目录：`build`

### 安全配置

- [ ] 所有默认密码已更改
- [ ] JWT Secret 是强随机密钥
- [ ] CORS 只允许生产域名
- [ ] S3 Access Key 权限最小化
- [ ] 环境变量已妥善保管

---

## 🚨 常见问题

### 1. HTTPS 证书错误

**问题：** `keystore.p12 not found`

**解决：**
- 如果使用平台 SSL：设置 `SERVER_SSL_ENABLED=false`
- 如果使用自己的证书：确保 `keystore.p12` 在 `src/main/resources/` 目录

### 2. CORS 错误

**问题：** 前端无法访问后端 API

**解决：**
- 检查 `ALLOWED_ORIGINS` 是否包含前端域名
- 确保域名完全匹配（包括 `https://`）
- 检查后端日志中的 CORS 配置

### 3. JWT 验证失败

**问题：** Token 验证失败

**解决：**
- 确保 `JWT_SECRET` 在前后端一致（如果前端也验证）
- 检查 JWT Secret 是否足够长（至少 64 字符）
- 检查 Token 是否过期

### 4. S3 访问失败

**问题：** 图片无法上传或加载

**解决：**
- 检查 S3 Bucket 名称是否正确
- 检查 Access Key 和 Secret Key 是否正确
- 检查 IAM 用户权限
- 检查 Bucket 区域设置

---

## 💡 推荐配置方案

### 方案 A：使用平台 SSL（最简单）

**优点：**
- 不需要管理证书
- 自动续期
- 配置简单

**配置：**
```yaml
server:
  ssl:
    enabled: false  # 使用平台 SSL
```

**环境变量：**
```env
SERVER_SSL_ENABLED=false
```

### 方案 B：使用 Let's Encrypt（免费正式证书）

**优点：**
- 免费
- 浏览器信任
- 自动续期

**步骤：**
1. 使用 Certbot 获取证书
2. 转换为 PKCS12 格式：
   ```bash
   openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem \
     -out keystore.p12 -name tomcat -CAfile chain.pem
   ```
3. 上传到项目

---

## 📊 配置优先级

Spring Boot 配置优先级（从高到低）：
1. **环境变量**（最高优先级）
2. `application.yml` 中的值
3. 默认值

**建议：**
- 敏感信息（密码、密钥）使用环境变量
- 非敏感配置可以放在 `application.yml`

---

## ✅ 部署后验证

部署完成后，检查：

1. **后端健康检查：**
   ```bash
   curl https://your-backend-domain.com/
   ```

2. **API 测试：**
   ```bash
   curl https://your-backend-domain.com/api/auth/login
   ```

3. **图片访问：**
   ```bash
   curl https://your-backend-domain.com/images/test.webp
   ```

4. **前端连接：**
   - 打开前端网站
   - 尝试登录
   - 检查浏览器控制台是否有错误

---

## 🔒 安全最佳实践

1. **使用强密码和密钥**
   - JWT Secret：至少 64 字符
   - 数据库密码：至少 16 字符
   - Keystore 密码：至少 16 字符

2. **限制 CORS**
   - 只允许生产域名
   - 不要使用 `*`

3. **使用环境变量**
   - 不要硬编码密码
   - 不要提交 `.env` 文件到 Git

4. **定期更新**
   - 定期更换 JWT Secret
   - 定期更新依赖包
   - 监控安全漏洞

---

## 📚 相关文档

- [环境变量配置指南](./ENVIRONMENT_VARIABLES_SETUP.md)
- [HTTPS 设置指南](./HTTPS_SETUP.md)
- [云端部署步骤指南](./CLOUD_DEPLOYMENT_STEP_BY_STEP.md)

---

**记住：** 生产环境必须配置所有敏感信息，不要使用默认值！

