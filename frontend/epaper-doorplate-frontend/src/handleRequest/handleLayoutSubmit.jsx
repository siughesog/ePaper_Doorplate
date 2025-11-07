import apiService from '../services/api';

/**
 * 傳送 layout JSON 到指定伺服器，新增一筆 layout 資料
 *
 * @param {Array<Object>} data - 要傳送的 layout 元素資料
 * @param {string} userId - 使用者 ID
 * @param {string} layoutName - 此 layout 的名稱
 */
export async function handleLayoutSubmit(data, userId, layoutName) {
  try {
    const response = await apiService.request(`${apiService.legacyBaseURL}/layout/createOrUpdate?userId=${encodeURIComponent(userId)}&layoutName=${encodeURIComponent(layoutName)}`, {
      method: 'POST',
      body: JSON.stringify(data)  // List<LayoutElement>
    });

    if (!response.ok) {
      throw new Error(`伺服器錯誤：${response.status}`);
    }

    const result = await response.json();
    console.log('✅ 新增成功:', result);
    return result;
  } catch (error) {
    console.error('❌ 上傳失敗:', error);
    throw error;
  }
}
