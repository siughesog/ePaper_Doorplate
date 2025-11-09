import { useState, useEffect } from 'react';
import { 
  Settings, 
  Type, 
  Image, 
  Save, 
  Edit3, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  LayoutTemplate,
  Eye,
  RefreshCw,
  X
} from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { db } from './db';
import apiService from './services/api';
import { useToast } from './components/Toast';
import { createSafeImageUrl } from './utils/security';

export default function DynamicConfigPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [dynamicElements, setDynamicElements] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingElement, setEditingElement] = useState(null);
  const [textLibrary, setTextLibrary] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLibrary, setImageLibrary] = useState([]);
  const [renderedImageUrl, setRenderedImageUrl] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  // 載入模板列表和圖片庫
  useEffect(() => {
    const currentUserId = localStorage.getItem('username');
    if (currentUserId) {
      loadTemplates();
      loadImageLibrary();
      loadTextLibrary();
      loadDevices();
    }
  }, []);

  // 清理 Blob URL 防止內存泄漏
  useEffect(() => {
    return () => {
      if (renderedImageUrl) {
        URL.revokeObjectURL(renderedImageUrl);
      }
    };
  }, [renderedImageUrl]);

  // 監聽用戶登錄狀態變化
  useEffect(() => {
    const handleStorageChange = () => {
      const currentUserId = localStorage.getItem('username');
      if (currentUserId) {
        loadTemplates();
        loadImageLibrary();
        loadTextLibrary();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 載入選中模板的動態元素
  useEffect(() => {
    if (selectedTemplate) {
      // 保存當前選擇的模板ID到 localStorage
      localStorage.setItem('currentTemplateId', selectedTemplate);
      
      loadDynamicElements(selectedTemplate);
      // 切換模板時清除舊的預覽結果
      if (renderedImageUrl) {
        URL.revokeObjectURL(renderedImageUrl);
        setRenderedImageUrl(null);
      }
    }
  }, [selectedTemplate]);

  // 模板變更時自動更新選中的裝置
  useEffect(() => {
    if (selectedTemplate && selectedDevice) {
      updateDeviceTemplateOnTemplateChange();
    }
  }, [selectedTemplate]);

  const updateDeviceTemplateOnTemplateChange = async () => {
    if (!selectedTemplate || !selectedDevice) return;
    
    try {
      await updateDeviceTemplate(selectedDevice, selectedTemplate);
    } catch (error) {
      console.error('模板變更時更新裝置失敗:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const data = await apiService.getLayoutSummaries(currentUserId);
      setTemplates(data);
      
      if (data.length > 0) {
        // 嘗試從 localStorage 恢復上次選擇的模板
        const savedTemplateId = localStorage.getItem('currentTemplateId');
        if (savedTemplateId && data.some(t => t.id === savedTemplateId)) {
          // 如果保存的模板ID存在於模板列表中，則選擇它
          setSelectedTemplate(savedTemplateId);
          console.log('恢復上次選擇的模板:', savedTemplateId);
        } else {
          // 否則選擇第一個模板
          setSelectedTemplate(data[0].id);
        }
      } else {
        setDynamicElements([]);
      }
    } catch (error) {
      console.error('載入模板失敗:', error);
      setDynamicElements([]);
    }
  };

  const loadDevices = async () => {
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const result = await apiService.getUserDevices(currentUserId);
      if (result.success) {
        setDevices(result.devices || []);
        
        if (result.devices && result.devices.length > 0) {
          setSelectedDevice(result.devices[0].deviceId);
        }
      } else {
        console.error('載入裝置失敗:', result.message);
        setDevices([]);
      }
    } catch (error) {
      console.error('載入裝置失敗:', error);
      setDevices([]);
    }
  };

  const loadDynamicElements = async (templateId) => {
    setIsLoading(true);
    try {
      const layout = await apiService.loadLayout(templateId);
      
      const dynamic = layout.elements?.filter(elem => 
        elem.type === 'dynamicText' || elem.type === 'dynamicImage'
      ) || [];
      
      if (dynamic.length === 0) {
        setDynamicElements([]);
      } else {
        // 為動態圖片元素重新生成 imageUrl 並恢復 selectedImageId
        const processedDynamic = await Promise.all(dynamic.map(async (elem) => {
          if (elem.type === 'dynamicImage' && elem.content && elem.blackThreshold !== undefined) {
            try {
              // 根據保存的參數重新處理圖片
              const processedImageUrl = await processImageWithParams(
                elem.content, 
                elem.blackThreshold, 
                elem.whiteThreshold, 
                elem.contrast
              );
              
              // 如果沒有 selectedImageId，嘗試從 imageId 和 content 反向查找
              let selectedImageId = elem.selectedImageId;
              if (!selectedImageId && imageLibrary.length > 0) {
                // 嘗試根據 originalImageId 和 originalImagePath 匹配
                const matchedItem = imageLibrary.find(item => 
                  item.originalImageId === elem.imageId && 
                  item.originalImagePath === elem.content
                );
                if (matchedItem) {
                  selectedImageId = matchedItem.id;
                }
              }
              
              return {
                ...elem,
                imageUrl: processedImageUrl,
                selectedImageId: selectedImageId || elem.selectedImageId // 保留或恢復 selectedImageId
              };
            } catch (error) {
              console.error('重新處理圖片失敗:', error);
              return elem;
            }
          }
          return elem;
        }));
        
        setDynamicElements(processedDynamic);
      }
    } catch (error) {
      console.error('載入動態元素失敗:', error);
      setDynamicElements([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadImageLibrary = async () => {
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const library = await apiService.getImageLibrary(currentUserId);
      setImageLibrary(library);
    } catch (error) {
      console.error('載入圖片庫失敗:', error);
      setImageLibrary([]);
    }
  };

  const loadTextLibrary = async (elementId = null) => {
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const texts = await apiService.getTextLibrary(currentUserId, elementId);
      setTextLibrary(texts || []);
    } catch (error) {
      console.error('載入文字庫失敗:', error);
      setTextLibrary([]);
    }
  };

  // 新增文字到文字庫
  const addTextToLibrary = async (text, elementId = null) => {
    if (!text.trim()) return;
    
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const newTextItem = await apiService.saveTextLibrary(currentUserId, {
        text: text.trim(),
        elementId: elementId // 關聯到特定的動態文字元素
      });

      setTextLibrary(prev => [...prev, newTextItem]);
      return newTextItem;
    } catch (error) {
      console.error('新增文字到文字庫失敗:', error);
      throw error;
    }
  };

  // 從文字庫刪除文字
  const deleteTextFromLibrary = async (textId) => {
    try {
      await apiService.deleteTextLibrary(textId);

      setTextLibrary(prev => prev.filter(item => item.id !== textId));
    } catch (error) {
      console.error('從文字庫刪除文字失敗:', error);
      throw error;
    }
  };

  const processImageWithParams = async (imagePath, blackThreshold, whiteThreshold, contrast) => {
    try {
      // 與 ImageManager.jsx 一致：使用 createSafeImageUrl 處理路徑
      const imageUrl = createSafeImageUrl(imagePath, apiService.legacyBaseURL);
      if (!imageUrl) {
        throw new Error('不安全的圖片路徑，已拒絕加載');
      }
      
      // 與 ImageManager.jsx 一致：使用 getImageData（內含多層回退策略）
      const blob = await apiService.getImageData(imageUrl);
      const objectUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 與 ImageManager 一致：先填充白色背景（處理透明背景）
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 480;
            
            let targetWidth = img.width;
            let targetHeight = img.height;
            
            // 檢查是否需要等比例縮放（與 ImageManager 一致）
            if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
              const widthRatio = MAX_WIDTH / img.width;
              const heightRatio = MAX_HEIGHT / img.height;
              const scale = Math.min(widthRatio, heightRatio);
              targetWidth = Math.floor(img.width * scale);
              targetHeight = Math.floor(img.height * scale);
            }
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // 先填充白色背景（處理透明背景）
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 然後繪製原始圖片（縮放到目標尺寸）
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            
            // 獲取圖片數據
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 應用灰階轉換、對比度和閾值（與 TemplateEditor 和 Python 腳本完全一致）
            for (let i = 0; i < data.length; i += 4) {
              // 1. 計算灰階值
              let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              
              // 2. 應用 gamma 對比度調整（與 TemplateEditor 和 Python 腳本一致）
              if (contrast !== 1) {
                gray = 255 * Math.pow(gray / 255, 1 / contrast);
                gray = Math.max(0, Math.min(255, gray));
              }
              
              // 3. 應用三色閾值映射（與 ImageManager、TemplateEditor 和 Python 腳本一致）
              if (gray < blackThreshold) {
                data[i] = 0;       // R
                data[i + 1] = 0;   // G
                data[i + 2] = 0;   // B
              } else if (gray > whiteThreshold) {
                data[i] = 255;     // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
              } else {
                data[i] = 255;     // R
                data[i + 1] = 0;   // G
                data[i + 2] = 0;   // B
              }
            }
            
            // 將處理後的數據放回畫布
            ctx.putImageData(imageData, 0, 0);
            
            // 轉換為 base64
            const processedImageUrl = canvas.toDataURL('image/webp');
            resolve(processedImageUrl);
            
            // 清理
            URL.revokeObjectURL(objectUrl);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => reject(new Error('圖片載入失敗'));
        img.src = objectUrl;
      });
    } catch (error) {
      console.error('處理圖片失敗:', error);
      throw error;
    }
  };

  const handleElementEdit = (element) => {
    setEditingElement(element);
  };

  const handleElementSave = async (updatedElement) => {
    try {
      // 更新前端狀態
      setDynamicElements(prev => 
        prev.map(elem => 
          elem.id === updatedElement.id ? updatedElement : elem
        )
      );
      
      // 立即保存到後端
      await saveDynamicElementsToBackend();
      
      setEditingElement(null);
    } catch (error) {
      console.error('保存動態元素失敗:', error);
      toast.error('保存失敗，請重試');
    }
  };

  const handleElementDelete = async (elementId) => {
    try {
      // 更新前端狀態
      setDynamicElements(prev => prev.filter(elem => elem.id !== elementId));
      
      // 保存到後端
      await saveDynamicElementsToBackend();
      
    } catch (error) {
      console.error('刪除動態元素失敗:', error);
      toast.error('刪除失敗，請重試');
    }
  };

  const saveDynamicElementsToBackend = async () => {
    if (!selectedTemplate) {
      console.error('沒有選中的模板');
      return;
    }
    
    try {
      // 獲取當前模板的完整數據
      const layout = await apiService.loadLayout(selectedTemplate);
      
      // 更新動態元素
      const updatedElements = layout.elements.map(elem => {
        const dynamicElem = dynamicElements.find(de => de.id === elem.id);
        if (dynamicElem) {
          // 如果是動態圖片
          if (dynamicElem.type === 'dynamicImage') {
            // 如果選擇了圖片庫中的圖片
            if (dynamicElem.selectedImageId) {
              const selectedLibraryItem = imageLibrary.find(item => item.id === dynamicElem.selectedImageId);
              if (selectedLibraryItem) {
                return {
                  ...elem,
                  ...dynamicElem,
                  // 不保存完整的圖片，只保存映射和參數
                  imageId: selectedLibraryItem.originalImageId, // 映射到原始圖片的ID
                  content: selectedLibraryItem.originalImagePath, // 映射到原始圖片路徑
                  blackThreshold: selectedLibraryItem.blackThreshold, // 處理參數
                  whiteThreshold: selectedLibraryItem.whiteThreshold, // 處理參數
                  contrast: selectedLibraryItem.contrast, // 處理參數
                  selectedImageId: dynamicElem.selectedImageId, // 保存 selectedImageId 以便刷新後恢復
                  // 移除 imageUrl，讓前端重新渲染
                  imageUrl: null
                };
              }
            }
            // 如果沒有 selectedImageId，但原 elem 有，則保留原值（用於已保存的數據）
            const merged = { ...elem, ...dynamicElem };
            if (!merged.selectedImageId && elem.selectedImageId) {
              merged.selectedImageId = elem.selectedImageId;
            }
            // 確保 selectedImageId 被明確保存（即使為空字符串也要保存）
            if (!merged.hasOwnProperty('selectedImageId')) {
              merged.selectedImageId = dynamicElem.selectedImageId || elem.selectedImageId || null;
            }
            return merged;
          }
          // 其他類型的元素：直接合併
          return { ...elem, ...dynamicElem };
        }
        return elem;
      });
      
      // 調試：檢查要保存的數據
      const dynamicImageElements = updatedElements.filter(e => e.type === 'dynamicImage');
      if (dynamicImageElements.length > 0) {
        console.log('📤 前端：準備保存 layout，包含 dynamicImage 元素:');
        dynamicImageElements.forEach(elem => {
          console.log('   - element id:', elem.id);
          console.log('   - selectedImageId:', elem.selectedImageId);
          console.log('   - imageId:', elem.imageId);
        });
      }
      
      // 保存到後端
      await apiService.updateLayout(selectedTemplate, updatedElements);
      
      // 如果有選中的裝置，更新裝置的模板配置
      if (selectedDevice) {
        await updateDeviceTemplate(selectedDevice, selectedTemplate);
      }
      
    } catch (error) {
      console.error('保存動態元素到後端失敗:', error);
      throw error;
    }
  };

  const updateDeviceTemplate = async (deviceId, templateId) => {
    try {
      const result = await apiService.updateDeviceTemplate(deviceId, templateId);
      
      if (!result.success) {
        console.error('更新裝置模板失敗:', result.message);
      }
    } catch (error) {
      console.error('更新裝置模板失敗:', error);
    }
  };

  const handleSaveLayout = async () => {
    try {
      await saveDynamicElementsToBackend();
      toast.success('配置保存成功！');
    } catch (error) {
      console.error('保存失敗:', error);
      toast.error('保存失敗，請重試');
    }
  };

  const renderPreview = async () => {
    if (!selectedTemplate) {
      toast.warning('請先選擇模板');
      return;
    }
    
    setIsRendering(true);
    try {
      // 獲取當前模板的完整數據
      const layout = await apiService.loadLayout(selectedTemplate);
      
      // 更新動態元素，並確保所有圖片元素都有正確的 imageUrl
      const updatedElements = layout.elements.map(elem => {
        const dynamicElem = dynamicElements.find(de => de.id === elem.id);
        if (dynamicElem) {
          // 如果是動態圖片且選擇了圖片庫中的圖片
          if (dynamicElem.type === 'dynamicImage' && dynamicElem.selectedImageId) {
            const selectedLibraryItem = imageLibrary.find(item => item.id === dynamicElem.selectedImageId);
            if (selectedLibraryItem) {
              // 將 originalImagePath 轉換為完整的 URL，以便後端 Python 腳本正確加載
              const imageUrl = createSafeImageUrl(selectedLibraryItem.originalImagePath, apiService.legacyBaseURL);
              
              return {
                ...elem,
                ...dynamicElem,
                // 保存映射和參數
                imageId: selectedLibraryItem.originalImageId, // 映射到原始圖片的ID
                content: selectedLibraryItem.originalImagePath, // 映射到原始圖片路徑
                imageUrl: imageUrl || null, // 提供完整的 URL 給後端（優先使用）
                blackThreshold: selectedLibraryItem.blackThreshold, // 處理參數
                whiteThreshold: selectedLibraryItem.whiteThreshold, // 處理參數
                contrast: selectedLibraryItem.contrast, // 處理參數
                selectedImageId: dynamicElem.selectedImageId // 保存 selectedImageId 以便刷新後恢復
              };
            }
          }
          // 其他情況直接合併
          return { ...elem, ...dynamicElem };
        }
        
        // 對於靜態圖片元素，確保有正確的 imageUrl
        if (elem.type === 'image') {
          let imageUrl = elem.imageUrl;
          
          // 如果 imageUrl 不存在或為空，從 content 構建
          if (!imageUrl && elem.content) {
            imageUrl = createSafeImageUrl(elem.content, apiService.legacyBaseURL);
            console.log(`🖼️ 靜態圖片元素 ${elem.name || elem.id}: 從 content 構建 imageUrl:`, imageUrl);
          }
          
          // 如果仍然沒有 imageUrl，嘗試從 imageId 構建
          if (!imageUrl && elem.imageId) {
            imageUrl = createSafeImageUrl(`/images/${elem.imageId}`, apiService.legacyBaseURL);
            console.log(`🖼️ 靜態圖片元素 ${elem.name || elem.id}: 從 imageId 構建 imageUrl:`, imageUrl);
          }
          
          if (imageUrl) {
            return {
              ...elem,
              imageUrl: imageUrl
            };
          } else {
            console.warn(`⚠️ 靜態圖片元素 ${elem.name || elem.id}: 無法構建 imageUrl，content: ${elem.content}, imageId: ${elem.imageId}`);
          }
        }
        
        return elem;
      });
      
      // 調用渲染API（傳遞當前用戶ID）
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      
      const imageBlob = await apiService.renderDoorplate(selectedTemplate, updatedElements, currentUserId);
      
      // 清理舊的 Blob URL（如果存在）
      if (renderedImageUrl) {
        URL.revokeObjectURL(renderedImageUrl);
      }
      
      const imageUrl = URL.createObjectURL(imageBlob);
      setRenderedImageUrl(imageUrl);
    } catch (error) {
      console.error('渲染預覽失敗:', error);
      toast.error('渲染預覽失敗，請重試');
    } finally {
      setIsRendering(false);
    }
  };

  

  const goToTemplateEditor = () => {
    navigate('/template');
  };

  const DynamicTextCard = ({ element }) => (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Type className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{element.name || '動態文字'}</h3>
            <p className="text-sm text-slate-500">動態文字元素</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handleElementEdit(element)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="編輯"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleElementDelete(element.id)}
            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-sm text-slate-600 mb-1">當前文字</p>
          <p className="font-medium text-slate-800">{element.text || '未設定'}</p>
        </div>
      </div>
    </div>
  );

  const DynamicImageCard = ({ element, imageLibrary }) => {
    // 根據 selectedImageId 查找對應的圖片名稱
    const selectedImage = element.selectedImageId 
      ? imageLibrary.find(item => item.id === element.selectedImageId)
      : null;
    const currentImageName = selectedImage ? selectedImage.name : '未設定圖片';

    return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Image className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{element.name || '動態圖片'}</h3>
            <p className="text-sm text-slate-500">動態圖片元素</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => handleElementEdit(element)}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="編輯"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleElementDelete(element.id)}
            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-600 mb-1">當前圖片名稱</p>
          <p className="font-medium text-slate-800">
              {currentImageName}
          </p>
        </div>


      </div>
    </div>
  );
  };

  const ElementEditModal = ({ element, onSave, onClose }) => {
    const [formData, setFormData] = useState({
      name: element.name || '',
      text: element.text || '',
      fontSize: element.fontSize || 16,
      color: element.color || '#000000',
      width: element.width || 200,
      height: element.height || 40,
      x: element.x || 0,
      y: element.y || 0,
      selectedImageId: element.selectedImageId || ''
    });
    
    const [newText, setNewText] = useState(''); // 新增文字輸入
    const [showAddText, setShowAddText] = useState(false); // 顯示新增文字輸入框
    const [elementTextLibrary, setElementTextLibrary] = useState([]); // 當前元素的文字庫
    const [editingTextId, setEditingTextId] = useState(null); // 正在編輯的文字ID
    const [editingText, setEditingText] = useState(''); // 編輯中的文字內容

    // 載入當前元素的文字庫
    useEffect(() => {
      if (element.type === 'dynamicText') {
        const loadElementTextLibrary = async () => {
          try {
            console.log('正在載入文字庫...', `for element: ${element.id}`);
            const currentUserId = localStorage.getItem('username');
            if (!currentUserId) {
              console.error('無法獲取當前用戶ID，請重新登錄');
              return;
            }
            const url = `${apiService.legacyBaseURL}/textLibrary/list?userId=${currentUserId}&elementId=${element.id}`;
            
            const response = await apiService.request(url);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const texts = await response.json();
            setElementTextLibrary(texts || []);
          } catch (error) {
            console.error('載入元素文字庫失敗:', error);
            setElementTextLibrary([]);
          }
        };
        
        loadElementTextLibrary();
      }
    }, [element.id, element.type]);

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave({ ...element, ...formData });
    };

    // 新增文字到文字庫
    const handleAddText = async () => {
      if (newText.trim()) {
        try {
          const currentUserId = localStorage.getItem('username');
          if (!currentUserId) {
            console.error('無法獲取當前用戶ID，請重新登錄');
            return;
          }
          const newTextItem = await apiService.saveTextLibrary(currentUserId, {
            text: newText.trim(),
            elementId: element.id
          });

          setElementTextLibrary(prev => [...prev, newTextItem]);
          setFormData({...formData, text: newText.trim()});
          setNewText('');
          setShowAddText(false);
        } catch (error) {
          console.error('新增文字到元素文字庫失敗:', error);
          toast.error('新增文字失敗，請重試');
        }
      }
    };

    // 開始編輯文字
    const handleStartEditText = (textId, currentText) => {
      setEditingTextId(textId);
      setEditingText(currentText);
    };

    // 取消編輯文字
    const handleCancelEditText = () => {
      setEditingTextId(null);
      setEditingText('');
    };

    // 保存編輯的文字
    const handleSaveEditText = async () => {
      if (!editingText.trim()) {
        toast.warning('文字內容不能為空');
        return;
      }

      try {
        const currentUserId = localStorage.getItem('username');
        if (!currentUserId) {
          console.error('無法獲取當前用戶ID，請重新登錄');
          return;
        }
        const updatedTextItem = await apiService.saveTextLibrary(currentUserId, {
          id: editingTextId,
          text: editingText.trim(),
          elementId: element.id
        });
        setElementTextLibrary(prev => 
          prev.map(item => item.id === editingTextId ? updatedTextItem : item)
        );
        
        if (formData.text === elementTextLibrary.find(item => item.id === editingTextId)?.text) {
          setFormData({...formData, text: editingText.trim()});
        }
        
        setEditingTextId(null);
        setEditingText('');
      } catch (error) {
        console.error('更新文字失敗:', error);
        toast.error('更新文字失敗，請重試');
      }
    };

    // 刪除文字從文字庫
    const handleDeleteText = async (textId) => {
      if (window.confirm('確定要刪除這個文字嗎？')) {
        try {
          await apiService.deleteTextLibrary(textId);

          // 更新元素文字庫狀態
          setElementTextLibrary(prev => prev.filter(item => item.id !== textId));
          
          const deletedItem = elementTextLibrary.find(item => item.id === textId);
          if (deletedItem && formData.text === deletedItem.text) {
            setFormData({...formData, text: ''});
          }
        } catch (error) {
          console.error('刪除文字失敗:', error);
          toast.error('刪除文字失敗，請重試');
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                編輯 {element.type === 'dynamicText' ? '動態文字' : '動態圖片'}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {element.type === 'dynamicText' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    選擇文字
                  </label>
                  
                  {/* 文字庫列表 */}
                  <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-lg mb-3">
                    {elementTextLibrary.length === 0 ? (
                      <div className="p-3 text-center text-slate-500">
                        暫無文字，請新增
                      </div>
                    ) : (
                      elementTextLibrary.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                          {editingTextId === item.id ? (
                            // 編輯模式
                            <div className="flex-1 flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="輸入文字內容"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleSaveEditText}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                title="保存編輯"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditText}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"
                                title="取消編輯"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            // 顯示模式
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFormData({...formData, text: item.text});
                                }}
                                className={`flex-1 text-left p-2 rounded ${
                                  formData.text === item.text 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {item.text}
                              </button>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditText(item.id, item.text)}
                                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                                  title="編輯文字"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteText(item.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                  title="刪除文字"
                                >
                                  ✕
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* 新增文字區域 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAddText(!showAddText);
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500"
                    >
                      {showAddText ? '取消新增' : '新增文字'}
                    </button>
                  </div>
                  
                  {showAddText && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="輸入新文字"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddText();
                        }}
                        className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:ring-2 focus:ring-green-500"
                      >
                        新增
                      </button>
                    </div>
                  )}
                </div>
              )}

              {element.type === 'dynamicImage' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    選擇圖片
                  </label>
                  <select
                    value={formData.selectedImageId || ''}
                    onChange={(e) => setFormData({...formData, selectedImageId: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">請選擇圖片庫中的圖片</option>
                    {imageLibrary.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (黑閾值: {item.blackThreshold}, 白閾值: {item.whiteThreshold})
                      </option>
                    ))}
                  </select>
                  {/* 動態圖片不需要預覽 */}
                </div>
              )}

              {/* 動態文字和動態圖片都不需要寬度和高度設置 */}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">動態元素配置</h1>
                <p className="text-sm text-slate-500">快速設置動態文字和動態圖片</p>
              </div>
            </div>
            

          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Device Selector */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">選擇裝置</h2>
            <button
              onClick={loadDevices}
              className="flex items-center space-x-2 px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新載入</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                沒有找到任何裝置
                <div className="mt-2">
                  <button
                    onClick={() => navigate('/devices')}
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    前往裝置管理頁面綁定裝置
                  </button>
                </div>
              </div>
            ) : (
              devices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    setSelectedDevice(device.deviceId);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedDevice === device.deviceId
                      ? 'border-green-500 bg-green-50 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-left">
                    <h3 className="font-medium text-slate-800">{device.deviceName || '未命名裝置'}</h3>
                    <p className="text-sm text-slate-500">ID: {device.deviceId}</p>
                    <p className="text-sm text-slate-500">刷新間隔: {device.refreshInterval || 300}秒</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Template Selector */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">選擇模板</h2>
            <div className="flex items-center space-x-2">
            <button
              onClick={loadTemplates}
              className="flex items-center space-x-2 px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新載入</span>
            </button>
              {selectedTemplate && (
                <button
                  onClick={async () => {
                    // 如果有選中的裝置，設置 needUpdate = true
                    if (selectedDevice) {
                      try {
                        await updateDeviceTemplate(selectedDevice, selectedTemplate);
                        console.log('編輯模板時已設置裝置需要更新');
                      } catch (error) {
                        console.error('設置裝置需要更新失敗:', error);
                      }
                    }
                    navigate(`/template?templateId=${selectedTemplate}`);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  title="編輯當前選中的模板"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>編輯當前模板</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                沒有找到任何模板
              </div>
            ) : (
              templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    // 保存當前選擇的模板ID到 localStorage
                    localStorage.setItem('currentTemplateId', template.id);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-left">
                    <h3 className="font-medium text-slate-800">{template.name || '未命名模板'}</h3>
                    <p className="text-sm text-slate-500">模板</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Elements */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">動態元素</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-500">
                共 {dynamicElements.length} 個元素
              </span>
              
              {/* 生成預覽結果按鈕 */}
              <button
                onClick={renderPreview}
                disabled={isRendering}
                className="flex items-center space-x-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                <span>
                  {isRendering ? '渲染中...' : '生成預覽結果'}
                </span>
              </button>
            
              <button
                onClick={handleSaveLayout}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>保存配置</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-slate-600">載入中...</span>
            </div>
          ) : dynamicElements.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-4">
                <Settings className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-600 mb-2">沒有動態元素</h3>
              <p className="text-slate-500">此模板中沒有動態文字或動態圖片元素</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dynamicElements.map(element => (
                <div key={element.id}>
                  {element.type === 'dynamicText' ? (
                    <DynamicTextCard element={element} />
                  ) : (
                    <DynamicImageCard element={element} imageLibrary={imageLibrary} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Preview Section */}
        {renderedImageUrl && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">預覽渲染結果</h2>
              <span className="text-sm text-slate-500">800×480 像素</span>
            </div>
            
            <div className="flex justify-center w-full">
              <div 
                className="border border-slate-300 rounded-lg overflow-hidden shadow-lg"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '70vh'
                }}
              >
                <img
                  src={renderedImageUrl}
                  alt="門牌預覽"
                  style={{ 
                    width: '800px', 
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    height: 'auto',
                    display: 'block',
                    objectFit: 'contain'
                  }}
                />
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">
                這是使用Python渲染器生成的800×480像素門牌圖片（會根據螢幕大小自動縮放）
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Modal */}
      {editingElement && (
        <ElementEditModal
          element={editingElement}
          onSave={handleElementSave}
          onClose={() => setEditingElement(null)}
        />
      )}
    </div>
  );
}

