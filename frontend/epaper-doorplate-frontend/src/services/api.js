// API服務 - 統一處理所有API調用並自動添加JWT token
import { validateImageUrl, createSafeImageUrl, SecureStorage } from '../utils/security';

class ApiService {
  constructor() {
    // 讀取環境變量（React 應用必須使用 REACT_APP_ 前綴）
    const envBase = process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_BASE_URL;
    
    // 調試：檢查環境變量
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 API Service 初始化:');
      console.log('   - REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
      console.log('   - NODE_ENV:', process.env.NODE_ENV);
    }
    
    // 處理環境變量
    let resolved;
    if (envBase && envBase.trim().length > 0) {
      resolved = envBase.trim();
      // 確保 URL 不以斜杠結尾
      if (resolved.endsWith('/')) {
        resolved = resolved.slice(0, -1);
      }
    } else {
      // 如果沒有設置環境變量，根據環境使用默認值
      if (process.env.NODE_ENV === 'production') {
        // 生產環境：如果沒有設置，會導致錯誤（應該設置環境變量）
        console.error('⚠️ 警告: REACT_APP_API_BASE_URL 未設置，API 請求可能失敗');
        resolved = ''; // 空字符串，會導致請求失敗，提醒設置環境變量
      } else {
        // 開發環境：使用 localhost
        resolved = 'https://localhost:8080';
      }
    }
    
    this.baseURL = resolved;
    this.legacyBaseURL = resolved; // 預設同一個端口
    
    if (process.env.NODE_ENV === 'development') {
      console.log('   - 最終 baseURL:', this.baseURL);
    }
  }

  // 獲取認證headers
  getAuthHeaders() {
    // 使用安全的存儲函數
    const token = SecureStorage.getToken();
    return {
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // 通用fetch方法
  async request(url, options = {}) {
    // 驗證 URL 格式
    if (!url || url.trim() === '') {
      throw new Error('API URL 為空，請檢查 REACT_APP_API_BASE_URL 環境變量');
    }
    
    // 確保 URL 是完整的（包含協議）
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.warn('⚠️ URL 缺少協議，嘗試添加 https://');
      fullUrl = `https://${url}`;
    }
    
    const authHeaders = this.getAuthHeaders();
    const hasBody = options && options.body !== undefined && options.body !== null;
    const isFormData = typeof FormData !== 'undefined' && hasBody && options.body instanceof FormData;
    const defaultHeaders = isFormData
      ? authHeaders
      : {
          ...authHeaders,
          ...(hasBody && { 'Content-Type': 'application/json' })
        };

    const config = {
      ...options,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      console.log('📤 API 請求:', fullUrl, options.method || 'GET');
      const response = await fetch(fullUrl, config);
      console.log('📥 API 響應:', response.status, response.statusText);
      
      // 如果token過期，清除本地存儲並重定向到登入頁
      if (response.status === 401) {
        SecureStorage.clearAuth();
        window.location.reload();
        throw new Error('認證已過期，請重新登入');
      }

      return response;
    } catch (error) {
      console.error('❌ API請求失敗:', error);
      console.error('   請求URL:', fullUrl);
      console.error('   請求配置:', config);
      
      // 提供更詳細的錯誤信息
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // 網絡錯誤或 CORS 錯誤
        throw new Error(`網絡連接失敗: ${error.message}。請檢查：1) 後端服務是否運行 2) URL 是否正確 3) CORS 配置`);
      }
      
      throw error;
    }
  }

  // 認證相關API
  async login(username, password) {
    if (!this.baseURL || this.baseURL.trim() === '') {
      throw new Error('API base URL 未設置。請在 Vercel 環境變量中設置 REACT_APP_API_BASE_URL');
    }
    
    const url = `${this.baseURL}/api/auth/login`;
    console.log('🔐 登入請求 URL:', url);
    
    const response = await this.request(url, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 登入失敗:', response.status, errorText);
      throw new Error(`登入失敗: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }

  async validateToken() {
    try {
      const response = await this.request(`${this.baseURL}/api/auth/validate`, {
        method: 'GET'
      });
      
      if (response.status === 401) {
        return false;
      }
      
      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async register(username, password, confirmPassword, email) {
    const response = await this.request(`${this.baseURL}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword, email })
    });
    return response.json();
  }

  // 門牌佈局相關API
  async loadLayout(layoutId) {
    const response = await this.request(`${this.legacyBaseURL}/layout/loadById?layoutId=${layoutId}`);
    return response.json();
  }

  async getLayoutSummaries(userId) {
    const response = await this.request(`${this.legacyBaseURL}/layout/summary?userId=${userId}`);
    return response.json();
  }

  async saveLayout(layoutData) {
    const response = await this.request(`${this.legacyBaseURL}/layout/save`, {
      method: 'POST',
      body: JSON.stringify(layoutData)
    });
    return response.json();
  }

  async updateLayout(layoutId, elements) {
    // 調試：檢查要發送的數據
    const dynamicImageElements = elements.filter(e => e.type === 'dynamicImage');
    if (dynamicImageElements.length > 0) {
      console.log('📤 前端 API：準備發送 updateLayout 請求');
      console.log('   layoutId:', layoutId);
      console.log('   包含 dynamicImage 元素:', dynamicImageElements.length);
      dynamicImageElements.forEach(elem => {
        console.log('   - element:', {
          id: elem.id,
          type: elem.type,
          selectedImageId: elem.selectedImageId,
          imageId: elem.imageId,
          content: elem.content
        });
      });
      console.log('   完整 elements JSON:', JSON.stringify(elements, null, 2));
    }
    
    const response = await this.request(`${this.legacyBaseURL}/layout/updateById?layoutId=${layoutId}`, {
      method: 'POST',
      body: JSON.stringify(elements)
    });
    return response.json();
  }

  async deleteLayout(layoutId) {
    const response = await this.request(`${this.legacyBaseURL}/layout/delete?layoutId=${layoutId}`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  // 渲染相關API
  async renderDoorplate(layoutId, elements, userId) {
    const response = await this.request(`${this.legacyBaseURL}/render/doorplate?layoutId=${layoutId}&userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(elements)
    });
    return response.blob();
  }

  // 圖片相關API
  async getImages(userId) {
    const response = await this.request(`${this.legacyBaseURL}/api/images?userId=${encodeURIComponent(userId)}`);
    return response.json();
  }

  async uploadImage(formData, userId) {
    const response = await this.request(`${this.legacyBaseURL}/api/images?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: formData
    });
    
      if (!response.ok) {
        if (response.status === 401) {
          SecureStorage.clearAuth();
          window.location.reload();
          throw new Error('認證已過期，請重新登入');
        }
        throw new Error(`上傳失敗: ${response.status} ${response.statusText}`);
      }
    
    return response.json();
  }

  async deleteImage(imageId, userId) {
    const response = await this.request(`${this.legacyBaseURL}/api/images/${imageId}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  async getImageReferences(imageId) {
    const response = await this.request(`${this.legacyBaseURL}/api/images/${imageId}/references`);
    return response.json();
  }

  async getImageLibraryItemReferences(libraryItemId) {
    const response = await this.request(`${this.legacyBaseURL}/imageLibrary/${libraryItemId}/references`);
    return response.json();
  }

  // 文字庫相關API
  async getTextLibrary(userId, elementId) {
    const response = await this.request(`${this.legacyBaseURL}/textLibrary/list?userId=${userId}&elementId=${elementId}`);
    return response.json();
  }

  async saveTextLibrary(userId, textData) {
    const response = await this.request(`${this.legacyBaseURL}/textLibrary/save?userId=${userId}`, {
      method: 'POST',
      body: JSON.stringify(textData)
    });
    return response.json();
  }

  async deleteTextLibrary(textId) {
    const response = await this.request(`${this.legacyBaseURL}/textLibrary/delete?userId=admin&textId=${textId}`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  // 圖片庫相關API
  async getImageLibrary(userId) {
    const response = await this.request(`${this.legacyBaseURL}/imageLibrary/list?userId=${encodeURIComponent(userId)}`);
    return response.json();
  }

  async saveImageLibrary(imageData, userId) {
    const response = await this.request(`${this.legacyBaseURL}/imageLibrary/save?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(imageData)
    });
    return response.json();
  }

  async deleteImageLibrary(itemId, userId) {
    const response = await this.request(`${this.legacyBaseURL}/imageLibrary/delete?userId=${encodeURIComponent(userId)}&itemId=${itemId}`, {
      method: 'DELETE'
    });
    return response.ok;
  }

  // 顯示信息相關API
  async getDisplayInfo() {
    const response = await this.request(`${this.legacyBaseURL}/api/display`);
    return response.json();
  }

  async saveDisplayInfo(displayData) {
    const response = await this.request(`${this.legacyBaseURL}/api/display`, {
      method: 'POST',
      body: JSON.stringify(displayData)
    });
    return response.json();
  }

  // 內部方法：載入圖片blob（支持多種策略）
  async _loadImageBlobInternal(fullUrl) {
    console.log(`🔄 _loadImageBlobInternal 開始，fullUrl: ${fullUrl}`);
    
    // 對於公開靜態圖片路徑，使用多層回退策略
    if (fullUrl.includes('/images/')) {
      console.log('   使用 /images/ 路徑的多層回退策略');
      
      // 1) 優先嘗試只帶 Authorization、不帶 cookie 的請求（部分服務器允許 Bearer，不允許 cookie）
      const token = localStorage.getItem('token');
      if (token) {
        try {
          console.log('   策略1: 嘗試帶 Authorization header 的請求');
          const authOnly = await fetch(fullUrl, {
            credentials: 'omit',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (authOnly.ok) {
            console.log('   ✅ 策略1 成功');
            return authOnly.blob();
          } else {
            console.log(`   ❌ 策略1 失敗，狀態碼: ${authOnly.status}`);
          }
        } catch (e) {
          console.log('   ❌ 策略1 異常:', e.message);
        }
      }

      // 2) 回退到純 fetch（完全不帶憑證/標頭）
      try {
        console.log('   策略2: 嘗試純 fetch（無憑證）');
        const resp = await fetch(fullUrl, { credentials: 'omit' });
        if (resp.ok) {
          console.log('   ✅ 策略2 成功');
          return resp.blob();
        } else {
          console.log(`   ❌ 策略2 失敗，狀態碼: ${resp.status}`);
        }
      } catch (e) {
        console.log('   ❌ 策略2 異常:', e.message);
      }

      // 3) 最後嘗試通用 request（帶 cookies/headers），以涵蓋其餘配置
      try {
        console.log('   策略3: 嘗試通用 request（帶 cookies/headers）');
        const fallback = await this.request(fullUrl);
        if (fallback.ok) {
          console.log('   ✅ 策略3 成功');
          return fallback.blob();
        } else {
          console.log(`   ❌ 策略3 失敗，狀態碼: ${fallback.status}`);
          throw new Error(`圖片載入失敗: ${fallback.status}`);
        }
      } catch (e) {
        console.log('   ❌ 策略3 異常:', e.message);
        throw e;
      }
    }
    
    // 其他路徑使用通用request方法
    console.log('   使用通用 request 方法');
    try {
      const response = await this.request(fullUrl);
      if (response.ok) {
        console.log('   ✅ 通用 request 成功');
        return response.blob();
      } else {
        console.log(`   ❌ 通用 request 失敗，狀態碼: ${response.status}`);
        throw new Error(`圖片載入失敗: ${response.status}`);
      }
    } catch (e) {
      console.log('   ❌ 通用 request 異常:', e.message);
      throw e;
    }
  }

  // 獲取圖片數據（用於預覽）
  async getImageData(imageUrl) {
    console.log(`📥 getImageData 被調用，imageUrl: ${imageUrl}`);
    
    // 使用 createSafeImageUrl 處理路徑（支持相對路徑、絕對路徑、完整 URL）
    let fullUrl;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || 
        imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      // 完整的 URL 或 blob/data URL，直接驗證
      if (!validateImageUrl(imageUrl)) {
        console.error('❌ 圖片 URL 驗證失敗:', imageUrl);
        throw new Error('不安全的圖片 URL，已拒絕加載');
      }
      fullUrl = imageUrl;
    } else {
      // 相對路徑或絕對路徑，使用 createSafeImageUrl 處理
      fullUrl = createSafeImageUrl(imageUrl, this.legacyBaseURL);
      if (!fullUrl) {
        console.error('❌ 圖片路徑處理失敗:', imageUrl);
        throw new Error('不安全的圖片路徑，已拒絕加載');
      }
    }
    
    console.log(`   構建完整 URL: ${fullUrl}`);
    
    // 最終驗證完整 URL
    if (!validateImageUrl(fullUrl)) {
      console.error('❌ 完整圖片 URL 驗證失敗:', fullUrl);
      throw new Error('不安全的完整圖片 URL，已拒絕加載');
    }
    
    return this._loadImageBlobInternal(fullUrl);
  }

  // 載入圖片blob（根據圖片路徑自動處理URL格式）
  async loadImageBlob(imagePath) {
    // 使用安全函數創建圖片 URL
    const imageUrl = createSafeImageUrl(imagePath, this.legacyBaseURL);
    if (!imageUrl) {
      throw new Error('不安全的圖片路徑，已拒絕加載');
    }
    
    return this._loadImageBlobInternal(imageUrl);
  }

  // 裝置相關API
  async deviceActivate(uniqueId) {
    const url = `${this.legacyBaseURL}/device/activate?unique_id=${encodeURIComponent(uniqueId)}`;
    const response = await this.request(url, { method: 'POST' });
    return response.json();
  }

  async deviceBind(activationCode, deviceName, username) {
    const params = new URLSearchParams({
      activation_code: activationCode,
      deviceName: deviceName,
      username: username
    });
    const response = await this.request(`${this.legacyBaseURL}/device/bind?${params.toString()}`, {
      method: 'POST'
    });
    return response.json();
  }

  async deviceUpdate(deviceID, { deviceName, refreshInterval, forceNoUpdate } = {}) {
    const params = new URLSearchParams({ deviceID });
    if (deviceName) params.set('deviceName', deviceName);
    if (typeof refreshInterval === 'number') params.set('refreshInterval', String(refreshInterval));
    if (typeof forceNoUpdate === 'boolean') params.set('forceNoUpdate', String(forceNoUpdate));
    const response = await this.request(`${this.legacyBaseURL}/device/update?${params.toString()}`, {
      method: 'POST'
    });
    return response.json();
  }

  async deviceUnbind(deviceID) {
    const response = await this.request(`${this.legacyBaseURL}/device/unbind?deviceID=${encodeURIComponent(deviceID)}`, {
      method: 'POST'
    });
    return response.json();
  }

  async deviceStatus(deviceID) {
    const response = await this.request(`${this.legacyBaseURL}/device/status?deviceID=${encodeURIComponent(deviceID)}`, {
      method: 'POST'
    });
    return response.json();
  }

  // 獲取用戶設備列表
  async getUserDevices(username) {
    const response = await this.request(`${this.baseURL}/device/list?username=${encodeURIComponent(username)}`);
    return response.json();
  }

  // 更新裝置模板
  async updateDeviceTemplate(deviceId, templateId) {
    const response = await this.request(`${this.baseURL}/device/update-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        deviceID: deviceId,
        templateId: templateId
      })
    });
    return response.json();
  }

  // 硬體白名單相關API
  async getHardwareWhitelist() {
    const response = await this.request(`${this.baseURL}/api/hardware-whitelist`);
    return response.json();
  }

  async addToHardwareWhitelist(uniqueId) {
    const response = await this.request(`${this.baseURL}/api/hardware-whitelist/add?uniqueId=${encodeURIComponent(uniqueId)}`, {
      method: 'POST'
    });
    return response.json();
  }

  async removeFromHardwareWhitelist(uniqueId) {
    const response = await this.request(`${this.baseURL}/api/hardware-whitelist/remove?uniqueId=${encodeURIComponent(uniqueId)}`, {
      method: 'POST'
    });
    return response.json();
  }

  async checkHardwareWhitelist(uniqueId) {
    const response = await this.request(`${this.baseURL}/api/hardware-whitelist/check?uniqueId=${encodeURIComponent(uniqueId)}`);
    return response.json();
  }

  // 設定相關API
  async getSettings() {
    const response = await this.request(`${this.baseURL}/api/settings`);
    return response.json();
  }

  async updateSettings(settings) {
    const response = await this.request(`${this.baseURL}/api/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
    return response.json();
  }

  // 更新帳戶資訊（用戶名、電子郵件、密碼）
  async updateAccount(accountData) {
    const response = await this.request(`${this.baseURL}/api/settings/account`, {
      method: 'PUT',
      body: JSON.stringify(accountData)
    });
    return response.json();
  }

  // Line Bot 相關API
  async getLineBotInfo() {
    const response = await this.request(`${this.baseURL}/api/line/info`, {
      method: 'GET'
    });
    return response.json();
  }

  async generateLineVerificationCode() {
    const response = await this.request(`${this.baseURL}/api/line/generate-verification-code`, {
      method: 'POST'
    });
    return response.json();
  }

  async unbindLine() {
    const response = await this.request(`${this.baseURL}/api/line/unbind`, {
      method: 'POST'
    });
    return response.json();
  }

  // Guest 留言相關API（公開，不需要認證）
  async getGuestMessagePageSettings(token) {
    const response = await fetch(`${this.baseURL}/api/guest/message-page?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      credentials: 'include'
    });
    return response.json();
  }

  async submitGuestMessage(token, message) {
    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('message', message);
    
    const response = await fetch(`${this.baseURL}/api/guest/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      credentials: 'include'
    });
    return response.json();
  }
}

// 創建單例實例
const apiService = new ApiService();
export default apiService;
