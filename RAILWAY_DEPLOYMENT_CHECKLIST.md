# 🚂 Railway 部署檢查清單

本文檔列出部署到 Railway 前需要檢查的所有項目。

---

## ✅ 必要檔案檢查

### 1. **後端配置檔案**

- [x] `backend/epaperdoorplate/pom.xml` - Maven 配置
- [x] `backend/epaperdoorplate/Procfile` - Railway 啟動命令
- [x] `backend/epaperdoorplate/nixpacks.toml` - Nixpacks 構建配置
- [x] `backend/epaperdoorplate/Dockerfile` - Docker 構建配置（可選）
- [x] `backend/epaperdoorplate/requirements.txt` - Python 依賴（包含 qrcode）
- [x] `backend/epaperdoorplate/render_doorplate_fixed.py` - Python 渲染腳本
- [x] `backend/epaperdoorplate/src/main/resources/application.yml` - Spring Boot 配置

### 2. **Python 依賴檢查**

確認 `requirements.txt` 包含：
- [x] Pillow>=9.0.0
- [x] requests>=2.25.0
- [x] numpy>=1.21.0
- [x] qrcode[pil]>=7.4.2（新增，用於 Guest QR Code）

### 3. **Java 配置檢查**

確認 `pom.xml` 包含：
- [x] Spring Boot 3.4.0
- [x] MongoDB 依賴
- [x] JWT 依賴
- [x] Lombok 依賴

---

## ✅ 環境變數檢查

### 必須設置的環境變數：

- [ ] `MONGODB_URI` - MongoDB 連接字符串
- [ ] `JWT_SECRET` - JWT 密鑰（至少 64 字符）
- [ ] `SERVER_PORT=$PORT` - 服務器端口（必須使用 $PORT）
- [ ] `SERVER_SSL_ENABLED=false` - 使用平台 SSL
- [ ] `ALLOWED_ORIGINS` - CORS 允許的來源（只允許 HTTPS）
- [ ] `ALLOW_LOCALHOST=false` - 生產環境禁用 localhost
- [ ] `STORAGE_TYPE=s3` - 存儲類型
- [ ] `STORAGE_S3_BUCKET` - S3 Bucket 名稱
- [ ] `STORAGE_S3_REGION` - S3 區域
- [ ] `STORAGE_S3_ACCESS_KEY` - S3 Access Key
- [ ] `STORAGE_S3_SECRET_KEY` - S3 Secret Key

### Line Bot 相關環境變數（如果使用 Line Bot 功能）：

- [ ] `LINE_BOT_CHANNEL_SECRET` - Line Bot Channel Secret
- [ ] `LINE_BOT_CHANNEL_ACCESS_TOKEN` - Line Bot Channel Access Token
- [ ] `LINE_BOT_BOT_ID` - Line Bot ID（不包含 @ 符號）
- [ ] `LINE_BOT_WEBHOOK_URL` - Webhook URL（部署後設置）

### 可選環境變數：

- [ ] `GUEST_MESSAGE_MAX_PER_IP_PER_HOUR=3` - 防濫用配置
- [ ] `GUEST_MESSAGE_MAX_PER_DEVICE_PER_HOUR=5` - 防濫用配置

---

## ✅ Railway 設置檢查

### 1. **項目設置**

- [ ] Root Directory 設置為：`backend/epaperdoorplate`
- [ ] 或 Railway 自動檢測到 Maven 項目

### 2. **構建配置**

- [ ] Railway 自動檢測到 `nixpacks.toml`
- [ ] 或 Railway 自動檢測到 `Dockerfile`
- [ ] 或 Railway 自動檢測到 `Procfile`

### 3. **環境變數設置**

- [ ] 所有必須的環境變數已設置
- [ ] `SERVER_PORT=$PORT`（注意：必須使用 $PORT，不要設置具體數字）
- [ ] Line Bot 相關環境變數已設置（如果使用）

---

## ✅ 部署後檢查

### 1. **應用啟動檢查**

- [ ] 查看 Railway 日誌，確認應用啟動成功
- [ ] 確認沒有錯誤訊息
- [ ] 確認 Python 腳本路徑正確

### 2. **API 測試**

```bash
# 測試根路徑
curl https://your-project.up.railway.app/

# 測試健康檢查（如果有）
curl https://your-project.up.railway.app/api/health
```

### 3. **Line Bot Webhook 設置**

- [ ] 登入 Line Developers Console
- [ ] 設置 Webhook URL：`https://your-project.up.railway.app/api/line/webhook`
- [ ] 點擊 "Verify" 驗證 Webhook
- [ ] 啟用 "Use webhook"

### 4. **CORS 檢查**

- [ ] 確認前端可以正常訪問後端 API
- [ ] 確認沒有 CORS 錯誤
- [ ] 確認 `ALLOWED_ORIGINS` 包含前端域名

---

## ✅ 功能測試清單

### 基本功能

- [ ] 用戶註冊/登入
- [ ] 模板編輯
- [ ] 圖片上傳
- [ ] 設備綁定
- [ ] 門牌渲染

### Line Bot 功能（如果使用）

- [ ] 獲取 Line Bot 資訊 API
- [ ] 生成驗證碼
- [ ] Line Bot Webhook 接收訊息
- [ ] 驗證碼驗證和綁定
- [ ] 發送訊息到 Line

### Guest 留言功能

- [ ] Guest 留言頁面可訪問
- [ ] 提交留言
- [ ] 防濫用機制正常運作
- [ ] 留言發送到 Line Bot

### Guest QR Code 功能

- [ ] 模板編輯器中可以添加 Guest QR Code 元素
- [ ] QR Code 在 ePaper 上正確顯示
- [ ] QR Code 可以掃描並跳轉到留言頁面

---

## 📝 常見問題排查

### 問題 1：構建失敗

**檢查：**
- Maven 構建日誌
- Java 版本（需要 Java 21）
- 依賴下載是否成功

### 問題 2：Python 腳本找不到

**檢查：**
- `render_doorplate_fixed.py` 是否在正確位置
- Python 依賴是否安裝成功
- 查看日誌中的路徑信息

### 問題 3：應用無法啟動

**檢查：**
- 環境變數是否全部設置
- MongoDB 連接是否正常
- 端口配置是否正確（使用 $PORT）

### 問題 4：Line Bot Webhook 驗證失敗

**檢查：**
- LINE_BOT_CHANNEL_SECRET 是否正確
- Webhook URL 是否正確設置
- 後端是否可訪問

### 問題 5：QR Code 無法生成

**檢查：**
- `qrcode` 庫是否安裝（檢查 requirements.txt）
- Python 依賴是否安裝成功
- 查看日誌中的錯誤訊息

---

## 📚 相關文檔

- [Railway 快速部署指南](./RAILWAY_QUICK_START.md)
- [Railway 環境變數清單](./RAILWAY_ENV_VARIABLES.md)
- [云端部署配置檢查清單](./CLOUD_DEPLOYMENT_CONFIG_CHECKLIST.md)

---

## 🎯 快速部署步驟

1. **準備環境變數**：參考 `RAILWAY_ENV_VARIABLES.md`
2. **在 Railway 創建項目**：從 GitHub 倉庫部署
3. **設置 Root Directory**：`backend/epaperdoorplate`
4. **設置環境變數**：在 Railway Variables 中添加
5. **部署**：Railway 自動構建和部署
6. **驗證**：檢查日誌和測試 API
7. **設置 Line Bot Webhook**：在 Line Developers Console 中設置

---

**最後更新：** 2024-12-19

