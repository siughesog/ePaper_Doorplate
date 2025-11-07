import apiService from '../services/api';

// api/templatesApi.js

export async function handleLayoutLoad(userId, layoutName) {
  try {
    const res = await apiService.request(`${apiService.legacyBaseURL}/layout/load?userId=${encodeURIComponent(userId)}&layoutName=${encodeURIComponent(layoutName)}`);
    if (!res.ok) {
      throw new Error('Fetch templates failed: ' + res.statusText);
    }
    return res.json();
  } catch (error) {
    console.error('❌ 載入失敗:', error);
    throw error;
  }
}
