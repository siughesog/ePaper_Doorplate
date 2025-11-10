# 🚂 Railway 環境變數完整清單

本文檔列出部署到 Railway 所需的所有環境變數。

---

## ✅ 必須設置的環境變數

### 1. **資料庫配置（MongoDB）**

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/epaperdoorplate?retryWrites=true&w=majority
```

**說明：**
- 使用 MongoDB Atlas 連接字符串
- 確保網絡訪問白名單已配置
- 密碼需要 URL 編碼（特殊字符）

---

### 2. **JWT 配置（安全關鍵）**

```env
JWT_SECRET=your-very-long-random-secret-key-minimum-64-characters-here
JWT_EXPIRATION=86400000
```

**生成強密鑰的方法：**

**PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

**Linux/macOS:**
```bash
openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
```

**⚠️ 重要：**
- 至少 64 個字符
- 使用隨機生成的強密鑰
- 不要使用默認值
- 妥善保管，不要洩露

---

### 3. **服務器配置**

```env
SERVER_PORT=$PORT
SERVER_ADDRESS=0.0.0.0
SERVER_SSL_ENABLED=false
```

**說明：**
- `SERVER_PORT=$PORT` - Railway 會自動設置 PORT 環境變數
- `SERVER_SSL_ENABLED=false` - Railway 提供平台 SSL，不需要自己的證書

---

### 4. **CORS 配置**

```env
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ALLOW_LOCALHOST=false
```

**說明：**
- 只允許 HTTPS 來源
- 不允許 localhost（生產環境）
- 可以設置多個來源，用逗號分隔

---

### 5. **存儲配置（S3）**

```env
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket-name
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-access-key-id
STORAGE_S3_SECRET_KEY=your-secret-access-key
```

**說明：**
- `STORAGE_TYPE` 必須設置為 `s3`
- Bucket 名稱必須全局唯一
- Region 選擇離用戶最近的區域
- Access Key 和 Secret Key 從 AWS IAM 獲取

---

### 6. **Line Bot 配置（新增）**

```env
LINE_BOT_CHANNEL_SECRET=your-channel-secret
LINE_BOT_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_BOT_BOT_ID=your-bot-id
LINE_BOT_WEBHOOK_URL=https://your-project.up.railway.app/api/line/webhook
```

**說明：**
- `LINE_BOT_CHANNEL_SECRET` - 從 Line Developers Console 獲取
- `LINE_BOT_CHANNEL_ACCESS_TOKEN` - 從 Line Developers Console 獲取
- `LINE_BOT_BOT_ID` - Bot ID（不包含 @ 符號），例如：`abc123`
- `LINE_BOT_WEBHOOK_URL` - 您的後端 webhook 端點 URL

**如何獲取：**
1. 登入 [Line Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Bot
3. 在 "Basic settings" 頁面找到 Channel Secret 和 Channel Access Token
4. 在 "Messaging API" 頁面找到 Bot ID
5. 在 "Messaging API" 頁面設置 Webhook URL

---

### 7. **Guest 訊息防濫用配置（可選，有預設值）**

```env
GUEST_MESSAGE_MAX_PER_IP_PER_HOUR=3
GUEST_MESSAGE_MAX_PER_DEVICE_PER_HOUR=5
```

**說明：**
- 同一 IP 地址在 1 小時內最多留言次數（預設：3）
- 同一設備在 1 小時內最多留言次數（預設：5）
- 如果不設置，會使用預設值

---

### 8. **Email 配置（可選，用於忘記密碼功能）**

```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**說明：**
- `EMAIL_ENABLED` - 是否啟用 Email 發送功能（`true` 或 `false`）
- `EMAIL_SMTP_HOST` - SMTP 服務器地址
- `EMAIL_SMTP_PORT` - SMTP 端口（通常為 587 或 465）
- `EMAIL_SMTP_USERNAME` - SMTP 用戶名（通常是您的 email 地址）
- `EMAIL_SMTP_PASSWORD` - SMTP 密碼（Gmail 需要使用應用程式密碼）
- `EMAIL_FROM` - 發送者 email 地址

**常見 SMTP 服務器配置：**

**Gmail:**
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-16-char-app-password
EMAIL_FROM=your-email@gmail.com
```
⚠️ **重要：** Gmail 需要使用「應用程式密碼」，不是帳戶密碼。如何獲取：
1. 登入 Google 帳戶
2. 前往「安全性」→「兩步驟驗證」
3. 在「應用程式密碼」中生成一個 16 位密碼
4. 使用這個密碼作為 `EMAIL_SMTP_PASSWORD`

**Outlook/Hotmail:**
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp-mail.outlook.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your-email@outlook.com
EMAIL_SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@outlook.com
```

**SendGrid:**
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.sendgrid.net
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=apikey
EMAIL_SMTP_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=your-verified-email@example.com
```

**Mailgun:**
```env
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.mailgun.org
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your-mailgun-smtp-username
EMAIL_SMTP_PASSWORD=your-mailgun-smtp-password
EMAIL_FROM=your-verified-email@example.com
```

**⚠️ 注意：**
- 如果不設置這些環境變數，忘記密碼功能仍可使用，但驗證碼只會顯示在後端控制台（開發模式）
- 生產環境建議配置真實的 SMTP 服務器
- 確保 `EMAIL_FROM` 地址是經過驗證的（某些 SMTP 服務要求）

---

## 📋 完整環境變數清單（複製使用）

在 Railway 項目 → "Variables" 中添加以下環境變數：

```env
# ============================================
# 資料庫配置（必須）
# ============================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/epaperdoorplate?retryWrites=true&w=majority

# ============================================
# JWT 配置（必須）
# ============================================
JWT_SECRET=your-64-character-random-secret-key-here
JWT_EXPIRATION=86400000

# ============================================
# 服務器配置（必須）
# ============================================
SERVER_PORT=$PORT
SERVER_ADDRESS=0.0.0.0
SERVER_SSL_ENABLED=false

# ============================================
# CORS 配置（必須）
# ============================================
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
ALLOW_LOCALHOST=false

# ============================================
# 存儲配置（必須，如果使用 S3）
# ============================================
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket-name
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-access-key-id
STORAGE_S3_SECRET_KEY=your-secret-access-key

# ============================================
# Line Bot 配置（必須，如果使用 Line Bot 功能）
# ============================================
LINE_BOT_CHANNEL_SECRET=your-channel-secret
LINE_BOT_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_BOT_BOT_ID=your-bot-id
LINE_BOT_WEBHOOK_URL=https://your-project.up.railway.app/api/line/webhook

# ============================================
# Guest 訊息防濫用配置（可選）
# ============================================
GUEST_MESSAGE_MAX_PER_IP_PER_HOUR=3
GUEST_MESSAGE_MAX_PER_DEVICE_PER_HOUR=5

# ============================================
# Email 配置（可選，用於忘記密碼功能）
# ============================================
# 如果不設置，忘記密碼驗證碼只會顯示在控制台（開發模式）
# 生產環境建議配置真實的 SMTP 服務器
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# ============================================
# 前端 URL（必須，用於 Guest QR Code）
# ============================================
# Guest QR Code 需要指向前端頁面，訪客才能看到留言頁面
# 格式：https://your-frontend.vercel.app
# 注意：不要包含尾部斜線，不要使用 localhost 或 127.0.0.1
FRONTEND_URL=https://epaper-doorplate.vercel.app

# ============================================
# 公開 API URL（可選，用於圖片等資源）
# ============================================
# 用於圖片等資源的公開 URL（如果與前端不同域名）
# 格式：https://your-backend.railway.app
# 注意：不要包含尾部斜線
PUBLIC_API_URL=https://epaperdoorplate-production.up.railway.app
```

---

## 🔍 檢查清單

部署前請確認：

- [ ] MongoDB URI 已設置且可訪問
- [ ] JWT_SECRET 已設置且至少 64 字符
- [ ] SERVER_PORT=$PORT（必須使用 $PORT）
- [ ] SERVER_SSL_ENABLED=false（使用平台 SSL）
- [ ] ALLOWED_ORIGINS 已設置且只包含 HTTPS 來源
- [ ] STORAGE_TYPE=s3 且 S3 憑證已設置
- [ ] Line Bot 相關環境變數已設置（如果使用）
- [ ] Webhook URL 已在 Line Developers Console 中設置

---

## 📝 注意事項

1. **PORT 環境變數**：Railway 會自動設置，不要手動設置
2. **Webhook URL**：部署後需要更新為實際的 Railway URL
3. **CORS**：確保前端域名已添加到 ALLOWED_ORIGINS
4. **Line Bot**：需要在 Line Developers Console 中驗證 Webhook URL

---

## 🐛 常見問題

### 問題 1：應用無法啟動

**檢查：**
- SERVER_PORT 是否設置為 $PORT
- MongoDB URI 是否正確
- JWT_SECRET 是否設置

### 問題 2：Line Bot Webhook 驗證失敗

**解決：**
- 確認 LINE_BOT_CHANNEL_SECRET 正確
- 確認 Webhook URL 已正確設置在 Line Developers Console
- 確認後端已部署且可訪問

### 問題 3：CORS 錯誤

**解決：**
- 確認 ALLOWED_ORIGINS 包含前端域名
- 確認只使用 HTTPS（生產環境）
- 確認 ALLOW_LOCALHOST=false（生產環境）

