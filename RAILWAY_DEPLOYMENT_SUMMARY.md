# 🚂 Railway 部署檔案檢查總結

## ✅ 必要檔案清單

### 後端必要檔案（backend/epaperdoorplate/）

| 檔案 | 狀態 | 說明 |
|------|------|------|
| `pom.xml` | ✅ | Maven 配置檔案 |
| `Procfile` | ✅ | Railway 啟動命令 |
| `nixpacks.toml` | ✅ | Nixpacks 構建配置 |
| `Dockerfile` | ✅ | Docker 構建配置（可選，Railway 會優先使用 nixpacks.toml） |
| `requirements.txt` | ✅ | Python 依賴（已包含 qrcode[pil]） |
| `render_doorplate_fixed.py` | ✅ | Python 渲染腳本 |
| `src/main/resources/application.yml` | ✅ | Spring Boot 配置 |

### Python 依賴（requirements.txt）

```
Pillow>=9.0.0
requests>=2.25.0
numpy>=1.21.0
qrcode[pil]>=7.4.2  ← 新增，用於 Guest QR Code
```

---

## ✅ 環境變數清單

### 必須設置的環境變數

```env
# 資料庫
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-64-character-secret-key
JWT_EXPIRATION=86400000

# 服務器
SERVER_PORT=$PORT
SERVER_ADDRESS=0.0.0.0
SERVER_SSL_ENABLED=false

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app
ALLOW_LOCALHOST=false

# 存儲（S3）
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ACCESS_KEY=your-key
STORAGE_S3_SECRET_KEY=your-secret

# Line Bot（新增）
LINE_BOT_CHANNEL_SECRET=your-channel-secret
LINE_BOT_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_BOT_BOT_ID=your-bot-id
LINE_BOT_WEBHOOK_URL=https://your-project.up.railway.app/api/line/webhook

# Guest 訊息防濫用（可選）
GUEST_MESSAGE_MAX_PER_IP_PER_HOUR=3
GUEST_MESSAGE_MAX_PER_DEVICE_PER_HOUR=5
```

---

## ✅ Railway 設置步驟

### 1. 創建項目
- 從 GitHub 倉庫部署
- Root Directory：`backend/epaperdoorplate`

### 2. 設置環境變數
- 在 Railway Variables 中添加所有必須的環境變數
- 參考 `RAILWAY_ENV_VARIABLES.md` 完整清單

### 3. 部署
- Railway 會自動檢測 `nixpacks.toml` 或 `Dockerfile`
- 自動安裝 Python 依賴
- 自動構建 Maven 項目
- 自動啟動應用

### 4. 驗證
- 檢查日誌確認啟動成功
- 測試 API 端點
- 設置 Line Bot Webhook

---

## ⚠️ 重要注意事項

1. **SERVER_PORT**：必須設置為 `$PORT`，不要設置具體數字
2. **SERVER_SSL_ENABLED**：必須設置為 `false`（使用平台 SSL）
3. **LINE_BOT_WEBHOOK_URL**：部署後需要更新為實際的 Railway URL
4. **ALLOWED_ORIGINS**：只允許 HTTPS 來源，不允許 localhost（生產環境）
5. **qrcode 庫**：已添加到 requirements.txt，會自動安裝

---

## 📚 相關文檔

- [Railway 快速部署指南](./RAILWAY_QUICK_START.md)
- [Railway 環境變數清單](./RAILWAY_ENV_VARIABLES.md)
- [Railway 部署檢查清單](./RAILWAY_DEPLOYMENT_CHECKLIST.md)
- [云端部署配置檢查清單](./CLOUD_DEPLOYMENT_CONFIG_CHECKLIST.md)

---

## 🎯 快速檢查命令

在本地測試 Python 依賴是否正確：

```bash
cd backend/epaperdoorplate
pip install -r requirements.txt
python -c "import qrcode; print('qrcode 安裝成功')"
```

---

**所有必要檔案已就緒，可以開始部署！** 🚀

