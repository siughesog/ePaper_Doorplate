# HTTPS 配置說明

本專案已支持 HTTPS 配置，以下是配置步驟。

⚠️ **重要提示**：前端和後端必須使用相同的協議（HTTP 或 HTTPS）。默認情況下，兩者都使用 HTTP。

## 前端配置

### 1. 默認配置（HTTP）

**默認情況下，前端使用 HTTP 連接後端**：
- 默認 URL: `http://localhost:8080`
- 無需額外配置即可使用

### 2. 啟用 HTTPS（需要後端也啟用 HTTPS）

在 `frontend/epaper-doorplate-frontend` 目錄下創建 `.env` 文件：

**本地開發（自簽名證書）**：
```env
REACT_APP_API_BASE_URL=https://localhost:8080
```

**生產環境（正式證書）**：
```env
REACT_APP_API_BASE_URL=https://your-domain.com
```

## 後端配置

### 方法一：使用自簽名證書（開發環境）

1. **生成自簽名證書（使用 keytool，Java 自帶）**：

```bash
keytool -genkeypair -alias tomcat -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore keystore.p12 -validity 365
```

按提示輸入信息：
- 密碼：自定義（記住這個密碼）
- 姓名：localhost（或你的域名）
- 其他信息可按 Enter 使用默認值

2. **將證書複製到後端資源目錄**：

將生成的 `keystore.p12` 複製到：
```
backend/epaperdoorplate/src/main/resources/keystore.p12
```

3. **配置 application.yml**：

```yaml
server:
  port: 8080
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: 你設置的密碼
    key-store-type: PKCS12
    key-alias: tomcat
```

### 方法二：使用 Let's Encrypt 證書（生產環境）

1. **使用 Certbot 獲取證書**：

```bash
certbot certonly --standalone -d your-domain.com
```

2. **轉換證書格式**：

```bash
openssl pkcs12 -export -in /etc/letsencrypt/live/your-domain.com/fullchain.pem \
  -inkey /etc/letsencrypt/live/your-domain.com/privkey.pem \
  -out keystore.p12 -name tomcat \
  -passout pass:your-password
```

3. **配置 application.yml**（同上）

### 方法三：使用反向代理（Nginx/Apache）

如果使用 Nginx 或 Apache 作為反向代理，可以在代理層配置 SSL，Spring Boot 保持 HTTP：

1. **Nginx 配置示例**：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

2. **Spring Boot 配置**：

```yaml
server:
  port: 8080
  # 不啟用 SSL，由 Nginx 處理
```

3. **前端配置**：

```env
REACT_APP_API_BASE_URL=https://your-domain.com
```

## 瀏覽器警告處理（開發環境）

使用自簽名證書時，瀏覽器會顯示安全警告：

1. **Chrome/Edge**：點擊「高級」→「繼續前往 localhost（不安全）」
2. **Firefox**：點擊「高級」→「接受風險並繼續」

這在開發環境是正常的，生產環境應使用正式證書。

## 驗證 HTTPS

1. 啟動後端服務
2. 訪問 `https://localhost:8080/api/auth/validate`（應看到證書信息）
3. 啟動前端，檢查瀏覽器控制台的 API 請求是否為 HTTPS

## 注意事項

- ⚠️ 生產環境必須使用正式 SSL 證書
- ⚠️ 自簽名證書僅用於開發測試
- ⚠️ 記得在 `.gitignore` 中添加 `keystore.p12`，不要提交證書文件
- ✅ 使用環境變量可以輕鬆在不同環境間切換

