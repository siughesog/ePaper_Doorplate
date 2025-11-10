# ePaper 門牌系統 API 文件

## 基礎資訊
- **API 基礎路徑**: `/`
- **API 版本**: 1.0.0
- **認證方式**: Bearer Token (JWT)

---

## 1. 認證相關 API (`/api/auth`)

### 1.1 註冊
- **端點**: `POST /api/auth/register`
- **說明**: 註冊新用戶
- **請求體**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```
- **回應**: `AuthResponse` (包含 token)

### 1.2 登入
- **端點**: `POST /api/auth/login`
- **說明**: 用戶登入
- **請求體**:
```json
{
  "username": "string",
  "password": "string"
}
```
- **回應**: `AuthResponse` (包含 token)

### 1.3 驗證 Token
- **端點**: `GET /api/auth/validate`
- **說明**: 驗證 JWT token 是否有效
- **Headers**: `Authorization: Bearer <token>`
- **回應**: 
```json
{
  "valid": true/false,
  "message": "string"
}
```

### 1.4 忘記密碼 - 發送驗證碼
- **端點**: `POST /api/auth/forgot-password`
- **說明**: 發送密碼重置驗證碼到用戶郵箱
- **請求體**:
```json
{
  "email": "string"
}
```

### 1.5 驗證重置碼
- **端點**: `POST /api/auth/verify-reset-code`
- **說明**: 驗證密碼重置驗證碼
- **請求體**:
```json
{
  "email": "string",
  "code": "string"
}
```

### 1.6 重置密碼
- **端點**: `POST /api/auth/reset-password`
- **說明**: 使用驗證碼重置密碼
- **請求體**:
```json
{
  "email": "string",
  "code": "string",
  "newPassword": "string"
}
```

---

## 2. 設備管理 API (`/device`)

### 2.1 激活設備
- **端點**: `POST /device/activate`
- **說明**: 使用 unique_id 激活設備
- **參數**: 
  - `unique_id` (String, required): 設備唯一識別碼
- **回應**: 激活結果（包含 activation_code）

### 2.2 綁定設備
- **端點**: `POST /device/bind`
- **說明**: 將設備綁定到用戶
- **參數**: 
  - `activation_code` (String, required): 激活碼
  - `deviceName` (String, required): 設備名稱
  - `username` (String, required): 用戶名
- **回應**: 綁定結果

### 2.3 更新設備
- **端點**: `POST /device/update`
- **說明**: 更新設備資訊
- **參數**: 
  - `deviceID` (String, required): 設備ID
  - `deviceName` (String, optional): 設備名稱
  - `refreshInterval` (Integer, optional): 刷新間隔（秒）
  - `forceNoUpdate` (Boolean, optional): 是否強制不更新
- **回應**: 更新結果

### 2.4 解綁設備
- **端點**: `POST /device/unbind`
- **說明**: 解綁設備
- **參數**: 
  - `deviceID` (String, required): 設備ID
- **回應**: 解綁結果

### 2.5 查詢設備狀態
- **端點**: `POST /device/status`
- **說明**: 查詢設備狀態並獲取門牌圖片數據（bin 文件）。這是 ESP32 設備定期調用的主要 API，用於檢查是否需要更新顯示內容。
- **參數**: 
  - `deviceID` (String, required): 設備ID
- **回應格式**:

#### 成功回應（設備已激活）:
```json
{
  "success": true,
  "isActivated": true,
  "needUpdate": true/false,
  "refreshInterval": 300,
  "binData": "base64_encoded_string",
  "binSize": 12345
}
```

#### 設備未激活或已解綁:
```json
{
  "success": true,
  "isActivated": false,
  "action": "return_to_activation"
}
```

#### 設備不存在:
```json
{
  "success": false,
  "message": "device not found"
}
```

#### 模板不存在:
```json
{
  "success": true,
  "isActivated": true,
  "needUpdate": false,
  "refreshInterval": 300,
  "message": "template not found: <templateId>"
}
```

- **回應字段說明**:
  - `success` (Boolean): 請求是否成功
  - `isActivated` (Boolean): 設備是否已激活
  - `needUpdate` (Boolean): 是否需要更新顯示內容
    - `true`: 需要更新，回應中會包含 `binData`
    - `false`: 不需要更新，可能不包含 `binData`（如果 `forceNoUpdate` 為 `true`）
  - `refreshInterval` (Integer): 刷新間隔（秒），設備應在此時間後再次查詢狀態
  - `binData` (String, optional): Base64 編碼的門牌圖片數據（BMP 格式的 bin 文件）
    - 僅在設備有模板配置且需要更新時返回
    - 如果 `forceNoUpdate` 為 `true`，即使 `needUpdate` 為 `true` 也不會返回
  - `binSize` (Integer, optional): bin 文件的原始大小（字節）
    - 僅在返回 `binData` 時存在
  - `action` (String, optional): 當設備未激活時，指示設備應執行的操作
  - `message` (String, optional): 錯誤或提示訊息

- **行為說明**:
  1. **設備狀態檢查**: 驗證設備是否存在、是否已激活、是否已解綁
  2. **更新時間記錄**: 每次調用此 API 時，會更新設備的 `updatedAt` 時間戳
  3. **強制不更新**: 如果設備的 `forceNoUpdate` 為 `true`，則 `needUpdate` 會被強制設為 `false`，且不會返回 `binData`
  4. **模板渲染**: 如果設備有 `currentTemplateId` 且需要更新，會：
     - 載入模板佈局
     - 為 Guest QR Code 元素自動添加或生成 `guestQRCodeToken`
     - 渲染門牌圖片並轉換為 bin 格式
     - 將 bin 數據以 Base64 編碼返回
  5. **更新標記**: 如果返回了 `binData` 且 `needUpdate` 為 `true`，設備的 `needUpdate` 會被設為 `false`

- **使用場景**:
  - ESP32 設備定期（根據 `refreshInterval`）調用此 API 檢查更新
  - 當 `needUpdate` 為 `true` 且返回 `binData` 時，設備應將 `binData` 解碼並顯示在 ePaper 螢幕上
  - 當 `isActivated` 為 `false` 時，設備應返回激活流程

- **範例請求**:
```bash
curl -X POST "https://your-api-domain.com/device/status?deviceID=device123"
```

- **範例回應**:
```json
{
  "success": true,
  "isActivated": true,
  "needUpdate": true,
  "refreshInterval": 300,
  "binData": "Qk1GAAAAAAAAAD4AAAAoAAAAAQAAAAEAAAABABgAAAAAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  "binSize": 12345
}
```

### 2.6 獲取用戶設備列表
- **端點**: `GET /device/list`
- **說明**: 獲取指定用戶的所有設備
- **參數**: 
  - `username` (String, required): 用戶名
- **回應**: 設備列表

### 2.7 更新設備模板
- **端點**: `POST /device/update-template`
- **說明**: 更新設備使用的模板
- **參數**: 
  - `deviceID` (String, required): 設備ID
  - `templateId` (String, required): 模板ID
- **回應**: 更新結果

---

## 3. 門牌佈局 API (`/layout`)

### 3.1 創建或更新佈局
- **端點**: `POST /layout/createOrUpdate`
- **說明**: 創建新佈局或更新現有佈局
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `layoutName` (String, required): 佈局名稱
- **請求體**: `List<ElementStyle>` - 元素樣式列表
- **回應**: `DoorplateLayout`

### 3.2 根據 ID 更新佈局
- **端點**: `POST /layout/updateById`
- **說明**: 根據佈局ID更新佈局元素
- **參數**: 
  - `layoutId` (String, required): 佈局ID
- **請求體**: `List<ElementStyle>` - 元素樣式列表
- **回應**: `DoorplateLayout`

### 3.3 載入佈局
- **端點**: `GET /layout/load`
- **說明**: 根據用戶ID和佈局名稱載入佈局
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `layoutName` (String, required): 佈局名稱
- **回應**: `DoorplateLayout`

### 3.4 根據 ID 載入佈局
- **端點**: `GET /layout/loadById`
- **說明**: 根據佈局ID載入佈局
- **參數**: 
  - `layoutId` (String, required): 佈局ID
- **回應**: `DoorplateLayout`

### 3.5 刪除佈局
- **端點**: `DELETE /layout/delete`
- **說明**: 刪除指定佈局
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `layoutName` (String, required): 佈局名稱
- **回應**: 刪除成功訊息

### 3.6 獲取佈局摘要列表
- **端點**: `GET /layout/summary`
- **說明**: 獲取用戶的所有佈局摘要
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
- **回應**: `List<TemplateSummaryDto>`

### 3.7 接收詳細資訊
- **端點**: `POST /layout/api/details`
- **說明**: 接收並處理詳細資訊
- **請求體**: `DetailDTO`
- **回應**: 處理結果

---

## 4. 門牌渲染 API (`/render`)

### 4.1 渲染門牌
- **端點**: `POST /render/doorplate`
- **說明**: 渲染門牌圖片並返回 BMP 格式數據
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `layoutId` (String, required): 佈局ID
  - `userId` (String, optional): 用戶ID（如果未提供，使用當前登錄用戶）
- **請求體**: `List<Map<String, Object>>` - 元素列表
- **回應**: 圖片資源 (PNG 格式)
- **Content-Type**: `image/png`

### 4.2 獲取預覽
- **端點**: `GET /render/preview/{layoutId}`
- **說明**: 獲取佈局預覽（目前返回 404，應使用 `/render/doorplate`）
- **參數**: 
  - `layoutId` (String, path variable): 佈局ID

---

## 5. 圖片管理 API (`/api/images`)

### 5.1 獲取圖片列表
- **端點**: `GET /api/images`
- **說明**: 獲取用戶的所有圖片
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
- **回應**: `List<ImageFile>`

### 5.2 上傳圖片
- **端點**: `POST /api/images`
- **說明**: 上傳新圖片
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `file` (MultipartFile, required): 圖片文件
  - `userId` (String, required): 用戶ID
- **回應**: `ImageFile`

### 5.3 刪除圖片
- **端點**: `DELETE /api/images/{id}`
- **說明**: 刪除指定圖片
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `id` (String, path variable): 圖片ID
  - `userId` (String, query parameter, required): 用戶ID
- **回應**: 204 No Content

### 5.4 獲取圖片引用
- **端點**: `GET /api/images/{id}/references`
- **說明**: 獲取圖片被引用的位置
- **參數**: 
  - `id` (String, path variable): 圖片ID
- **回應**: `List<ImageReferenceDto>`

---

## 6. 圖片庫 API (`/imageLibrary`)

### 6.1 獲取圖片庫列表
- **端點**: `GET /imageLibrary/list`
- **說明**: 獲取用戶的圖片庫列表
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
- **回應**: `List<ImageLibraryDto>`

### 6.2 保存圖片庫項目
- **端點**: `POST /imageLibrary/save`
- **說明**: 保存圖片庫項目
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
- **請求體**: `ImageLibraryDto`
- **回應**: `ImageLibraryDto`

### 6.3 刪除圖片庫項目
- **端點**: `DELETE /imageLibrary/delete`
- **說明**: 刪除圖片庫項目
- **認證**: 需要 (Bearer Token)
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `itemId` (String, required): 項目ID
- **回應**: 刪除結果訊息

### 6.4 獲取圖片庫項目
- **端點**: `GET /imageLibrary/get`
- **說明**: 根據ID獲取圖片庫項目
- **參數**: 
  - `itemId` (String, required): 項目ID
- **回應**: `ImageLibraryDto`

### 6.5 獲取圖片庫項目引用
- **端點**: `GET /imageLibrary/{itemId}/references`
- **說明**: 獲取圖片庫項目被引用的位置
- **參數**: 
  - `itemId` (String, path variable): 項目ID
- **回應**: `List<ImageReferenceDto>`

---

## 7. 圖片代理 API

### 7.1 獲取圖片
- **端點**: `GET /images/**`
- **說明**: 代理圖片請求，從存儲服務（本地或S3）讀取圖片
- **參數**: 
  - 路徑參數：圖片文件名（例如：`/images/1d1b7f09-eeac-450a-b8df-0265d2396225.webp`）
- **回應**: 圖片資源
- **Content-Type**: 根據圖片類型自動設定
- **Cache-Control**: `public, max-age=3600`

---

## 8. 訪客留言 API (`/api/guest`)

### 8.1 提交訪客留言
- **端點**: `POST /api/guest/message`
- **說明**: 提交訪客留言（通過 QR Code Token）
- **認證**: 不需要（公開API）
- **參數**: 
  - `token` (String, required): Guest QR Code Token
  - `message` (String, required): 留言內容
- **回應**: 
```json
{
  "success": true/false,
  "message": "string"
}
```
- **限制**: 
  - 同一 IP 每小時最多 3 次
  - 同一設備每小時最多 5 次

### 8.2 獲取留言頁面設定
- **端點**: `GET /api/guest/message-page`
- **說明**: 獲取訪客留言頁面的設定（歡迎文字、提示文字等）
- **認證**: 不需要（公開API）
- **參數**: 
  - `token` (String, required): Guest QR Code Token
- **回應**: 
```json
{
  "success": true,
  "welcomeText": "string",
  "hintText": "string",
  "submitText": "string"
}
```

---

## 9. 顯示資訊 API (`/api/display-info`)

### 9.1 獲取所有顯示資訊
- **端點**: `GET /api/display-info`
- **說明**: 獲取所有顯示資訊
- **回應**: `List<DisplayInfo>`

### 9.2 根據 ID 獲取顯示資訊
- **端點**: `GET /api/display-info/{id}`
- **說明**: 根據ID獲取顯示資訊
- **參數**: 
  - `id` (String, path variable): 顯示資訊ID
- **回應**: `Optional<DisplayInfo>`

### 9.3 創建或更新顯示資訊
- **端點**: `POST /api/display-info`
- **說明**: 創建或更新顯示資訊
- **請求體**: `DisplayInfo`
- **回應**: `DisplayInfo`

### 9.4 刪除顯示資訊
- **端點**: `DELETE /api/display-info/{id}`
- **說明**: 刪除顯示資訊
- **參數**: 
  - `id` (String, path variable): 顯示資訊ID
- **回應**: 204 No Content

### 9.5 根據全名搜索顯示資訊
- **端點**: `GET /api/display-info/search`
- **說明**: 根據全名搜索顯示資訊
- **參數**: 
  - `fullName` (String, required): 全名
- **回應**: `Optional<DisplayInfo>`

---

## 10. 根端點 (`/`)

### 10.1 API 資訊
- **端點**: `GET /`
- **說明**: 獲取 API 基本資訊和可用端點列表
- **回應**: 
```json
{
  "name": "ePaper Doorplate API",
  "version": "1.0.0",
  "status": "running",
  "message": "API Server is running. Use /api/auth/login to authenticate.",
  "endpoints": {
    "auth": "/api/auth",
    "devices": "/device",
    "layouts": "/layout",
    "images": "/api/images",
    "render": "/render"
  }
}
```

---

## 11. Line Bot API (`/api/line`)

### 11.1 Line Bot Webhook
- **端點**: `POST /api/line/webhook`
- **說明**: 接收 Line Bot 事件（由 Line 平台調用）
- **認證**: 不需要（由 Line 平台調用）
- **Headers**: 
  - `X-Line-Signature` (String, required): Line 簽名，用於驗證請求
- **請求體**: Line Webhook Event JSON
- **回應**: 200 OK

### 11.2 獲取 Line Bot 資訊
- **端點**: `GET /api/line/info`
- **說明**: 獲取 Line Bot 資訊（包括 QR Code URL）
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **回應**: 
```json
{
  "success": true,
  "lineBotId": "string",
  "lineBotName": "string",
  "qrCodeUrl": "string"
}
```

### 11.3 生成驗證碼
- **端點**: `POST /api/line/generate-verification-code`
- **說明**: 生成 Line Bot 綁定驗證碼（6位數字，5分鐘有效）
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **回應**: 
```json
{
  "success": true,
  "verificationCode": "123456",
  "expiresIn": 300,
  "lineBotId": "string",
  "lineBotName": "string",
  "qrCodeUrl": "string"
}
```

### 11.4 解除 Line Bot 綁定
- **端點**: `POST /api/line/unbind`
- **說明**: 解除當前用戶的 Line Bot 綁定
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **回應**: 
```json
{
  "success": true,
  "message": "已解除 Line Bot 綁定"
}
```

---

## 12. 設定管理 API (`/api/settings`)

### 12.1 獲取用戶設定
- **端點**: `GET /api/settings`
- **說明**: 獲取當前用戶的設定
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **回應**: 
```json
{
  "success": true,
  "username": "string",
  "email": "string",
  "lineBound": true/false,
  "lineUserId": "string",
  "acceptGuestMessages": true/false,
  "guestMessageWelcomeText": "string",
  "guestMessageHintText": "string",
  "guestMessageSubmitText": "string"
}
```

### 12.2 更新用戶設定
- **端點**: `PUT /api/settings`
- **說明**: 更新用戶設定（訪客留言相關設定）
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **請求體**: 
```json
{
  "acceptGuestMessages": true/false,
  "guestMessageWelcomeText": "string",
  "guestMessageHintText": "string",
  "guestMessageSubmitText": "string"
}
```
- **回應**: 
```json
{
  "success": true,
  "message": "設定已更新"
}
```

### 12.3 更新帳戶資訊
- **端點**: `PUT /api/settings/account`
- **說明**: 更新帳戶資訊（電子郵件、密碼）
- **認證**: 需要 (Bearer Token)
- **Headers**: `Authorization: Bearer <token>`
- **請求體**: 
```json
{
  "email": "string",
  "currentPassword": "string",
  "newPassword": "string"
}
```
- **回應**: 
```json
{
  "success": true,
  "message": "帳戶資訊已更新",
  "passwordChanged": true/false
}
```

---

## 13. 硬體白名單 API (`/api/hardware-whitelist`)

**注意**: 此 API 僅限超級用戶（superuser）訪問

### 13.1 獲取所有白名單
- **端點**: `GET /api/hardware-whitelist`
- **說明**: 獲取所有硬體白名單項目
- **認證**: 需要 (Bearer Token) + 超級用戶權限
- **回應**: 白名單列表

### 13.2 添加到白名單
- **端點**: `POST /api/hardware-whitelist/add`
- **說明**: 將設備 unique_id 添加到白名單
- **認證**: 需要 (Bearer Token) + 超級用戶權限
- **參數**: 
  - `uniqueId` (String, required): 設備唯一識別碼
- **回應**: 操作結果

### 13.3 從白名單移除
- **端點**: `POST /api/hardware-whitelist/remove`
- **說明**: 從白名單移除設備
- **認證**: 需要 (Bearer Token) + 超級用戶權限
- **參數**: 
  - `uniqueId` (String, required): 設備唯一識別碼
- **回應**: 操作結果

### 13.4 檢查白名單
- **端點**: `GET /api/hardware-whitelist/check`
- **說明**: 檢查設備是否在白名單中
- **認證**: 需要 (Bearer Token) + 超級用戶權限
- **參數**: 
  - `uniqueId` (String, required): 設備唯一識別碼
- **回應**: 檢查結果

---

## 14. 文字庫 API (`/textLibrary`)

### 14.1 獲取文字庫列表
- **端點**: `GET /textLibrary/list`
- **說明**: 獲取用戶的文字庫列表
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `elementId` (String, optional): 元素ID（如果提供，只返回該元素的文字庫）
- **回應**: `List<TextLibraryDto>`

### 14.2 保存文字庫項目
- **端點**: `POST /textLibrary/save`
- **說明**: 保存文字庫項目
- **參數**: 
  - `userId` (String, required): 用戶ID
- **請求體**: `TextLibraryDto`
- **回應**: `TextLibraryDto`

### 14.3 刪除文字庫項目
- **端點**: `DELETE /textLibrary/delete`
- **說明**: 刪除文字庫項目
- **參數**: 
  - `userId` (String, required): 用戶ID
  - `textId` (String, required): 文字庫項目ID
- **回應**: 刪除結果訊息

### 14.4 獲取文字庫項目
- **端點**: `GET /textLibrary/get`
- **說明**: 根據ID獲取文字庫項目
- **參數**: 
  - `textId` (String, required): 文字庫項目ID
- **回應**: `TextLibraryDto`

---

## 15. 其他 API

### 15.1 獲取元素列表
- **端點**: `GET /elements`
- **說明**: 獲取可用元素列表（測試用）
- **回應**: `List<ElementStyle>`

---

## 認證說明

大部分 API 需要 JWT Bearer Token 認證。在請求頭中添加：
```
Authorization: Bearer <your_token>
```

Token 可通過 `/api/auth/login` 或 `/api/auth/register` 獲取。

---

## 錯誤處理

API 使用標準 HTTP 狀態碼：
- `200 OK`: 請求成功
- `201 Created`: 創建成功
- `204 No Content`: 刪除成功
- `400 Bad Request`: 請求參數錯誤
- `401 Unauthorized`: 未認證或 token 無效
- `403 Forbidden`: 無權限訪問
- `404 Not Found`: 資源不存在
- `429 Too Many Requests`: 請求過於頻繁
- `500 Internal Server Error`: 伺服器錯誤

---

## 注意事項

1. **用戶驗證**: 大部分需要認證的 API 會驗證當前登錄用戶是否與請求的 `userId` 匹配，防止越權訪問。

2. **圖片格式**: 
   - 上傳的圖片會自動轉換為 WebP 格式
   - 渲染的門牌圖片返回 PNG 格式（實際數據為 BMP）

3. **訪客留言限制**: 
   - 同一 IP 地址每小時最多提交 3 次留言
   - 同一設備每小時最多提交 5 次留言

4. **設備激活流程**:
   - 使用 `unique_id` 激活設備 → 獲得 `activation_code`
   - 使用 `activation_code` 綁定設備到用戶

5. **佈局和模板**: 
   - 佈局（Layout）是用戶自定義的門牌設計
   - 模板（Template）是預設的佈局模板
   - 設備可以關聯特定的模板

---

## 範例請求

### 登入並獲取 Token
```bash
curl -X POST https://your-api-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

### 獲取設備列表
```bash
curl -X GET "https://your-api-domain.com/device/list?username=your_username" \
  -H "Authorization: Bearer your_token"
```

### 渲染門牌
```bash
curl -X POST "https://your-api-domain.com/render/doorplate?layoutId=layout123&userId=user123" \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "elem1",
      "type": "text",
      "content": "Hello World",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 50
    }
  ]' \
  --output doorplate.png
```

---

**最後更新**: 2024

