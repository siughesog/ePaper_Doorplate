/**
 * 安全工具函數
 * 用於驗證和清理用戶輸入，防止 XSS 和其他安全漏洞
 */

/**
 * 驗證圖片 URL 是否安全
 * @param {string} url - 要驗證的 URL
 * @returns {boolean} - 是否安全
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 1. 禁止 javascript: 協議
  if (url.toLowerCase().startsWith('javascript:')) {
    console.warn('安全警告: 檢測到 javascript: 協議');
    return false;
  }

  // 2. 禁止 data: 協議中的 HTML/JavaScript
  if (url.toLowerCase().startsWith('data:text/html') || 
      url.toLowerCase().startsWith('data:text/javascript') ||
      url.toLowerCase().startsWith('data:application/javascript')) {
    console.warn('安全警告: 檢測到危險的 data: 協議');
    return false;
  }

  // 3. 只允許安全的 data: 協議（圖片格式）
  const allowedDataProtocols = [
    'data:image/png',
    'data:image/jpeg',
    'data:image/jpg',
    'data:image/gif',
    'data:image/webp',
    'data:image/svg+xml'
  ];
  
  if (url.toLowerCase().startsWith('data:')) {
    const isAllowed = allowedDataProtocols.some(protocol => 
      url.toLowerCase().startsWith(protocol)
    );
    if (!isAllowed) {
      console.warn('安全警告: 不允許的 data: 協議類型');
      return false;
    }
  }

  // 4. 允許 blob: 協議（用於 URL.createObjectURL 創建的臨時 URL）
  if (url.toLowerCase().startsWith('blob:')) {
    // blob URL 是安全的，因為它們是瀏覽器本地創建的臨時 URL
    // 只能由創建它們的同一源訪問
    return true;
  }

  // 5. 驗證 HTTP/HTTPS URL 格式
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      // 檢查域名是否為允許的域名（可根據需要配置白名單）
      // 這裡只檢查格式，不限制域名（因為可能是用戶自己的服務器）
      
      // 檢查是否有常見的圖片文件擴展名（可選）
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const hasImageExtension = imageExtensions.some(ext => 
        urlObj.pathname.toLowerCase().endsWith(ext)
      );
      
      // 如果沒有擴展名，也可能是動態生成的圖片（通過查詢參數等），所以不強制要求
      return true;
    } catch (e) {
      console.warn('安全警告: 無效的 URL 格式', e);
      return false;
    }
  }

  // 6. 允許相對路徑（以 / 開頭）
  if (url.startsWith('/')) {
    // 相對路徑應該是安全的，因為它們指向同源
    return true;
  }

  // 7. 其他格式都視為不安全
  console.warn('安全警告: 未知的 URL 格式', url.substring(0, 50));
  return false;
}

/**
 * 清理和驗證圖片 URL
 * @param {string} url - 原始 URL
 * @returns {string|null} - 清理後的 URL，如果不安全則返回 null
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // 移除可能的危險字符
  let cleaned = url.trim();
  
  // 移除可能的換行符和其他控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  
  // 驗證 URL
  if (!validateImageUrl(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * 驗證文件類型是否為圖片
 * @param {File} file - 要驗證的文件
 * @returns {boolean} - 是否為有效的圖片文件
 */
export function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return false;
  }

  // 1. 檢查文件類型（MIME type）
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

  if (!allowedMimeTypes.includes(file.type)) {
    console.warn('安全警告: 不允許的文件類型', file.type);
    return false;
  }

  // 2. 檢查文件大小（限制為 10MB）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    console.warn('安全警告: 文件大小超過限制', file.size);
    return false;
  }

  // 3. 檢查文件名擴展名
  const fileName = file.name.toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    console.warn('安全警告: 文件擴展名不匹配', file.name);
    // 注意：這不是硬性要求，因為某些系統可能沒有擴展名
    // 但 MIME type 檢查已經足夠
  }

  return true;
}

/**
 * 驗證 Base64 圖片數據是否安全
 * @param {string} base64 - Base64 編碼的字符串
 * @returns {boolean} - 是否安全
 */
export function validateBase64Image(base64) {
  if (!base64 || typeof base64 !== 'string') {
    return false;
  }

  // 只允許 data:image/ 開頭的 Base64
  const allowedPrefixes = [
    'data:image/png;base64,',
    'data:image/jpeg;base64,',
    'data:image/jpg;base64,',
    'data:image/gif;base64,',
    'data:image/webp;base64,',
    'data:image/svg+xml;base64,'
  ];

  const lowerBase64 = base64.toLowerCase();
  const isAllowed = allowedPrefixes.some(prefix => 
    lowerBase64.startsWith(prefix)
  );

  if (!isAllowed) {
    console.warn('安全警告: 不允許的 Base64 格式', base64.substring(0, 50));
    return false;
  }

  // 驗證 Base64 編碼是否有效
  try {
    const base64Data = base64.split(',')[1];
    if (!base64Data) {
      return false;
    }
    // 檢查是否只包含有效的 Base64 字符
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      console.warn('安全警告: 無效的 Base64 編碼');
      return false;
    }
  } catch (e) {
    console.warn('安全警告: Base64 驗證錯誤', e);
    return false;
  }

  return true;
}

/**
 * 驗證圖片路徑格式
 * @param {string} imagePath - 圖片路徑
 * @returns {boolean} - 是否為有效的圖片路徑
 */
export function validateImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return false;
  }

  // 移除空白字符
  const cleaned = imagePath.trim();
  
  // 檢查是否包含危險字符
  const dangerousPatterns = [
    /\.\./,           // 路徑遍歷
    /%2e%2e/i,        // URL 編碼的路徑遍歷
    /javascript:/i,    // JavaScript 協議
    /onerror=/i,       // 事件處理器
    /onload=/i,        // 事件處理器
    /<script/i,        // 腳本標籤
    /eval\(/i,        // eval 函數
    /expression\(/i   // CSS expression
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cleaned)) {
      console.warn('安全警告: 檢測到危險模式', pattern);
      return false;
    }
  }

  return true;
}

/**
 * 創建安全的圖片 URL（驗證後返回）
 * @param {string} imagePath - 圖片路徑
 * @param {string} baseURL - 基礎 URL
 * @returns {string|null} - 安全的圖片 URL，如果不安全則返回 null
 */
export function createSafeImageUrl(imagePath, baseURL) {
  if (!validateImagePath(imagePath)) {
    return null;
  }

  // 處理不同的圖片路徑格式
  let imageUrl;
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // 完整的 URL，需要驗證
    if (!validateImageUrl(imagePath)) {
      return null;
    }
    imageUrl = imagePath;
  } else if (imagePath.startsWith('/')) {
    // 絕對路徑
    imageUrl = `${baseURL}${imagePath}`;
  } else if (imagePath.startsWith('images/')) {
    // 如果路徑已經以 images/ 開頭，直接轉換為 /images/...
    imageUrl = `${baseURL}/${imagePath}`;
  } else {
    // 其他相對路徑，使用 /api/images/ 前綴
    imageUrl = `${baseURL}/api/images/${imagePath}`;
  }

  // 最終驗證
  if (!validateImageUrl(imageUrl)) {
    return null;
  }

  return imageUrl;
}

/**
 * 安全的存儲用戶信息（減少敏感信息）
 * 注意：Token 仍然需要存儲，但我們可以添加額外的安全措施
 */
export const SecureStorage = {
  /**
   * 設置 token（添加額外的驗證）
   */
  setToken(token) {
    if (!token || typeof token !== 'string') {
      console.warn('安全警告: 無效的 token');
      return false;
    }
    
    // 驗證 token 格式（JWT 通常有三個部分）
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('安全警告: Token 格式異常');
      // 不強制要求，因為可能有其他格式的 token
    }
    
    try {
      localStorage.setItem('token', token);
      return true;
    } catch (e) {
      console.error('存儲 token 失敗:', e);
      return false;
    }
  },

  /**
   * 獲取 token
   */
  getToken() {
    try {
      return localStorage.getItem('token');
    } catch (e) {
      console.error('讀取 token 失敗:', e);
      return null;
    }
  },

  /**
   * 清除所有認證相關的存儲
   */
  clearAuth() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('isSuperuser');
      return true;
    } catch (e) {
      console.error('清除認證信息失敗:', e);
      return false;
    }
  }
};

