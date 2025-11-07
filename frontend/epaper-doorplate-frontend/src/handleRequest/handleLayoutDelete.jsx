import apiService from '../services/api';

/**
 * 根據 userId 和 layoutName 刪除指定 layout
 * @param {string} userId - 使用者 ID
 * @param {string} layoutName - layout 名稱
 */
export async function handleLayoutDelete(userId, layoutName) {
  const params = new URLSearchParams({
    userId,
    layoutName,
  });

  const endpoint = `${apiService.legacyBaseURL}/layout/delete?${params.toString()}`;

  try {
    const response = await apiService.request(endpoint, {
      method: 'DELETE',  // 依你的後端需求，有些會用 POST 也可
    });

    if (!response.ok) {
      throw new Error(`伺服器錯誤：${response.status}`);
    }

    // 後端返回的是純文本 "Layout 刪除成功"，不是 JSON
    // 先檢查 Content-Type，然後決定如何讀取響應
    const contentType = response.headers.get('content-type') || '';
    let result;
    
    if (contentType.includes('application/json')) {
      // JSON 響應
      result = await response.json();
    } else {
      // 純文本響應（後端返回 "Layout 刪除成功"）
      const text = await response.text();
      result = { message: text, success: true };
    }
    
    console.log('✅ 刪除成功:', result);
    return result;
  } catch (error) {
    console.error('❌ 刪除失敗:', error);
    throw error;
  }
}
