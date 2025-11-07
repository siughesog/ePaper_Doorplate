# 安全工具函數說明

## 功能概述

這個文件包含了一系列安全工具函數，用於防止 XSS 攻擊和其他安全漏洞。

## 主要函數

### 1. `validateImageUrl(url)`
驗證圖片 URL 是否安全，防止：
- `javascript:` 協議注入
- 危險的 `data:` 協議（HTML/JavaScript）
- 無效的 URL 格式

### 2. `sanitizeImageUrl(url)`
清理和驗證圖片 URL，移除危險字符並返回安全的 URL。

### 3. `validateImageFile(file)`
驗證上傳的文件是否為有效的圖片：
- 檢查 MIME 類型
- 檢查文件大小（限制 10MB）
- 檢查文件擴展名

### 4. `validateBase64Image(base64)`
驗證 Base64 編碼的圖片數據是否安全。

### 5. `validateImagePath(imagePath)`
驗證圖片路徑是否包含危險字符。

### 6. `createSafeImageUrl(imagePath, baseURL)`
根據圖片路徑創建安全的圖片 URL。

### 7. `SecureStorage`
安全的存儲工具，提供 token 存儲的安全方法。

## 使用方法

```javascript
import { validateImageUrl, validateImageFile, SecureStorage } from './utils/security';

// 驗證圖片 URL
const url = 'https://example.com/image.jpg';
if (validateImageUrl(url)) {
  // 安全，可以使用
} else {
  // 不安全，拒絕使用
}

// 驗證上傳的文件
const file = e.target.files[0];
if (validateImageFile(file)) {
  // 安全，可以上傳
} else {
  // 不安全，拒絕上傳
}

// 使用安全的存儲
SecureStorage.setToken(token);
const token = SecureStorage.getToken();
```

## 安全措施

1. **輸入驗證**：所有用戶輸入都經過驗證
2. **協議白名單**：只允許安全的協議（http, https, data:image/*）
3. **文件類型驗證**：檢查 MIME 類型和文件擴展名
4. **大小限制**：限制文件大小防止 DoS 攻擊
5. **字符過濾**：移除危險字符和模式

