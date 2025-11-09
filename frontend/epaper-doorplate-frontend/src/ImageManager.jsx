import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, ImageIcon, Save, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import db from './db'
import { useNavigate } from 'react-router-dom';
import { processAndStoreImage } from './ImageHandler';
import apiService from './services/api';
import { validateImageFile, validateImageUrl, createSafeImageUrl } from './utils/security';
import { useToast } from './components/Toast';

// 圖片上傳數量限制
const MAX_IMAGE_UPLOAD_LIMIT = 20;

const ImageManager = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [blackThreshold, setBlackThreshold] = useState(128);
  const [whiteThreshold, setWhiteThreshold] = useState(128);
  const [contrast, setContrast] = useState(1);
  const [grayscaleImageData, setGrayscaleImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [imageName, setImageName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [expandedImages, setExpandedImages] = useState(new Set());
  const [imageReferences, setImageReferences] = useState({}); // 原始圖片引用（Layout）
  const [imageLibrary, setImageLibrary] = useState([]);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showSaveToLibraryDialog, setShowSaveToLibraryDialog] = useState(false);
  const [libraryItemName, setLibraryItemName] = useState('');
  const [showSaveNameDialog, setShowSaveNameDialog] = useState(false);
  const [isFromLibrary, setIsFromLibrary] = useState(false); // 標記是否從圖片庫加載

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [applyEditFlag, setApplyEditFlag] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const supportsWebP = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  };

  const handleLayoutSelect = async (imageId, layoutRef) => {
    setSelectedLayout({
      imageId: imageId,
      layoutId: layoutRef.layoutId,
      layoutName: layoutRef.layoutName
    });

    const image = images.find(img => img.id === imageId);
    if (image) {
      setSelectedImage(image);
      setIsFromLibrary(false); // 普通圖片，允許調整
      const base64ImageData = await fetchGrayscaleImageData(image.path || image.content, image.id || image.imageUrl);
      if (base64ImageData) {
        loadGrayscaleImageToCanvas(base64ImageData);
      }
    }
  };

  const clearLayoutSelection = () => {
    setSelectedLayout(null);
    setSelectedImage(null);
    setGrayscaleImageData(null);
    setIsFromLibrary(false);
  };

  const fetchImageReferences = async (imagesList = null) => {
    const currentImages = imagesList || images;

    if (currentImages.length === 0) {
      return;
    }

    const actualReferences = {};
    
    for (const image of currentImages) {
      try {
        // 獲取原始圖片的引用（包括普通圖片元素和動態圖片元素的引用）
        const references = await apiService.getImageReferences(image.id);
        actualReferences[image.id] = references;
      } catch (error) {
        console.error(`獲取圖片 ${image.id} 的引用數據失敗:`, error);
        actualReferences[image.id] = [];
      }
    }

    setImageReferences(actualReferences);
  };

  // 獲取動態圖片庫項目的引用（僅在需要時調用，例如刪除時檢查）
  const fetchImageLibraryItemReferences = async (itemId) => {
    try {
      const references = await apiService.getImageLibraryItemReferences(itemId);
      return references;
    } catch (error) {
      console.error(`❌ 獲取動態圖片庫項目 ${itemId} 的引用數據失敗:`, error);
      return [];
    }
  };

  const toggleImageExpanded = (imageId) => {
    const newExpanded = new Set(expandedImages);
    if (newExpanded.has(imageId)) {
      newExpanded.delete(imageId);
    } else {
      newExpanded.add(imageId);
    }
    setExpandedImages(newExpanded);
  };

  const convertToGrayscale = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 480;
        
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        // 檢查是否需要等比例縮放
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

        // 然後繪製原圖片（縮放到目標尺寸）
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imageData, 0, 0);

        const outputFormat = supportsWebP() ? 'image/webp' : 'image/png';
        const quality = supportsWebP() ? 0.8 : undefined;

        canvas.toBlob((blob) => {
          if (blob) {
            const extension = supportsWebP() ? 'webp' : 'png';
            const grayscaleFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}_gray.${extension}`, {
              type: outputFormat
            });
            resolve(grayscaleFile);
          } else {
            resolve(file);
          }
        }, outputFormat, quality);

        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const fetchImages = async () => {
    setLoading(true);
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const imageList = await apiService.getImages(currentUserId);
      setImages(imageList);

      await fetchImageReferences(imageList);
    } catch (error) {
      console.error('獲取圖片失敗:', error);
    }
    setLoading(false);
  };

  const fetchGrayscaleImageData = async (imageUrl, imageId) => {
    try {
      console.log(`🖼️ 開始載入圖片: ${imageUrl}, imageId: ${imageId}`);
      const blob = await apiService.getImageData(imageUrl);
      console.log(`✅ 獲取到圖片 blob:`, { type: blob?.type, size: blob?.size });
      
      if (!blob || !blob.type || blob.size === 0) {
        throw new Error('圖片資料無效（空或未知格式）');
      }

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          console.log(`✅ 圖片轉換為 base64 成功`);
          resolve(reader.result);
        };
        reader.onerror = () => {
          console.error('❌ FileReader 失敗');
          reject(new Error('FileReader failed'));
        };
        reader.readAsDataURL(blob);
      });

      return base64;
    } catch (error) {
      console.error('❌ 獲取圖片數據失敗:', error);
      console.error('   圖片 URL:', imageUrl);
      console.error('   圖片 ID:', imageId);
      throw new Error(`圖片載入失敗: ${error.message}`);
    }
  };

  const handleImageSelect = async (image) => {
      console.log('🖼️ 選擇圖片:', { id: image.id, name: image.name, path: image.path, content: image.content });
      setSelectedImage(image);
      setIsFromLibrary(false); // 普通圖片，允許調整
      try {
        const imageUrl = image.path || image.content;
        console.log('   使用圖片 URL:', imageUrl);
        if (!imageUrl) {
          throw new Error('圖片路徑為空，無法載入');
        }
        const base64ImageData = await fetchGrayscaleImageData(imageUrl, image.id || image.imageUrl);
        if (base64ImageData) {
          console.log('✅ 圖片數據載入成功，開始載入到 Canvas');
          loadGrayscaleImageToCanvas(base64ImageData);
        }
      } catch (error) {
        console.error('❌ 圖片載入失敗:', error);
        console.error('   圖片對象:', image);
        toast.error(`圖片載入失敗: ${error.message}`);
      }
  };

  // 圖片庫相關函數
  const fetchImageLibrary = async () => {
    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        toast.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const library = await apiService.getImageLibrary(currentUserId);
      if (Array.isArray(library)) {
        setImageLibrary(library);
        // 不再需要獲取動態圖片庫項目的引用（因為我們只顯示原始圖片被哪些動態圖片庫項目使用）
      } else {
        console.error('圖片庫數據格式錯誤:', library);
        toast.error('圖片庫數據格式錯誤');
        setImageLibrary([]);
      }
    } catch (error) {
      console.error('圖片庫載入錯誤:', error);
      toast.error(`圖片庫載入失敗: ${error.message || '未知錯誤'}`);
      setImageLibrary([]);
    }
  };

  const saveToImageLibrary = async () => {
    if (!selectedImage || !libraryItemName.trim()) {
      toast.warning('請選擇圖片並輸入名稱');
      return;
    }

    try {
      const libraryItem = {
        name: libraryItemName.trim(),
        originalImageId: selectedImage.id,
        originalImagePath: selectedImage.path || selectedImage.content,
        blackThreshold: blackThreshold,
        whiteThreshold: whiteThreshold,
        contrast: contrast,
        format: supportsWebP() ? 'webp' : 'png',
        description: `處理參數: 黑閾值=${blackThreshold}, 白閾值=${whiteThreshold}, 對比度=${contrast}`,
        text: '文字標籤',
        color: 'black',
        fontSize: 16,
        letterSpacing: 0
      };

      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      await apiService.saveImageLibrary(libraryItem, currentUserId);
      toast.success('已保存為動態圖片設定！');
      setShowSaveToLibraryDialog(false);
      setLibraryItemName('');
      fetchImageLibrary();
    } catch (error) {
      console.error('保存動態圖片設定失敗:', error);
      toast.error('保存失敗，請重試');
    }
  };

  const deleteFromImageLibrary = async (itemId) => {
    // 檢查動態圖片庫項目是否被 Layout 使用
    const libraryRefs = await fetchImageLibraryItemReferences(itemId);
    if (libraryRefs.length > 0) {
      const layoutNames = libraryRefs.map(ref => ref.layoutName).join(', ');
      toast.warning(`無法刪除動態圖片設定，該設定正被以下佈局使用：${layoutNames}`);
      return;
    }

    if (!window.confirm('確定要刪除此動態圖片設定嗎？')) {
      return;
    }

    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      await apiService.deleteImageLibrary(itemId, currentUserId);
      toast.success('已刪除動態圖片設定！');
      fetchImageLibrary();
    } catch (error) {
      console.error('刪除動態圖片設定失敗:', error);
      toast.error('刪除失敗，請重試');
    }
  };

  const loadImageFromLibrary = async (libraryItem) => {
    try {
      if (!libraryItem) {
        toast.error('動態圖片設定數據無效');
        return;
      }

      // 檢查必要的參數
      if (!libraryItem.originalImagePath) {
        toast.error('動態圖片設定缺少原始圖片路徑');
        return;
      }

      // 嘗試找到對應的原始圖片
      let originalImage = null;
      if (libraryItem.originalImageId) {
        originalImage = images.find(img => img.id === libraryItem.originalImageId);
      }

      // 如果找不到對應的圖片，嘗試使用路徑匹配
      if (!originalImage && libraryItem.originalImagePath) {
        originalImage = images.find(img => 
          img.path === libraryItem.originalImagePath || 
          img.content === libraryItem.originalImagePath
        );
      }

      // 設置選中的圖片（如果找到）
      if (originalImage) {
        setSelectedImage(originalImage);
      }

      // 設置參數（先設置，確保後續使用正確的值）
      const savedBlackThreshold = libraryItem.blackThreshold || 128;
      const savedWhiteThreshold = libraryItem.whiteThreshold || 128;
      const savedContrast = libraryItem.contrast || 1;
      
      setBlackThreshold(savedBlackThreshold);
      setWhiteThreshold(savedWhiteThreshold);
      setContrast(savedContrast);
      
      // 先載入原始圖片到 canvas，保存原始數據（用於滑塊調整）
      // 然後再顯示處理後的圖片
      const targetWidth = libraryItem.width || null;
      const targetHeight = libraryItem.height || null;
      
      // 1. 先載入原始圖片，保存原始數據到 grayscaleImageData
      const originalImageUrl = createSafeImageUrl(libraryItem.originalImagePath, apiService.legacyBaseURL);
      if (!originalImageUrl) {
        throw new Error('不安全的圖片路徑，已拒絕加載');
      }
      
      const originalBlob = await apiService.getImageData(originalImageUrl);
      const originalObjectUrl = URL.createObjectURL(originalBlob);
      
      const originalImg = new window.Image();
      originalImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        originalImg.onload = () => {
          try {
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 480;
            
            let finalWidth = targetWidth || originalImg.width;
            let finalHeight = targetHeight || originalImg.height;
            
            if (!targetWidth && !targetHeight) {
              if (originalImg.width > MAX_WIDTH || originalImg.height > MAX_HEIGHT) {
                const widthRatio = MAX_WIDTH / originalImg.width;
                const heightRatio = MAX_HEIGHT / originalImg.height;
                const scale = Math.min(widthRatio, heightRatio);
                finalWidth = Math.floor(originalImg.width * scale);
                finalHeight = Math.floor(originalImg.height * scale);
              }
            }
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = finalWidth;
            tempCanvas.height = finalHeight;
            
            // 填充白色背景
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 繪製原始圖片
            tempCtx.drawImage(originalImg, 0, 0, finalWidth, finalHeight);
            const originalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 保存原始圖片數據（用於滑塊調整）
            setGrayscaleImageData(originalImageData.data);
            
            URL.revokeObjectURL(originalObjectUrl);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        
        originalImg.onerror = () => reject(new Error('原始圖片載入失敗'));
        originalImg.src = originalObjectUrl;
      });
      
      // 2. 根據圖片庫項目的參數處理圖片並顯示
      const processedImageUrl = await processImageWithParams(
        libraryItem.originalImagePath,
        savedBlackThreshold,
        savedWhiteThreshold,
        savedContrast
      );
      
      // 3. 載入已處理的圖片到畫布顯示（skipProcessing = true，因為已經處理過）
      // 注意：grayscaleImageData 已經保存為原始數據，用於滑塊調整
      loadGrayscaleImageToCanvas(processedImageUrl, targetWidth, targetHeight, savedBlackThreshold, savedWhiteThreshold, savedContrast, true);
      
      // 標記為從圖片庫加載，禁止滑塊調整
      setIsFromLibrary(true);
      
      toast.success(`已載入動態圖片設定: ${libraryItem.name}`);
    } catch (error) {
      console.error('載入圖片庫項目失敗:', error);
      toast.error(`載入失敗: ${error.message || '未知錯誤'}`);
    }
  };

  // 根據參數重新處理圖片
  const processImageWithParams = async (imagePath, blackThreshold, whiteThreshold, contrast) => {
    try {
      const imageUrl = createSafeImageUrl(imagePath, apiService.legacyBaseURL);
      if (!imageUrl) {
        throw new Error('不安全的圖片路徑，已拒絕加載');
      }
      
      // 改為統一走 apiService.getImageData（內含多層回退策略，避免 403）
      const blob = await apiService.getImageData(imageUrl);
      const objectUrl = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 480;
            
            let targetWidth = img.width;
            let targetHeight = img.height;
            
            // 檢查是否需要等比例縮放
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
            let whiteCount = 0;
            let redCount = 0;
            let blackCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
              // 1. 計算灰階值
              let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              
              // 2. 應用 gamma 對比度調整（與 TemplateEditor 和 Python 腳本一致）
              if (contrast !== 1) {
                gray = 255 * Math.pow(gray / 255, 1 / contrast);
                gray = Math.max(0, Math.min(255, gray));
              }
              
              // 3. 應用三色閾值映射（與 TemplateEditor 和 Python 腳本一致）
              if (gray < blackThreshold) {
                data[i] = 0;       // R
                data[i + 1] = 0;   // G
                data[i + 2] = 0;   // B
                blackCount++;
              } else if (gray > whiteThreshold) {
                data[i] = 255;     // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
                whiteCount++;
              } else {
                data[i] = 255;     // R
                data[i + 1] = 0;   // G
                data[i + 2] = 0;   // B
                redCount++;
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

  const loadGrayscaleImageToCanvas = (base64ImageSrc, targetWidth = null, targetHeight = null, customBlackThreshold = null, customWhiteThreshold = null, customContrast = null, skipProcessing = false) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 480;
        
        let finalWidth = targetWidth || img.width;
        let finalHeight = targetHeight || img.height;
        
        // 如果沒有指定目標尺寸，檢查是否需要等比例縮放
        if (!targetWidth && !targetHeight) {
          if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
            const widthRatio = MAX_WIDTH / img.width;
            const heightRatio = MAX_HEIGHT / img.height;
            const scale = Math.min(widthRatio, heightRatio);
            finalWidth = Math.floor(img.width * scale);
            finalHeight = Math.floor(img.height * scale);
          }
        }

        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('Canvas ref 不存在');
          return;
        }
        
        const ctx = canvas.getContext('2d');
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        // 繪製圖片到目標尺寸
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        setGrayscaleImageData(imageData.data);
        
        // 如果圖片已經處理過（skipProcessing = true），直接顯示，不再次應用參數
        // 否則，使用傳入的自定義參數或當前的 state 值
        if (!skipProcessing) {
          const blackThresh = customBlackThreshold !== null ? customBlackThreshold : blackThreshold;
          const whiteThresh = customWhiteThreshold !== null ? customWhiteThreshold : whiteThreshold;
          const contrastVal = customContrast !== null ? customContrast : contrast;
          applyContrastAndThreshold(imageData.data, canvas.width, canvas.height, false, blackThresh, whiteThresh, contrastVal);
        }
        // 如果 skipProcessing = true，圖片已經處理過，直接顯示即可
      } catch (error) {
        console.error('Canvas 處理失敗:', error);
        toast.error(`圖片處理失敗: ${error.message}`);
      }
    };
    
    img.onerror = (error) => {
      console.error('圖片載入到 Canvas 失敗:', error);
      toast.error('圖片載入到 Canvas 失敗');
    };
    
    img.src = base64ImageSrc;
  };

const applyContrastAndThreshold = (
  grayscaleData, 
  width, 
  height, 
  enableClahe = false, 
  customBlackThreshold = blackThreshold, 
  customWhiteThreshold = whiteThreshold, 
  customContrast = contrast
) => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  let localAvg = [];
  if (enableClahe) {
    const blockSize = 8;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -blockSize; dy <= blockSize; dy++) {
          for (let dx = -blockSize; dx <= blockSize; dx++) {
            let nx = x + dx;
            let ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              sum += grayscaleData[idx];
              count++;
            }
          }
        }
        localAvg.push(sum / count);
      }
    }
  }

  for (let i = 0; i < grayscaleData.length; i += 4) {
    // 1. 從 RGB 計算灰階值（與 processImageWithParams 一致）
    let gray = 0.299 * grayscaleData[i] + 0.587 * grayscaleData[i + 1] + 0.114 * grayscaleData[i + 2];

    if (enableClahe) {
      const index = i / 4;
      const mean = localAvg[index];
      gray = Math.max(0, Math.min(255, gray - mean + 128));
    }

    // 2. 應用 gamma 對比度調整（與 processImageWithParams 一致）
    let adjusted = 255 * Math.pow(gray / 255, 1 / customContrast);
    adjusted = Math.min(255, Math.max(0, adjusted));

    // 3. 應用三色閾值映射（與 processImageWithParams 一致）
    if (adjusted < customBlackThreshold) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
    } else if (adjusted > customWhiteThreshold) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    } else {
      data[i] = 255; data[i + 1] = 0; data[i + 2] = 0;
    }

    data[i + 3] = grayscaleData[i + 3];
  }

  ctx.putImageData(imageData, 0, 0);
};


  const handleThresholdChange = (newThreshold) => {
    if (newThreshold <= whiteThreshold) {
      setBlackThreshold(newThreshold);
    }
    // 無論是否更新狀態，都要重新渲染，使用滑桿的實際值
    if (grayscaleImageData && canvasRef.current) {
      const canvas = canvasRef.current;
      applyContrastAndThreshold(grayscaleImageData, canvas.width, canvas.height, false, newThreshold, whiteThreshold, contrast);
    }
  };

  const handleRedThresholdChange = (newThreshold) => {
    if (newThreshold >= blackThreshold) {
      setWhiteThreshold(newThreshold);
    }
    // 無論是否更新狀態，都要重新渲染，使用滑桿的實際值
    if (grayscaleImageData && canvasRef.current) {
      const canvas = canvasRef.current;
      applyContrastAndThreshold(grayscaleImageData, canvas.width, canvas.height, false, blackThreshold, newThreshold, contrast);
    }
  };

  const handleContrastChange = (newContrast) => {
    setContrast(newContrast);
    if (grayscaleImageData && canvasRef.current) {
      const canvas = canvasRef.current;
      applyContrastAndThreshold(grayscaleImageData, canvas.width, canvas.height);
    }
  };

  const canvasToWebP = (canvas, quality = 0.8) => {
    if (supportsWebP()) {
      return canvas.toDataURL('image/webp', quality);
    } else {
      return canvas.toDataURL('image/png');
    }
  };





  const saveToDB = async (name) => {
    if (!canvasRef.current && name) return false;

    let elements = await db.loadJSON('elementsData') || [];
    const base64 = canvasToWebP(canvasRef.current);

    let fromEditing = null;
    if (applyEditFlag) {
      const saved = await db.loadJSON('editingImage');

      if (saved && typeof saved === 'object') {

        fromEditing = saved;

        // 確保 elements 是陣列
        if (!Array.isArray(elements)) elements = [];

        if (fromEditing.id) {
          elements = elements.filter(e => e.id !== fromEditing.id);
        }

        await db.clearJSON('editingImage');
      }
    }



    // 獲取下一個可用的 zIndex
    const getNextZIndex = (elementType = 'image') => {
      if (elements.length === 0) {
        // 文字元素從 1000 開始，圖片元素從 1 開始
        return elementType === 'label' || elementType === 'dynamicText' ? 1000 : 1;
      }
      
      if (elementType === 'label' || elementType === 'dynamicText') {
        // 文字元素：在圖片之上，從 1000 開始
        const textElements = elements.filter(elem => elem.type === 'label' || elem.type === 'dynamicText');
        if (textElements.length === 0) return 1000;
        const maxTextZIndex = Math.max(...textElements.map(elem => elem.zIndex || 1000));
        return maxTextZIndex + 1;
      } else {
        // 圖片元素：在文字之下，從 1 開始
        const imageElements = elements.filter(elem => elem.type === 'image' || elem.type === 'dynamicImage');
        if (imageElements.length === 0) return 1;
        const maxImageZIndex = Math.max(...imageElements.map(elem => elem.zIndex || 1));
        return maxImageZIndex + 1;
      }
    };

    // 4️⃣ 建立新的 image element
    const newImageElement = {
      id: fromEditing?.id || `elem-${Date.now()}`,
      type: fromEditing?.type || 'image', // 保留原始類型，如果沒有則預設為 'image'
      name: fromEditing ? fromEditing.name : (name || selectedImage?.name || '圖片'),
      x: fromEditing?.x ?? 10,
      y: fromEditing?.y ?? 10,
      width: fromEditing?.width ?? 200,
      height: fromEditing?.height ?? 150,
      imageUrl: base64,
      format: supportsWebP() ? 'webp' : 'png',
      blackThreshold,
      whiteThreshold,
      contrast,
      content: selectedImage?.path || selectedImage?.content,
      imageId: selectedImage?.id || '',
      zIndex: fromEditing?.zIndex || getNextZIndex(fromEditing?.type || 'image'),
      // 添加文字標籤屬性
      text: '文字標籤', // 預設文字
      color: 'black', // 預設顏色
      fontSize: 16, // 預設字體大小
      letterSpacing: 0 // 預設字間距
    }

    elements.push(newImageElement);

    // 重新排序確保陣列順序與 zIndex 順序一致
    const sortedElements = elements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

    // 5️⃣ 存入 IndexedDB
    try {
      await db.saveJSON(sortedElements, 'elementsData');
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        toast.error('儲存空間不足，請清理一些數據或使用較低的圖片品質');
      }
      return false;
    }
  }




  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 檢查圖片數量限制
    if (images.length >= MAX_IMAGE_UPLOAD_LIMIT) {
      toast.warning(`圖片上傳數量已達上限（最多 ${MAX_IMAGE_UPLOAD_LIMIT} 張），請先刪除一些圖片再上傳`);
      e.target.value = ''; // 清空文件選擇
      return;
    }

    // 使用安全驗證函數
    if (!validateImageFile(file)) {
      toast.warning('請選擇有效的圖片檔案（支持 JPG、PNG、GIF、WebP，大小限制 10MB）');
      e.target.value = ''; // 清空文件選擇
      return;
    }

    setPendingFile(file);
    setImageName(file.name.replace(/\.[^/.]+$/, ""));
    setShowNameDialog(true);
  };

  const confirmUpload = async () => {
    if (!pendingFile || !imageName.trim()) return;

    setLoading(true);

    try {
      const grayscaleFile = await convertToGrayscale(pendingFile);

      const formData = new FormData();
      formData.append('file', grayscaleFile);

      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      const newImage = await apiService.uploadImage(formData, currentUserId);
      const imageWithGrayscale = {
        ...newImage,
        isGrayscale: true,
        fileSize: Math.round(grayscaleFile.size / 1024)
      };

      const updatedImages = [...images, imageWithGrayscale];
      setImages(updatedImages);
      setSelectedImage(imageWithGrayscale);

      const reader = new FileReader();
      reader.onload = (ev) => loadGrayscaleImageToCanvas(ev.target.result);
      reader.readAsDataURL(grayscaleFile);

      setShowNameDialog(false);
      setPendingFile(null);
      setImageName('');

      await fetchImageReferences(updatedImages);
    } catch (error) {
      console.error('上傳失敗:', error);
      toast.error('上傳失敗，請檢查網路連線');
    } finally {
      setLoading(false);
    }
  };

  const cancelUpload = () => {
    setShowNameDialog(false);
    setPendingFile(null);
    setImageName('');
  };

  const handleDeleteImage = async (imageId) => {
    // 獲取原始圖片的直接引用（Layout）
    const imageRefs = imageReferences[imageId] || [];
    
    // 獲取所有使用該圖片作為原始圖片的動態圖片庫項目
    const libraryItemsUsingThisImage = imageLibrary.filter(item => item.originalImageId === imageId);
    
    // 檢查是否有直接引用或動態圖片庫項目引用
    if (imageRefs.length > 0 || libraryItemsUsingThisImage.length > 0) {
      const messages = [];
      if (imageRefs.length > 0) {
        const layoutNames = imageRefs.map(ref => ref.layoutName).join(', ');
        messages.push(`佈局：${layoutNames}`);
      }
      if (libraryItemsUsingThisImage.length > 0) {
        const itemNames = libraryItemsUsingThisImage.map(item => item.name).join(', ');
        messages.push(`動態圖片庫項目：${itemNames}`);
      }
      toast.warning(`無法刪除圖片，該圖片正被以下項目使用：${messages.join('；')}`);
      return;
    }

    setDeleteImageId(imageId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteImageId) return;

    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        toast.error('無法獲取當前用戶ID，請重新登錄');
        setShowDeleteDialog(false);
        setDeleteImageId(null);
        return;
      }

      await apiService.deleteImage(deleteImageId, currentUserId);
      const updatedImages = images.filter(img => img.id !== deleteImageId);
      setImages(updatedImages);

      if (selectedImage?.id === deleteImageId) {
        setSelectedImage(null);
        setGrayscaleImageData(null);
      }

      await fetchImageReferences(updatedImages);
      toast.success('圖片已刪除');
    } catch (error) {
      console.error('刪除失敗:', error);
      toast.error('刪除失敗，請檢查網路連線');
    }

    setShowDeleteDialog(false);
    setDeleteImageId(null);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteImageId(null);
  };

  const clearSelection = () => {
    setSelectedImage(null);
    setGrayscaleImageData(null);
    setIsFromLibrary(false);
  };

  const handleSaveAndReturn = () => {
    if (!selectedImage) return;
    setShowSaveNameDialog(true);
  };

  const confirmSaveAndReturn = async () => {
    const success = await saveToDB();

    if (success) {
      setShowSaveNameDialog(false);
      setTimeout(() => {
        navigate('/template');
      }, 0);
    }
  };

  const cancelSaveAndReturn = () => {
    setShowSaveNameDialog(false);
  };

  useEffect(() => {
    fetchImages();
    fetchImageLibrary();
  }, []);

const hasLoadedEditingRef = useRef(false);

useEffect(() => {
    if (hasLoadedEditingRef.current) return;
    hasLoadedEditingRef.current = true;
    const loadEditingImage = async () => {
      const saved = await db.loadJSON('editingImage');
      if (!saved || (Array.isArray(saved) && saved.length === 0)) {
        return;
      }

    // 設定 state
    setBlackThreshold(saved.blackThreshold ?? 128);
    setWhiteThreshold(saved.whiteThreshold ?? 128);
    setContrast(saved.contrast ?? 1);
    setApplyEditFlag(true);

    // 如果有imageId，找到對應的圖片並選擇
    if (saved.imageId) {
      // 等待圖片列表載入完成
      const checkForImage = () => {
        const targetImage = images.find(img => img.id === saved.imageId);
        if (targetImage) {
          setSelectedImage(targetImage);
          // 載入圖片到canvas
          fetchGrayscaleImageData(targetImage.path || targetImage.content, targetImage.id || targetImage.imageUrl)
            .then(base64ImageData => {
              if (base64ImageData) {
                // 使用編輯中的尺寸信息
                const targetWidth = saved.width || null;
                const targetHeight = saved.height || null;
                loadGrayscaleImageToCanvas(base64ImageData, targetWidth, targetHeight);
                // 延遲應用參數
                setTimeout(() => {
                  if (canvasRef.current && grayscaleImageData) {
                    applyContrastAndThreshold(
                      grayscaleImageData,
                      canvasRef.current.width,
                      canvasRef.current.height,
                      false,
                      saved.blackThreshold ?? 128,
                      saved.whiteThreshold ?? 128,
                      saved.contrast ?? 1
                    );
                  }
                }, 100);
              }
            });
        } else {
          // 如果圖片還沒載入，等待一下再試
          setTimeout(checkForImage, 100);
        }
      };
      checkForImage();
    }
  };

  loadEditingImage();
}, [images]); // 依賴images，確保圖片列表載入後再執行


  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {showNameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">為圖片命名</h3>
            <div className="mb-4">
              <input
                type="text"
                value={imageName}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 20);
                  setImageName(value);
                }}
                placeholder="輸入圖片名稱（最多20字）"
                className="w-full p-2 border border-gray-300 rounded"
                maxLength={20}
                autoFocus
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {imageName.length >= 20 && (
                    <span className="text-red-500">已達最大字數限制</span>
                  )}
                </span>
                <span className={`text-xs ${imageName.length >= 20 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {imageName.length}/20
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelUpload}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
                disabled={loading}
              >
                取消
              </button>
              <button
                onClick={confirmUpload}
                disabled={!imageName.trim() || loading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '上傳中...' : '確認上傳'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveNameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">確認加入</h3>
            <p className="text-gray-600 mb-4">確定要將此圖片加到Canvas並返回模板編輯器嗎？</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelSaveAndReturn}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
              >
                取消
              </button>
              <button
                onClick={confirmSaveAndReturn}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
              >
                確認加入
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">確認刪除</h3>
            <p className="text-gray-600 mb-4">確定要刪除此圖片嗎？此操作無法復原。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存為動態圖片設定對話框 */}
      {showSaveToLibraryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">保存為動態圖片設定</h3>
            <p className="text-gray-600 mb-4">為此處理後的圖片命名並保存為動態圖片設定，供動態圖片元素使用</p>
            <div className="mb-4">
              <input
                type="text"
                value={libraryItemName}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 20);
                  setLibraryItemName(value);
                }}
                placeholder="輸入設定名稱（最多20字）"
                className="w-full p-2 border border-gray-300 rounded"
                maxLength={20}
                autoFocus
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {libraryItemName.length >= 20 && (
                    <span className="text-red-500">已達最大字數限制</span>
                  )}
                </span>
                <span className={`text-xs ${libraryItemName.length >= 20 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {libraryItemName.length}/20
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowSaveToLibraryDialog(false);
                  setLibraryItemName('');
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
              >
                取消
              </button>
              <button
                onClick={saveToImageLibrary}
                disabled={!libraryItemName.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存設定
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-64 bg-white shadow-xl border-r border-slate-200 p-6 overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-800 border-b border-slate-200 pb-2">圖片管理</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                上傳新圖片：
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || images.length >= MAX_IMAGE_UPLOAD_LIMIT}
                className="flex items-center justify-center w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={images.length >= MAX_IMAGE_UPLOAD_LIMIT ? `圖片數量已達上限（${MAX_IMAGE_UPLOAD_LIMIT} 張），請先刪除一些圖片` : '上傳新圖片'}
              >
                <Upload size={16} className="mr-2" />
                {loading ? '處理中...' : images.length >= MAX_IMAGE_UPLOAD_LIMIT ? `已達上限 (${MAX_IMAGE_UPLOAD_LIMIT})` : '上傳新圖片'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                動態圖片設定：
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setShowImageLibrary(!showImageLibrary)}
                  className="flex items-center justify-center w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 text-sm font-medium shadow-sm transition-colors"
                >
                  <ImageIcon size={16} className="mr-2" />
                  {showImageLibrary ? '隱藏設定庫' : '顯示設定庫'}
                </button>
                {selectedImage && (
                  <button
                    onClick={() => setShowSaveToLibraryDialog(true)}
                    className="flex items-center justify-center w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 text-sm font-medium shadow-sm transition-colors"
                  >
                    <Save size={16} className="mr-2" />
                    保存為動態圖片設定
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 flex-1">
              圖片庫 ({images.length}/{MAX_IMAGE_UPLOAD_LIMIT})
            </h2>
            {images.length >= MAX_IMAGE_UPLOAD_LIMIT && (
              <span className="text-sm text-red-600 font-medium ml-2">
                已達上限
              </span>
            )}
          </div>
        </div>

        {/* 動態圖片設定庫顯示區域 */}
        {showImageLibrary && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-slate-700">已保存的動態圖片設定</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {imageLibrary.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">尚未保存任何設定</div>
              ) : (
                imageLibrary.map(item => (
                  <div key={item.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                       onClick={() => loadImageFromLibrary(item)}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-800 truncate">{item.name}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFromImageLibrary(item.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="刪除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-slate-600">
                      <div>黑閾值: {item.blackThreshold}</div>
                      <div>白閾值: {item.whiteThreshold}</div>
                      <div>對比度: {item.contrast}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
          {loading && images.length === 0 ? (
            <div className="text-center py-4 text-blue-600 text-sm">載入圖片中...</div>
          ) : images.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">沒有可用的圖片</div>
          ) : (
            images.map(image => {
              // 獲取原始圖片的直接引用（Layout中直接使用該圖片）
              const imageRefs = imageReferences[image.id] || [];
              
              // 獲取所有使用該圖片作為原始圖片的動態圖片庫項目
              const libraryItemsUsingThisImage = imageLibrary.filter(item => item.originalImageId === image.id);
              
              // 合併所有引用：直接引用（Layout）和動態圖片庫項目引用
              const allReferences = [...imageRefs, ...libraryItemsUsingThisImage.map(item => ({
                type: 'libraryItem',
                libraryItemId: item.id,
                libraryItemName: item.name
              }))];
              
              const isExpanded = expandedImages.has(image.id);
              const hasReferences = allReferences.length > 0;
              const hasImageRefs = imageRefs.length > 0;
              const hasLibraryItems = libraryItemsUsingThisImage.length > 0;

              return (
                <div key={image.id} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center p-3 hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => {
                        if (hasReferences) {
                          toggleImageExpanded(image.id);
                        }
                      }}
                      className={`mr-2 p-1 ${hasReferences ? 'text-slate-600 hover:text-slate-800 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`}
                      disabled={!hasReferences}
                    >
                      {hasReferences ? (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                      ) : (
                        <div className="w-3.5 h-3.5"></div>
                      )}
                    </button>


                    {/* 圖片信息 */}
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => {
                        // 只有在沒有展開的情況下才能選擇圖片
                        if (!expandedImages.has(image.id)) {
                          handleImageSelect(image);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 truncate">{image.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(image.id);
                          }}
                          className={`text-red-500 hover:text-red-700 ml-2 p-1 rounded hover:bg-red-50 transition-colors ${hasReferences ? 'opacity-50' : ''
                            }`}
                          title={hasReferences ? "圖片正在被使用，無法刪除" : "刪除圖片"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                        <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-500">
                          {(() => {
                            const date = new Date(image.uploadTime);
                            date.setHours(date.getHours() + 8); // 加8小时（UTC+8时区）
                            return date.toLocaleDateString();
                          })()}
                        </span>
                        <div className="flex items-center gap-1">
                          {hasImageRefs && (
                            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full" title="直接引用">
                              直接引用({imageRefs.length})
                            </span>
                          )}
                          {hasLibraryItems && (
                            <span 
                              className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full" 
                              title="被動態圖片庫項目使用"
                            >
                              動態圖片項目({libraryItemsUsingThisImage.length})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 第二層：引用信息 */}
                  {isExpanded && hasReferences && (
                    <div className="border-t border-slate-100 bg-slate-50">
                      {/* 直接引用（Layout） */}
                      {hasImageRefs && (
                        <>
                          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                            <span className="text-xs font-semibold text-blue-700">直接引用 ({imageRefs.length})</span>
                          </div>
                          {imageRefs.map((ref, index) => {
                            return (
                              <div
                                key={`${image.id}-img-ref-${index}`}
                                className="flex items-center pl-8 pr-3 py-3 text-sm cursor-pointer transition-colors text-slate-600 hover:bg-blue-50"
                                onClick={() => handleLayoutSelect(image.id, ref)}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Layout:</span>
                                    <span className="font-semibold text-slate-700">
                                      {ref.layoutName}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                      
                      {/* 動態圖片庫項目引用 */}
                      {hasLibraryItems && (
                        <>
                          <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                            <span className="text-xs font-semibold text-purple-700">動態圖片庫項目 ({libraryItemsUsingThisImage.length})</span>
                          </div>
                          {libraryItemsUsingThisImage.map((item, index) => {
                            return (
                              <div
                                key={`${image.id}-lib-item-${index}`}
                                className="flex items-center pl-8 pr-3 py-3 text-sm text-slate-600"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">項目名稱:</span>
                                    <span className="font-semibold text-slate-700">
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    黑閾值: {item.blackThreshold}, 白閾值: {item.whiteThreshold}, 對比度: {item.contrast}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>


        {selectedImage && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 text-slate-800 border-b border-slate-200 pb-2">
              閾值調整
              {isFromLibrary && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  (已從動態圖片設定加載，參數已鎖定)
                </span>
              )}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  黑閾值: {blackThreshold}
                </label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={blackThreshold}
                  disabled={isFromLibrary}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    if (newValue <= whiteThreshold) {
                      handleThresholdChange(newValue);
                    }
                  }}
                  className={`w-full h-2 bg-slate-200 rounded-lg appearance-none ${
                    isFromLibrary 
                      ? 'cursor-not-allowed opacity-50' 
                      : 'cursor-pointer'
                  }`}
                  style={{
                    background: `linear-gradient(to right, #000000 0%, #ef4444 ${(blackThreshold / 255) * 100}%, #ffffff ${(blackThreshold / 255) * 100}%, #ffffff 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>255</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  白閾值: {whiteThreshold}
                </label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={whiteThreshold}
                  disabled={isFromLibrary}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    if (newValue >= blackThreshold) {
                      handleRedThresholdChange(newValue);
                    }
                  }}
                  className={`w-full h-2 bg-slate-200 rounded-lg appearance-none ${
                    isFromLibrary 
                      ? 'cursor-not-allowed opacity-50' 
                      : 'cursor-pointer'
                  }`}
                  style={{
                    background: `linear-gradient(to right, #000000 0%, #ef4444 ${(whiteThreshold / 255) * 100}%, #ffffff ${(whiteThreshold / 255) * 100}%, #ffffff 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>255</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  對比度: {contrast.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.01}
                  value={contrast}
                  disabled={isFromLibrary}
                  onChange={(e) => handleContrastChange(Number(e.target.value))}
                  className={`w-full h-2 bg-slate-200 rounded-lg appearance-none ${
                    isFromLibrary 
                      ? 'cursor-not-allowed opacity-50' 
                      : 'cursor-pointer'
                  }`}
                />
              </div>

              <button
                onClick={clearSelection}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                清除選擇
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main canvas area */}
      <main className="flex-grow flex justify-center items-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 relative">
        {selectedImage ? (
          <>
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
            <div className="absolute top-6 right-6 flex gap-3">
              <button
                onClick={handleSaveAndReturn}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <Save size={16} />
                加到Canvas
              </button>
            </div>
          </>
        ) : (
          <div className="text-slate-400 text-center select-none">
            <div className="text-lg font-medium mb-2">選擇圖片開始編輯</div>
            <div className="text-sm">從左側圖片庫中選擇圖片或上傳新圖片</div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ImageManager;