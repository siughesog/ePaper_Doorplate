# 前端 HTTPS 配置說明

## 快速啟用 HTTPS（開發環境）

### 方法一：使用內建自簽名證書（最簡單）

1. **創建 `.env` 文件**（已在項目根目錄創建）：
   ```env
   HTTPS=true
   REACT_APP_API_BASE_URL=https://localhost:8080
   ```

2. **啟動開發服務器**：
   ```bash
   npm start
   ```

3. **訪問應用**：
   打開 `https://localhost:3000`（注意是 HTTPS）

4. **接受證書警告**：
   - 瀏覽器會顯示自簽名證書警告
   - 點擊「進階」→「繼續前往 localhost（不安全）」

### 方法二：使用自定義證書（可選）

如果需要使用與後端相同的證書或自定義證書：

1. **生成或複製證書**：
   ```bash
   # 複製後端的證書（需要轉換格式）
   # 或者生成新的證書
   ```

2. **更新 `.env` 文件**：
   ```env
   HTTPS=true
   SSL_CRT_FILE=./localhost.crt
   SSL_KEY_FILE=./localhost.key
   REACT_APP_API_BASE_URL=https://localhost:8080
   ```

## 注意事項

### 開發環境
- React 開發服務器會自動生成自簽名證書
- 需要手動接受瀏覽器的安全警告
- 這在開發環境是正常的

### 生產環境
- 生產環境使用 `npm run build` 構建
- 構建後的靜態文件由 Web 服務器（如 Nginx）提供 HTTPS
- 需要在 Web 服務器層配置正式的 SSL 證書

## 驗證 HTTPS

啟動後，應該看到：
```
Compiled successfully!

You can now view epaper-doorplate-frontend in the browser.

  Local:            https://localhost:3000
  On Your Network:  https://192.168.x.x:3000
```

注意 URL 開頭是 `https://` 而不是 `http://`。

## 故障排除

### 如果 HTTPS 沒有啟用
1. 確保 `.env` 文件在正確位置（`frontend/epaper-doorplate-frontend/`）
2. 確保 `HTTPS=true` 沒有被其他配置覆蓋
3. 重啟開發服務器

### 如果證書錯誤
1. 清除瀏覽器緩存
2. 接受自簽名證書
3. 或使用方法二配置自定義證書

### 混合內容警告
如果前端 HTTPS 訪問後端 HTTP：
- 瀏覽器會阻止（混合內容策略）
- 確保後端也使用 HTTPS（已配置）

## 相關文件
- `.env` - 環境變量配置
- `package.json` - 項目配置和腳本














