
import apiService from '../services/api';

// utils/handleSubmit.js
export const handleDetailSubmit = async (detailToSave) => {
  try {
    const response = await apiService.request(`${apiService.baseURL}/api/details`, {
      method: "POST",
      body: JSON.stringify(detailToSave)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Server responded with error:", errorText);
      return { success: false, message: errorText };
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error("❌ Network or code error:", error);
    return { success: false, message: error.message };
  }
};
