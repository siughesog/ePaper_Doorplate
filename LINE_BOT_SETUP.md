# 📱 Line Bot 設置指南

## ⚠️ 重要：禁用自動回覆

Line Bot 收到訊息後出現「無法個別回覆」的自動訊息，表示**自動回覆功能被啟用了**。

### 解決方法：

1. **登入 Line Developers Console**
   - 訪問：https://developers.line.biz/console/
   - 選擇您的 Bot

2. **進入 Messaging API 設定**
   - 點擊左側選單的 "Messaging API"

3. **禁用自動回覆**
   - 找到 "Auto-reply messages" 區塊
   - 將開關設為 **OFF**（關閉）
   - 點擊 "Save" 保存

4. **啟用 Webhook**
   - 找到 "Webhook" 區塊
   - 將開關設為 **ON**（開啟）
   - 在 "Webhook URL" 欄位輸入：`https://your-project.up.railway.app/api/line/webhook`
   - 點擊 "Verify" 驗證 Webhook
   - 如果驗證成功，會顯示 "Success"

---

## 🔧 完整設置步驟

### 1. 獲取 Line Bot 憑證

在 Line Developers Console → Basic settings：
- **Channel Secret** → 設置為 `LINE_BOT_CHANNEL_SECRET`
- **Channel Access Token** → 設置為 `LINE_BOT_CHANNEL_ACCESS_TOKEN`
- **Bot ID** → 設置為 `LINE_BOT_BOT_ID`（不包含 @ 符號）

### 2. 設置 Webhook

在 Line Developers Console → Messaging API：
- **Webhook URL**：`https://your-project.up.railway.app/api/line/webhook`
- **Use webhook**：啟用（ON）
- **Auto-reply messages**：禁用（OFF）⚠️ **重要！**

### 3. 設置環境變數

在 Railway 項目 → Variables 中添加：

```env
LINE_BOT_CHANNEL_SECRET=your-channel-secret
LINE_BOT_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_BOT_BOT_ID=your-bot-id
LINE_BOT_WEBHOOK_URL=https://your-project.up.railway.app/api/line/webhook
```

### 4. 測試綁定流程

1. 在前端設定頁面生成驗證碼
2. 掃描 QR Code 加入 Line Bot
3. 在 Line Bot 中輸入 6 位數字驗證碼
4. 應該收到回覆：「✅ Line Bot 綁定成功！」

---

## 🐛 常見問題

### 問題 1：收到自動回覆訊息

**原因：** Line Bot 的自動回覆功能被啟用

**解決：**
- 在 Line Developers Console → Messaging API
- 將 "Auto-reply messages" 設為 **OFF**

### 問題 2：Webhook 驗證失敗

**檢查：**
- Webhook URL 是否正確
- 後端是否已部署且可訪問
- 環境變數 `LINE_BOT_CHANNEL_SECRET` 是否正確

### 問題 3：驗證碼驗證失敗

**檢查：**
- 驗證碼是否在 5 分鐘內使用
- 驗證碼是否正確輸入（6 位數字）
- 後端日誌是否有錯誤訊息

### 問題 4：無法收到回覆

**檢查：**
- Line Bot 是否已加入好友
- Webhook 是否已啟用
- 自動回覆是否已禁用
- 後端日誌是否有錯誤訊息

---

## 📝 代碼改進說明

已更新代碼以使用 **Reply API** 來回覆訊息：

1. **新增 `replyMessage` 方法**：使用 Reply API 回覆訊息（用於 webhook）
2. **改進 webhook 處理**：使用 `replyToken` 來回覆訊息
3. **添加日誌輸出**：方便調試和追蹤問題

**Reply API vs Push API：**
- **Reply API**：用於在 webhook 中回覆用戶的訊息（需要 replyToken）
- **Push API**：用於主動發送訊息給用戶（需要 lineUserId）

---

## ✅ 檢查清單

部署前確認：

- [ ] Line Bot Channel Secret 已設置
- [ ] Line Bot Channel Access Token 已設置
- [ ] Line Bot ID 已設置
- [ ] Webhook URL 已設置並驗證成功
- [ ] **自動回覆功能已禁用** ⚠️
- [ ] Webhook 功能已啟用
- [ ] 環境變數已正確設置
- [ ] 後端已部署且可訪問

---

**最後更新：** 2024-12-19

