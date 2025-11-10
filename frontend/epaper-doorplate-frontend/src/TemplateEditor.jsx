import { useState, useEffect, useRef, useCallback } from 'react';
import { MinusCircle, PlusCircle, Upload, FileText, Edit3, Trash2 } from 'lucide-react';
import { handleLayoutSubmit } from './handleRequest/handleLayoutSubmit'
import { handleLayoutDelete } from './handleRequest/handleLayoutDelete'
import { useNavigate, useSearchParams } from 'react-router-dom';
import db from './db'
import apiService from './services/api'
import { useToast } from './components/Toast';
// 畫布元素數量限制
const MAX_CANVAS_ELEMENTS = 30;
// 佈局數量限制
const MAX_LAYOUT_COUNT = 20;

const elementTypes = [
  { id: 'dynamicText', name: '動態文字' },
  { id: 'dynamicImage', name: '動態圖片' },
  { id: "image", name: "圖片" },
  { id: "label", name: "文字標籤" },
  { id: "guestQRCode", name: "訪客 QR Code" },
];

export default function CanvasEditor() {
  const toast = useToast();
  const [elements, setElements] = useState([]);
  const [activeElement, setActiveElement] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [configOptions, setConfigOptions] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // New state for tracking current layout name and ID
  const [currentLayoutName, setCurrentLayoutName] = useState('');
  const [currentLayoutId, setCurrentLayoutId] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportLayoutName, setExportLayoutName] = useState('');

  // Delete confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  const [showLabelEditDialog, setShowLabelEditDialog] = useState(false);
  // 新增：文字標籤編輯對話框狀態
  const [textDirection, setTextDirection] = useState('');
  const [labelTextDirection, setLabelTextDirection] = useState('horizontal');
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [labelText, setLabelText] = useState('');
  const [labelFontSize, setLabelFontSize] = useState(20);
  const [labelColor, setLabelColor] = useState('#000000');
  const [labelName, setLabelName] = useState('');
  const [isLabelNameDuplicate, setIsLabelNameDuplicate] = useState(false);

  const [isEditingLabelNew, setIsEditingLabelNew] = useState(false);



  const [dynamicTextDefault, setDynamicTextDefault] = useState('');
  const [dynamicTextFontSize, setDynamicTextFontSize] = useState(20);
  const [dynamicTextColor, setDynamicTextColor] = useState('');
  const [DynamicTextName, setDynamicTextName] = useState('');

  const [editingdynamicTextId, setEditingdynamicTextId] = useState("null");

  const [showDynamicTextDialog, setShowDynamicTextDialog] = useState(false);


  const [dynamicTextLetterSpacing, setDynamicTextLetterSpacing] = useState(0);
  const [isDynamicTextDuplicate, setIsDynamicTextDuplicate] = useState(false);

  // 動態圖片編輯對話框狀態
  const [showDynamicImageDialog, setShowDynamicImageDialog] = useState(false);
  const [editingDynamicImageId, setEditingDynamicImageId] = useState(null);
  const [dynamicImageName, setDynamicImageName] = useState('');
  const [isDynamicImageDuplicate, setIsDynamicImageDuplicate] = useState(false);
  const [isEditingDynamicImageNew, setIsEditingDynamicImageNew] = useState(false);

  // 普通圖片編輯對話框狀態
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [editingImageId, setEditingImageId] = useState(null);
  const [imageName, setImageName] = useState('');
  const [isImageDuplicate, setIsImageDuplicate] = useState(false);
  const [isEditingImageNew, setIsEditingImageNew] = useState(false);

  const canvasRef = useRef(null);

  // 檢查兩個元素是否重疊
  const checkOverlap = (elem1, elem2) => {
    return !(elem1.x + elem1.width < elem2.x || 
             elem2.x + elem2.width < elem1.x || 
             elem1.y + elem1.height < elem2.y || 
             elem2.y + elem2.height < elem1.y);
  };

  // 檢查元素是否可以與其他元素重疊
  const canOverlapWith = (elem1, elem2) => {
    // 文字和圖片之間可以重疊
    if ((elem1.type === 'label' || elem1.type === 'dynamicText') && 
        (elem2.type === 'image' || elem2.type === 'dynamicImage')) {
      return true;
    }
    if ((elem1.type === 'image' || elem1.type === 'dynamicImage') && 
        (elem2.type === 'label' || elem2.type === 'dynamicText')) {
      return true;
    }
    
    // 圖片與圖片之間可以重疊（包括動態圖片）
    if ((elem1.type === 'image' || elem1.type === 'dynamicImage') && 
        (elem2.type === 'image' || elem2.type === 'dynamicImage')) {
      return true;
    }
    
    // 文字與文字之間可以重疊（包括動態文字）
    if ((elem1.type === 'label' || elem1.type === 'dynamicText') && 
        (elem2.type === 'label' || elem2.type === 'dynamicText')) {
      return true; // 文字可以重疊
    }
    
    return false;
  };

  // 檢查元素移動是否會造成不允許的重疊
  const checkMoveCollision = (movingElement, newX, newY, excludeId = null) => {
    const tempElement = {
      ...movingElement,
      x: newX,
      y: newY
    };

    // 使用最新的 elements（从 ref 或 state）
    const currentElements = stateRef.current?.elements || elements;
    return currentElements.some(elem => {
      if (elem.id === excludeId || elem.id === movingElement.id) return false;
      
      // 如果可以重疊，則不檢查碰撞
      if (canOverlapWith(tempElement, elem)) return false;
      
      // 檢查是否重疊
      return checkOverlap(tempElement, elem);
    });
  };

  // Track mouse position and drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  
  // 使用 ref 保存最新值，避免事件监听器频繁重新注册
  const stateRef = useRef({
    isDragging: false,
    isResizing: false,
    activeElement: null,
    elements: [],
    startPos: { x: 0, y: 0 }
  });

  // 同步 ref 和 state
  useEffect(() => {
    stateRef.current.isDragging = isDragging;
    stateRef.current.isResizing = isResizing;
    stateRef.current.activeElement = activeElement;
    stateRef.current.startPos = startPos;
  }, [isDragging, isResizing, activeElement, startPos]);

  useEffect(() => {
    stateRef.current.elements = elements;
  }, [elements]);

  // Temporary values for property editing
  const [editValues, setEditValues] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 載入指定 ID 的模板
  const loadTemplateById = async (templateId) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      console.log('正在載入模板 ID:', templateId);
      const response = await apiService.request(`${apiService.legacyBaseURL}/layout/loadById?layoutId=${templateId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // 載入模板元素
      if (data.elements && Array.isArray(data.elements)) {
        loadElementsFromJson(data.elements);
        setCurrentLayoutName(data.layoutName || '');
        setCurrentLayoutId(data.id || templateId);
        console.log('已載入模板:', data.layoutName, 'ID:', templateId);
      }
    } catch (error) {
      setLoadError(`Failed to load template: ${error.message}`);
      console.error('載入模板失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load configuration options from API
  const loadConfigOptions = async (optionsUrl, userId) => {
    setIsLoadingOptions(true);
    setLoadError(null);

    try {
      const url = new URL(optionsUrl);
      url.searchParams.set("userId", userId); // 加上 userId 作為查詢參數
      
      console.log('正在載入佈局選項，URL:', url.toString());
      console.log('用戶ID:', userId);
      console.log('localStorage中的username:', localStorage.getItem('username'));
      console.log('localStorage中的所有項目:', Object.keys(localStorage).map(key => `${key}: ${localStorage.getItem(key)}`));

      const response = await apiService.request(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API響應數據:', data);

      let options = Array.isArray(data) ? data : (data.configs || data.options || []);
      console.log('處理後的選項:', options);
      
      options = options.filter(option =>
        option.id && option.name
      );
      console.log('過濾後的選項:', options);

      setConfigOptions(options);
      console.log('設置的配置選項數量:', options.length);
      
      // 檢查 URL 參數中是否有預選的模板
      const templateId = searchParams.get('templateId');
      if (templateId) {
        const template = options.find(option => option.id === templateId);
        if (template) {
          console.log('預選模板:', template);
          setSelectedConfig(templateId);
          // 載入預選的模板
          await loadTemplateById(templateId);
        }
      }
    } catch (error) {
      setLoadError(`Failed to load config options: ${error.message}`);
    } finally {
      setIsLoadingOptions(false);
    }
  };



  const saveElementsToDB = async (elements) => {
    const data = elements.map(({ id, type, x, y, width, height, url, imageUrl, imageId, name, text, fontSize, letterSpacing, color, blackThreshold, whiteThreshold, contrast, content, textDirection, zIndex }) => ({
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      imageUrl: imageUrl,
      imageId,
      name,
      text,
      fontSize,
      letterSpacing,
      color,
      blackThreshold,
      whiteThreshold,
      contrast,
      content,
      textDirection,
      zIndex
    }))

    await db.saveJSON(data, 'elementsData') // 直接用 db.js 的 saveJSON
  }

  // Load configuration from selected option
  const loadSelectedConfig = async () => {
    if (!selectedConfig) return;

    const selectedOption = configOptions.find(option => option.id === selectedConfig);
    if (!selectedOption) return;

    // Set the current layout name and ID when loading from dropdown
    setCurrentLayoutName(selectedOption.name);
    setCurrentLayoutId(selectedOption.id);

    // 優先使用 ID 載入（更可靠，避免 URL 和 CORS 問題）
    if (selectedOption.id) {
      try {
        console.log('使用 ID 載入佈局:', selectedOption.id);
        await loadTemplateById(selectedOption.id);
        return; // 成功載入後直接返回
      } catch (error) {
        console.error('通過 ID 載入失敗，嘗試使用 URL:', error);
        // 如果 ID 載入失敗，繼續嘗試 URL
      }
    }

    // Load from URL if provided, otherwise use embedded config
    if (selectedOption.url) {
      // 處理相對路徑或絕對路徑
      let fullUrl;
      if (selectedOption.url.startsWith('http://') || selectedOption.url.startsWith('https://')) {
        // 絕對路徑
        fullUrl = selectedOption.url;
      } else {
        // 相對路徑，加上 baseURL
        fullUrl = `${apiService.legacyBaseURL}${selectedOption.url.startsWith('/') ? selectedOption.url : '/' + selectedOption.url}`;
      }
      
      // 加上 layoutName 和 userId 為查詢參數
      const url = new URL(fullUrl);
      url.searchParams.set("layoutName", selectedOption.name); // 假設 name 就是 layoutName
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        setLoadError('請先登錄');
        return;
      }
      url.searchParams.set("userId", currentUserId);

      await loadJsonFromUrl(url.toString());
    } else if (selectedOption.config) {
      loadElementsFromJson(selectedOption.config);
    } else if (selectedOption.id) {
      // 如果沒有 URL 但有 ID，使用 loadById（更可靠的方法，推薦）
      try {
        console.log('使用 ID 載入佈局:', selectedOption.id);
        await loadTemplateById(selectedOption.id);
      } catch (error) {
        console.error('通過 ID 載入失敗:', error);
        setLoadError(`載入佈局失敗: ${error.message}`);
      }
    } else {
      setLoadError('佈局配置無效：缺少 URL、config 或 ID');
    }

  };

  const deleteCurrentLayout = async () => {
    if (!currentLayoutId || !currentLayoutName) return;

    setIsDeleting(true);

    try {
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      await handleLayoutDelete(currentUserId, currentLayoutName);
      // Remove the deleted layout from the options
      setConfigOptions(prev => prev.filter(option => option.id !== currentLayoutId));

      // Clear the canvas and current layout info
      setElements([]);
      setActiveElement(null);
      setCurrentLayoutName('');
      setCurrentLayoutId('');
      setSelectedConfig('');

      setShowDeleteDialog(false);
    } catch (error) {
      setLoadError(`Failed to delete layout: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Load JSON configuration from a URL or file
  const loadJsonFromUrl = async (url) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      console.log('正在載入 JSON，URL:', url);
      const response = await apiService.request(url);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '無法讀取錯誤信息');
        console.error('HTTP 錯誤:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('成功載入 JSON 數據:', data);
      loadElementsFromJson(data);
      
      // Clear current layout name and ID when loading from URL (not from dropdown)
      if (!selectedConfig) {
        setCurrentLayoutName('');
        setCurrentLayoutId('');
      }
    } catch (error) {
      console.error('載入 JSON 失敗:', error);
      const errorMessage = error.message || '未知錯誤';
      setLoadError(`載入佈局失敗: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };



/**
 * 將圖片轉為三色 (黑 / 紅 / 白) Base64
 * 可選區域對比強化 (CLAHE)
 */
const convertImageSrcToTriColorBase64 = async (
  src,
  blackThreshold = 100,
  whiteThreshold = 180,
  contrast = 1.0
) => {
  return new Promise(async (resolve, reject) => {
    // 檢查src是否有效
    if (!src || typeof src !== 'string') {
      console.warn('convertImageSrcToTriColorBase64: 無效的src參數:', src);
      resolve(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const { width, height } = img;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // 灰階計算
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // gamma 對比
        gray = 255 * Math.pow(gray / 255, 1 / contrast);
        gray = Math.max(0, Math.min(255, gray));

        // 三色映射（與 ImageManager 一致）
        if (gray < blackThreshold) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        } else if (gray > whiteThreshold) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        } else {
          data[i] = 255;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('圖片載入失敗'));

    // 處理圖片載入
    (async () => {
      try {
        // 如果是 public 目錄下的靜態資源（以 / 開頭且不是 API 路徑），直接使用
        if (src.startsWith('/') && !src.startsWith('/api/') && !src.startsWith('/images/')) {
          // 直接使用相對路徑（public 目錄下的資源）
          img.crossOrigin = 'anonymous';
          img.src = src;
        } else if (src.startsWith('data:') || src.startsWith('blob:')) {
          // Base64 或 Blob URL，直接使用
          img.src = src;
        } else {
          // 其他路徑，使用 apiService 載入
          const blob = await apiService.loadImageBlob(src);
          const objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        }
      } catch (e) {
        // 如果通過 API 載入失敗，嘗試直接使用路徑（可能是靜態資源）
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
          console.warn('API 載入失敗，嘗試直接使用路徑:', src);
          img.crossOrigin = 'anonymous';
          img.src = src;
        } else {
          reject(e);
        }
      }
    })();
  });
};





  // Process and validate JSON data
  const loadElementsFromJson = async (data) => {
    try {
      let elementsData = Array.isArray(data) ? data : data.elements || [];

      // Validate and process each element
      console.log('loadElementsFromJson - elementsData:', elementsData);
      const validElements = await Promise.all(
        elementsData
          .filter(elem => elem.type && elem.x !== undefined && elem.y !== undefined)
          .map(async (elem) => {
            console.log('Processing element:', elem.type, 'content:', elem.content);
            return {
              id: elem.id || `elem-${Date.now()}-${Math.random()}`,
              type: elem.type,
              //label: elem.srcName || elementTypes.find(t => t.id === elem.type)?.label || elem.type,
              name: elem.name,
              x: Math.max(0, Math.min(800 - (elem.width || 150), elem.x)),
              y: Math.max(0, Math.min(480 - (elem.height || 40), elem.y)),
              width: Math.max(10, Math.min(800, elem.width || 150)),
              height: Math.max(10, Math.min(480, elem.height || 40)),
              imageUrl: (elem.type === 'image' || elem.type === 'dynamicImage')
                ? elem.imageUrl || (elem.content ? await convertImageSrcToTriColorBase64(elem.content, elem.blackThreshold, elem.whiteThreshold, elem.contrast) : undefined)
                : undefined,
              imageId: elem.imageId,
              text: elem.text || '文字標籤',
              fontSize: Math.max(20, elem.fontSize || 20),
              color: elem.color || 'black',
              srcName: elem.srcName,
              letterSpacing: elem.letterSpacing,
              textDirection: elem.textDirection,
              //srcThreshold: elem.srcThreshold,
              content: elem.content,
              //content : elem.content, 
              whiteThreshold: elem.whiteThreshold, blackThreshold: elem.blackThreshold, contrast: elem.contrast,
              zIndex: elem.zIndex || 1

            };

          })

      );

      // 按照 zIndex 排序，保持原有的 zIndex 值
      const sortedElements = validElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

      setElements(sortedElements);
      setActiveElement(null);
    } catch (error) {
      setLoadError(`Error processing JSON data: ${error.message}`);
    }
  };

  const loadElementsFromDB = async () => {
    const data = await db.loadJSON('elementsData')
    return data || []
  }
  const logAllDBData = async () => {
    const dbInstance = await db.initDB()
    const tx = dbInstance.transaction('jsonStore', 'readonly')
    const store = tx.objectStore('jsonStore')

    const allKeys = await store.getAllKeys()
    const allValues = await store.getAll()

    allKeys.forEach((key, i) => {
    })
  }
  // Load default configuration on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1️⃣ 讀 IndexedDB 的 elementsData
        const elementsData = await loadElementsFromDB(); // 這裡已經回傳 array，不需要 JSON.parse

        if (elementsData && elementsData.length) {
          loadElementsFromJson(elementsData); // 把元素載入頁面
        }
      } catch (e) {
        // 處理錯誤
      }

      // 2️⃣ 從 API 載入真實設定
      const configOptionsUrl = `${apiService.legacyBaseURL}/layout/summary`;
      const currentUserId = localStorage.getItem('username');
      if (!currentUserId) {
        console.error('無法獲取當前用戶ID，請重新登錄');
        return;
      }
      loadConfigOptions(configOptionsUrl, currentUserId);
    }

    loadData();
  }, []);

  const openLabelEditDialog = (input, isNew = false) => {
    let element;

    if (typeof input === 'string') {
      // 傳入的是 ID，從 elements 陣列中找
      element = elements.find(elem => elem.id === input);
    } else if (typeof input === 'object' && input !== null) {
      // 傳入的是整個 element 物件
      element = input;
    }

    if (element?.type === 'label') {
      setIsEditingLabelNew(isNew);
      setEditingLabelId(element.id);
      setLabelText(element.text || '文字標籤');
      setLabelFontSize(Math.max(20, element.fontSize || 20));
      setLabelName(element.name || "New Label");
      setLabelTextDirection(element.textDirection || 'horizontal');
      setShowLabelEditDialog(true);
    }
  };


  const openDynamicTextEditDialog = (input) => {
    let element;

    if (typeof input === 'string') {
      // 傳入的是 ID，從 elements 陣列中找
      element = elements.find(elem => elem.id === input);
    } else if (typeof input === 'object' && input !== null) {
      // 傳入的是整個 element 物件
      element = input;
    }
    if (element && element.type === 'dynamicText') {
      setEditingdynamicTextId(element.id);
      setDynamicTextDefault(element.text || '動態文字標籤');
      setDynamicTextFontSize(Math.max(20, element.fontSize || 20));
      setDynamicTextColor(element.color || 'black');
      setDynamicTextLetterSpacing(element.letterSpacing || 2);
      setDynamicTextName(element.name || '');
      setShowDynamicTextDialog(true);
      setDynamicTextLetterSpacing(element.letterSpacing || '');
      setTextDirection(element.textDirection || '');

    }
  };

  const openDynamicImageEditDialog = (input, isNew = false) => {
    let element;

    if (typeof input === 'string') {
      // 傳入的是 ID，從 elements 陣列中找
      element = elements.find(elem => elem.id === input);
    } else if (typeof input === 'object' && input !== null) {
      // 傳入的是整個 element 物件
      element = input;
    }

    if (element && element.type === 'dynamicImage') {
      setIsEditingDynamicImageNew(isNew);
      setEditingDynamicImageId(element.id);
      setDynamicImageName(element.name || '動態圖片');
      setShowDynamicImageDialog(true);
    }
  };

  const openImageEditDialog = (input, isNew = false) => {
    let element;

    if (typeof input === 'string') {
      // 傳入的是 ID，從 elements 陣列中找
      element = elements.find(elem => elem.id === input);
    } else if (typeof input === 'object' && input !== null) {
      // 傳入的是整個 element 物件
      element = input;
    }

    if (element && element.type === 'image') {
      setIsEditingImageNew(isNew);
      setEditingImageId(element.id);
      setImageName(element.name || '圖片');
      setShowImageDialog(true);
    }
  };

  // 新增：保存文字標籤設定
  const saveLabelSettings = () => {
    if (!editingLabelId) return;
    const isDuplicate = elements.some(
      elem => elem.id !== editingLabelId  && elem.name === labelName.trim()
    );

    if (isDuplicate) {
      setIsLabelNameDuplicate(true)
      return;
    }
    setElements(prev => prev.map(elem =>
      elem.id === editingLabelId
        ? {
          ...elem,
          text: labelText,
          fontSize: labelFontSize,
          color: labelColor,
          name: labelName,
          textDirection: labelTextDirection
        }
        : elem
    ));

    setShowLabelEditDialog(false);
    setIsLabelNameDuplicate(false);
    setEditingLabelId(null);
  };

const saveDynamicSettings = () => {
  if (!editingdynamicTextId) return;

  const trimmed = DynamicTextName.trim();
  
  // 檢查名稱不能為空白
  if (!trimmed) {
    return;
  }

  const isDuplicate = elements.some(
    elem => elem.id !== editingdynamicTextId && elem.name === trimmed
  );

  if (isDuplicate) {
    setIsDynamicTextDuplicate(true);
    return;
  }

  setElements(prev => prev.map(elem =>
    elem.id === editingdynamicTextId
      ? {
        ...elem,
        text: dynamicTextDefault,
        fontSize: dynamicTextFontSize,
        color: dynamicTextColor,
        name: DynamicTextName,
        letterSpacing: dynamicTextLetterSpacing,
        textDirection: textDirection
      }
      : elem
  ));

  setShowDynamicTextDialog(false);
  setIsDynamicTextDuplicate(false);
  setEditingdynamicTextId(null);
};

const saveDynamicImageSettings = () => {
  if (!editingDynamicImageId) return;
  
  const trimmed = dynamicImageName.trim();
  
  // 檢查名稱不能為空白
  if (!trimmed) {
    return;
  }
  
  const isDuplicate = elements.some(
    elem => elem.id !== editingDynamicImageId && elem.name === trimmed
  );

  if (isDuplicate) {
    setIsDynamicImageDuplicate(true);
    return;
  }

  setElements(prev => prev.map(elem =>
    elem.id === editingDynamicImageId
      ? {
        ...elem,
        name: dynamicImageName
      }
      : elem
  ));

  setShowDynamicImageDialog(false);
  setIsDynamicImageDuplicate(false);
  setEditingDynamicImageId(null);
};

const saveImageSettings = () => {
  if (!editingImageId) return;
  
  const trimmed = imageName.trim();
  
  // 檢查名稱不能為空白
  if (!trimmed) {
    return;
  }
  
  const isDuplicate = elements.some(
    elem => elem.id !== editingImageId && elem.name === trimmed
  );

  if (isDuplicate) {
    setIsImageDuplicate(true);
    return;
  }

  setElements(prev => prev.map(elem =>
    elem.id === editingImageId
      ? {
        ...elem,
        name: imageName
      }
      : elem
  ));

  setShowImageDialog(false);
  setIsImageDuplicate(false);
  setEditingImageId(null);
};

  // 為新元素找到不重疊的位置
  const findNonOverlappingPosition = (newElement) => {
    let attempts = 0;
    let testX = newElement.x;
    let testY = newElement.y;
    
    while (attempts < 100) { // 最多嘗試100次
      const tempElement = { ...newElement, x: testX, y: testY };
      
      // 檢查是否與任何不允許重疊的元素重疊
      const hasCollision = elements.some(elem => {
        if (canOverlapWith(tempElement, elem)) return false;
        return checkOverlap(tempElement, elem);
      });
      
      if (!hasCollision) {
        return { x: testX, y: testY };
      }
      
      // 嘗試下一個位置
      testX += 20;
      if (testX + newElement.width > 800) {
        testX = 0;
        testY += 20;
        if (testY + newElement.height > 480) {
          testY = 0;
        }
      }
      
      attempts++;
    }
    
    // 如果找不到位置，返回原位置
    return { x: newElement.x, y: newElement.y };
  };

  // 獲取下一個可用的 zIndex
  const getNextZIndex = (elementType = 'image') => {
    if (elements.length === 0) {
      // 文字元素從 5 開始，圖片元素從 1 開始
      return elementType === 'label' || elementType === 'dynamicText' ? 5 : 1;
    }
    
    if (elementType === 'label' || elementType === 'dynamicText') {
      // 文字元素：在圖片之上，從 5 開始
      const textElements = elements.filter(elem => elem.type === 'label' || elem.type === 'dynamicText');
      if (textElements.length === 0) return 5;
      const maxTextZIndex = Math.max(...textElements.map(elem => elem.zIndex || 5));
      return maxTextZIndex + 1;
    } else {
      // 圖片元素：在文字之下，從 1 開始
      const imageElements = elements.filter(elem => elem.type === 'image' || elem.type === 'dynamicImage');
      if (imageElements.length === 0) return 1;
      const maxImageZIndex = Math.max(...imageElements.map(elem => elem.zIndex || 1));
      return maxImageZIndex + 1;
    }
  };

  // 將指定元素移到最上層
  const bringElementToFront = (elementId) => {
    // 使用最新的 elements（从 ref 或 state）
    const currentElements = stateRef.current?.elements || elements;
    const element = currentElements.find(elem => elem.id === elementId);
    if (!element) return;
    
    const nextZIndex = getNextZIndex(element.type);
    setElements(prevElements => {
      const updatedElements = prevElements.map(elem => 
        elem.id === elementId 
          ? { ...elem, zIndex: nextZIndex }
          : elem
      );
      // 重新排序確保陣列順序與 zIndex 順序一致
      return updatedElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    });
  };

  // Handle adding a new element
  const addElement = (type) => {
    if (type.id === 'image') {
      // 新增普通圖片元素
      const newElement = {
        id: `elem-${Date.now()}`,
        type: 'image',
        name: '圖片',
        x: 50,
        y: 50,
        width: 150,
        height: 100,
        imageUrl: null, // 初始沒有圖片
        zIndex: getNextZIndex('image')
      };

      // 找到不重疊的位置
      const position = findNonOverlappingPosition(newElement);
      newElement.x = position.x;
      newElement.y = position.y;

      const newElements = [...elements, newElement];
      setElements(newElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)));
      setActiveElement(newElement.id);

      // Initialize edit values
      setEditValues({
        x: newElement.x,
        y: newElement.y,
        width: newElement.width,
        height: newElement.height
      });
      
      // 開啟編輯對話框
      openImageEditDialog(newElement, true);
    } else if (type.id === 'dynamicImage') {
      // 新增動態圖片元素
      const newElement = {
        id: `elem-${Date.now()}`,
        type: 'dynamicImage',
        name: '動態圖片',
        x: 50,
        y: 50,
        width: 150,
        height: 100,
        imageUrl: null, // 初始沒有圖片
        zIndex: getNextZIndex('image')
      };

      // 找到不重疊的位置
      const position = findNonOverlappingPosition(newElement);
      newElement.x = position.x;
      newElement.y = position.y;

      const newElements = [...elements, newElement];
      setElements(newElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)));
      setActiveElement(newElement.id);

      // Initialize edit values
      setEditValues({
        x: newElement.x,
        y: newElement.y,
        width: newElement.width,
        height: newElement.height
      });
      
      // 開啟編輯對話框
      openDynamicImageEditDialog(newElement, true);
    } else if (type.id === 'label') {
      // 新增文字標籤元素
      const newElement = {
        id: `elem-${Date.now()}`,
        type: 'label',
        //label: '文字標籤',
        x: 50,
        y: 50,
        width: 150,
        height: 40,
        //text: '文字標籤',
        fontSize: 20,
        //color: '#000000',
        textDirection: 'horizontal',
        zIndex: getNextZIndex('label')
      };

      // 找到不重疊的位置
      const position = findNonOverlappingPosition(newElement);
      newElement.x = position.x;
      newElement.y = position.y;

      const newElements = [...elements, newElement];
      setElements(newElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)));
      setActiveElement(newElement.id);

      // Initialize edit values
      setEditValues({
        x: newElement.x,
        y: newElement.y,
        width: newElement.width,
        height: newElement.height
      });
      openLabelEditDialog(newElement, true)
    } else if (type.id === 'guestQRCode') {
      // 檢查是否已經存在 guestQRCode 元素
      if (elements.some(elem => elem.type === 'guestQRCode')) {
        toast.error('每個模板只能有一個訪客 QR Code');
        return;
      }

      // 新增 Guest QR Code 元素（固定大小 150x150）
      const newElement = {
        id: `elem-${Date.now()}`,
        type: 'guestQRCode',
        name: '訪客 QR Code',
        x: 50,
        y: 50,
        width: 150, // 固定大小
        height: 150, // 固定大小
        zIndex: getNextZIndex('guestQRCode')
      };

      // 找到不重疊的位置
      const position = findNonOverlappingPosition(newElement);
      newElement.x = position.x;
      newElement.y = position.y;

      const newElements = [...elements, newElement];
      setElements(newElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)));
      setActiveElement(newElement.id);

      // Initialize edit values
      setEditValues({
        x: newElement.x,
        y: newElement.y,
        width: newElement.width,
        height: newElement.height
      });
    } else {
      // Check if element already exists
      if (elements.some(elem => elem.type === type.id && type.id != 'image')) {
        // 允許重複元素
      }

      const newElement = {
        id: `elem-${Date.now()}`,
        type: type.id,
        name: type.label,
        x: 50,
        y: 50,
        width: 150,
        height: 40,
        fontSize: 20,
        fontWeight: 'normal',
        text: '',
        textDirection: 'horizontal',
        letterSpacing: 0,
        zIndex: getNextZIndex('dynamicText')
      };

      // 找到不重疊的位置
      const position = findNonOverlappingPosition(newElement);
      newElement.x = position.x;
      newElement.y = position.y;

      const newElements = [...elements, newElement];
      setElements(newElements.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1)));
      setActiveElement(newElement.id);

      // Initialize edit values
      setEditValues({
        x: newElement.x,
        y: newElement.y,
        width: newElement.width,
        height: newElement.height
      });
      openDynamicTextEditDialog(newElement)
    }
  };

  // Handle removing an element
  const removeElement = (id) => {
    setElements(elements.filter(elem => elem.id !== id));
    if (activeElement === id) {
      setActiveElement(null);
    }
  };

  // Find active element data
  const getActiveElementData = () => {
    if (!activeElement) return null;
    return elements.find(elem => elem.id === activeElement);
  };

  // Update edit values when active element changes
  useEffect(() => {
    const activeElem = getActiveElementData();
    if (activeElem) {
      setEditValues({
        x: Math.round(activeElem.x || 0),
        y: Math.round(activeElem.y || 0),
        width: Math.round(activeElem.width || 0),
        height: Math.round(activeElem.height || 0)
      });
    }
  }, [activeElement, elements]);

  // Handle mouse down on element
  const handleMouseDown = (e, id) => {
    e.stopPropagation();

    setActiveElement(id);

    // 將點擊的元素移到最上層
    bringElementToFront(id);

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const activeElem = elements.find(elem => elem.id === id);
    const isGuestQRCode = activeElem && activeElem.type === 'guestQRCode';
    
    const isNearResizeHandle =
      rect.width - offsetX < 20 &&
      rect.height - offsetY < 20;

    // Guest QR Code 元素不能調整大小
    if (isNearResizeHandle && !isGuestQRCode) {
      setIsResizing(true);
    } else {
      setIsDragging(true);
    }

    setStartPos({
      x: e.clientX,
      y: e.clientY,
      offsetX,
      offsetY
    });

    setCurrentPos({
      x: e.clientX,
      y: e.clientY
    });
  };

  // Handle mouse move - 使用 ref 获取最新值，减少依赖
  const handleMouseMove = useCallback((e) => {
    const state = stateRef.current;
    
    // 只在非拖動狀態下更新滑鼠位置顯示
    if (!state.isDragging && !state.isResizing) {
      setCurrentPos({
        x: Math.round(e.clientX),
        y: Math.round(e.clientY)
      });
      return;
    }
    
    if (!state.activeElement) return;

    // 取消之前的動畫幀
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 使用 requestAnimationFrame 來節流更新
    animationFrameRef.current = requestAnimationFrame(() => {
      const activeElem = state.elements.find(elem => elem.id === state.activeElement);
      if (!activeElem || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();

      if (state.isDragging) {
        const newX = e.clientX - canvasRect.left - state.startPos.offsetX;
        const newY = e.clientY - canvasRect.top - state.startPos.offsetY;

        const boundedX = Math.max(0, Math.min(800 - activeElem.width, newX));
        const boundedY = Math.max(0, Math.min(480 - activeElem.height, newY));

        // 檢查是否會造成不允許的重疊（使用 ref 中的最新 elements）
        if (!checkMoveCollision(activeElem, boundedX, boundedY, state.activeElement)) {
          setElements(prev => prev.map(elem =>
            elem.id === state.activeElement
              ? { ...elem, x: boundedX, y: boundedY }
              : elem
          ));

          setEditValues(prev => ({
            ...prev,
            x: boundedX,
            y: boundedY
          }));
        }
      } else if (state.isResizing) {
        // Guest QR Code 元素不能調整大小
        if (activeElem.type === 'guestQRCode') {
          return;
        }
        
        const deltaX = e.clientX - state.startPos.x;
        const deltaY = e.clientY - state.startPos.y;

        const newWidth = Math.max(0, activeElem.width + deltaX);
        const newHeight = Math.max(0, activeElem.height + deltaY);

        const boundedWidth = Math.min(newWidth, 800 - activeElem.x);
        const boundedHeight = Math.min(newHeight, 480 - activeElem.y);

        setStartPos({
          ...state.startPos,
          x: e.clientX,
          y: e.clientY
        });

        setElements(prev => prev.map(elem =>
          elem.id === state.activeElement
            ? { ...elem, width: boundedWidth, height: boundedHeight }
            : elem
        ));

        setEditValues(prev => ({
          ...prev,
          width: boundedWidth,
          height: boundedHeight
        }));
      }
    });
  }, []); // 空依赖，使用 ref 获取最新值

  // Handle mouse up - 使用 ref 获取最新值
  const handleMouseUp = useCallback(() => {
    const state = stateRef.current;
    
    // 清理動畫幀
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 如果剛完成拖拽或調整大小，將元素移到最上層
    if ((state.isDragging || state.isResizing) && state.activeElement) {
      bringElementToFront(state.activeElement);
    }
    
    setIsDragging(false);
    setIsResizing(false);
  }, []); // 空依赖，使用 ref 获取最新值

  // Handle direct input change for element properties
  const handlePropertyChange = (property, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    setEditValues(prev => ({
      ...prev,
      [property]: numValue
    }));

    if (!activeElement) return;

    const updatedValues = { ...editValues, [property]: numValue };
    const boundedValues = {
      x: Math.max(0, Math.min(800 - updatedValues.width, updatedValues.x)),
      y: Math.max(0, Math.min(480 - updatedValues.height, updatedValues.y)),
      width: Math.max(0, Math.min(800 - updatedValues.x, updatedValues.width)),
      height: Math.max(0, Math.min(480 - updatedValues.y, updatedValues.height))
    };

    const activeElem = elements.find(elem => elem.id === activeElement);
    if (!activeElem) return;

    // 檢查位置變更是否會造成不允許的重疊
    if ((property === 'x' || property === 'y') && 
        !checkMoveCollision(activeElem, boundedValues.x, boundedValues.y)) {
      setElements(prev => prev.map(elem =>
        elem.id === activeElement
          ? { ...elem, [property]: boundedValues[property] }
          : elem
      ));
    } else if (property === 'width' || property === 'height') {
      // 尺寸變更不需要檢查重疊
      setElements(prev => prev.map(elem =>
        elem.id === activeElement
          ? { ...elem, [property]: boundedValues[property] }
          : elem
      ));
    }
  };

  // Apply property changes to the element
  const applyPropertyChanges = () => {
    if (!activeElement) return;

    const activeElem = elements.find(elem => elem.id === activeElement);
    if (!activeElem) return;

    const boundedValues = {
      x: Math.max(0, Math.min(800 - editValues.width, editValues.x)),
      y: Math.max(0, Math.min(480 - editValues.height, editValues.y)),
      width: activeElem.type === 'guestQRCode' ? 150 : Math.max(50, Math.min(800 - editValues.x, editValues.width)),
      height: activeElem.type === 'guestQRCode' ? 150 : Math.max(30, Math.min(480 - editValues.y, editValues.height))
    };

    // 檢查位置變更是否會造成不允許的重疊
    if (!checkMoveCollision(activeElem, boundedValues.x, boundedValues.y)) {
      setElements(prev => prev.map(elem =>
        elem.id === activeElement
          ? { ...elem, ...boundedValues }
          : elem
      ));

      setEditValues(boundedValues);
    }
  };

  // Open export dialog
  const openExportDialog = () => {
    setExportLayoutName(currentLayoutName); // Pre-fill with current layout name
    setShowExportDialog(true);
  };

  const performExport = async () => {
    // 檢查是否為新佈局（如果佈局名稱不存在於現有佈局中，則為新佈局）
    const isNewLayout = !configOptions.some(opt => opt.name === (exportLayoutName || '').trim());
    
    // 如果是新佈局，檢查佈局數量限制
    if (isNewLayout && configOptions.length >= MAX_LAYOUT_COUNT) {
      toast.warning(`佈局數量已達上限（最多 ${MAX_LAYOUT_COUNT} 個），請先刪除一些佈局再創建新佈局`);
      return;
    }

    const data = elements.map(({ id, type, x, y, width, height, url, imageId, name, text, fontSize, letterSpacing, color, blackThreshold, whiteThreshold, contrast, content, textDirection, }) => ({
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      imageUrl: url,
      imageId: imageId,
      name: name,
      text: text,
      fontSize: fontSize,
      letterSpacing: letterSpacing,
      color: color,
      blackThreshold: blackThreshold,
      whiteThreshold: whiteThreshold,
      contrast: contrast,
      content: content,
      textDirection: textDirection
    }));

    // Call your layout submit function
    const currentUserId = localStorage.getItem('username');
    if (!currentUserId) {
      console.error('無法獲取當前用戶ID，請重新登錄');
      return;
    }
    
    try {
      await handleLayoutSubmit(data, currentUserId, exportLayoutName || 'untitled-layout');
      
      // 如果是新佈局，重新載入佈局列表
      if (isNewLayout) {
        const configOptionsUrl = `${apiService.legacyBaseURL}/layout/summary`;
        await loadConfigOptions(configOptionsUrl, currentUserId);
      }
      
      toast.success(isNewLayout ? '佈局創建成功！' : '佈局更新成功！');
    } catch (error) {
      console.error('保存佈局失敗:', error);
      toast.error('保存佈局失敗，請重試');
      return;
    }

    // Close dialog
    setShowExportDialog(false);
  };


  const clearAll = async () => {
    // 清掉 React state
    setElements([]);

    // 清掉 IndexedDB
    await db.clearJSON('elementsData');
    await db.clearJSON('editingImage');
  };


  // Register and cleanup event listeners - 优化后只注册一次
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // 清理動畫幀
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove, handleMouseUp]); // 只依赖稳定的函数引用

  // Get active element data for display
  const activeElementData = getActiveElementData();

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-xl border-r border-slate-200 p-6 overflow-y-auto">
        {/* Current Layout Info */}
        {currentLayoutName && (
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">當前佈局:</span>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                title="刪除當前佈局"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="text-sm text-emerald-700 mt-1 font-medium">{currentLayoutName}</div>
          </div>
        )}

        {/* JSON Loading Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 flex-1">
              佈局管理 ({configOptions.length}/{MAX_LAYOUT_COUNT})
            </h2>
            {configOptions.length >= MAX_LAYOUT_COUNT && (
              <span className="text-sm text-red-600 font-medium ml-2">
                已達上限
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Predefined Config Dropdown */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                選擇預設佈局：
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedConfig}
                  onChange={(e) => setSelectedConfig(e.target.value)}
                  className="flex-1 p-3 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoadingOptions}
                >
                  <option value="">選擇佈局...</option>
                  {configOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadSelectedConfig}
                  disabled={!selectedConfig || isLoading}
                  className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold shadow-sm transition-colors"
                >
                  載入
                </button>
              </div>
              {isLoadingOptions && (
                <div className="text-xs text-blue-600 mt-2 font-medium">載入選項中...</div>
              )}
            </div>
            <button
              onClick={clearAll}
              className="flex items-center justify-center w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 text-sm font-semibold shadow-sm transition-colors"
            >
              <MinusCircle size={16} className="mr-2" />
              清除全部
            </button>
          </div>

          {loadError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              {loadError}
            </div>
          )}

          {isLoading && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm font-medium">
              載入配置中...
            </div>
          )}
        </div>






        <h2 className="text-xl font-bold mb-6 text-slate-800 border-b border-slate-200 pb-2">元素管理</h2>

        <div className="space-y-3 mb-8">
          {elementTypes.map(type => (
            <div key={type.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <span className="text-sm font-semibold text-slate-700">{type.name}</span>
              <button
                onClick={() => addElement(type)}
                disabled={elements.length >= MAX_CANVAS_ELEMENTS}
                className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={elements.length >= MAX_CANVAS_ELEMENTS ? `畫布元素數量已達上限（${MAX_CANVAS_ELEMENTS} 個），請先刪除一些元素` : `新增${type.name}`}
              >
                <PlusCircle size={20} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 flex-1">
            已新增元素 ({elements.length}/{MAX_CANVAS_ELEMENTS})
          </h2>
          {elements.length >= MAX_CANVAS_ELEMENTS && (
            <span className="text-sm text-red-600 font-medium ml-2">
              已達上限
            </span>
          )}
        </div>
        <div className="space-y-3 max-h-60 overflow-auto">
          {elements.map(elem => (
            <div
              key={elem.id}
              className={`flex items-center justify-between p-4 rounded-lg shadow-sm border cursor-pointer transition-all ${
                activeElement === elem.id 
                  ? 'bg-blue-50 border-blue-300 shadow-md' 
                  : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
              }`}
              onClick={() => {
                setActiveElement(elem.id);
                bringElementToFront(elem.id);
              }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">{elem.name}</span>
                <span className="text-xs text-slate-500 font-medium">
                  {elementTypes.find(type => type.id === elem.type)?.name || elem.type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* 新增：文字標籤編輯按鈕 */}
                {elem.type === 'label' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openLabelEditDialog(elem.id);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                    title="編輯文字"
                  >
                    <Edit3 size={16} />
                  </button>
                )}

                {elem.type === 'dynamicText' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDynamicTextEditDialog(elem.id);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                    title="編輯動態文字"
                  >
                    <Edit3 size={16} />
                  </button>
                )}

                {elem.type === 'dynamicImage' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDynamicImageEditDialog(elem.id);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                    title="編輯動態圖片"
                  >
                    <Edit3 size={16} />
                  </button>
                )}

                {elem.type === 'image' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openImageEditDialog(elem.id);
                    }}
                    className="text-emerald-600 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50 transition-colors"
                    title="編輯圖片"
                  >
                    <Edit3 size={16} />
                  </button>
                )}


                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeElement(elem.id);
                  }}
                  className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <MinusCircle size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {activeElementData && (
          <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
            <h3 className="font-bold mb-4 text-slate-800 text-lg">元素屬性</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">X 座標:</label>
                <input
                  type="number"
                  value={Math.round(editValues.x || 0)}
                  onChange={(e) => handlePropertyChange('x', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Y 座標:</label>
                <input
                  type="number"
                  value={Math.round(editValues.y || 0)}
                  onChange={(e) => handlePropertyChange('y', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">寬度:</label>
                <input
                  type="number"
                  value={Math.round(editValues.width || 0)}
                  onChange={(e) => handlePropertyChange('width', e.target.value)}
                  disabled={getActiveElementData()?.type === 'guestQRCode'}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">高度:</label>
                <input
                  type="number"
                  value={Math.round(editValues.height || 0)}
                  onChange={(e) => handlePropertyChange('height', e.target.value)}
                  disabled={getActiveElementData()?.type === 'guestQRCode'}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              onClick={applyPropertyChanges}
              className="mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg text-sm font-semibold hover:bg-blue-700 w-full shadow-sm transition-colors"
            >
              套用變更
            </button>

            {/* 重疊狀態指示器 */}
            {activeElementData && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-1">重疊規則</div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>• 圖片與圖片：不可重疊</div>
                  <div>• 文字與文字：不可重疊</div>
                  <div>• 文字與圖片：可重疊</div>
                  <div>• 文字永遠在圖片上方</div>
                </div>
              </div>
            )}

            {/* Text label quick edit button */}
            {activeElementData.type === 'label' && (
              <button
                onClick={() => openLabelEditDialog(activeElementData.id)}
                className="mt-3 bg-emerald-600 text-white py-3 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-700 w-full flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Edit3 size={14} />
                編輯文字
              </button>
            )}

            {/* Dynamic image quick edit button */}
            {activeElementData.type === 'dynamicImage' && (
              <button
                onClick={() => openDynamicImageEditDialog(activeElementData.id)}
                className="mt-3 bg-emerald-600 text-white py-3 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-700 w-full flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Edit3 size={14} />
                編輯動態圖片
              </button>
            )}

            {/* Image quick edit button */}
            {activeElementData.type === 'image' && (
              <button
                onClick={() => openImageEditDialog(activeElementData.id)}
                className="mt-3 bg-emerald-600 text-white py-3 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-700 w-full flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Edit3 size={14} />
                編輯圖片
              </button>
            )}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={openExportDialog}
            className="flex items-center justify-center w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 text-sm font-bold shadow-lg transition-all"
          >
            保存佈局
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-lg border-b border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Canvas 編輯器</h1>
          <div className="text-sm text-slate-600">
            滑鼠位置: ({currentPos.x}, {currentPos.y})
            {activeElementData && (
              <span className="ml-4 font-semibold">
                選中元素: {activeElementData.name} ({Math.round(activeElementData.x)}, {Math.round(activeElementData.y)})
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 p-8 bg-gradient-to-br from-slate-50 to-slate-100">
          <div
            ref={canvasRef}
            className="relative w-[800px] h-[480px] bg-white border-2 border-slate-300 mx-auto shadow-2xl rounded-lg"
            onClick={() => setActiveElement(null)}
          >
            {elements.map(elem => (
              <div
                key={elem.id}
                className={`absolute border-2 cursor-pointer text-sm font-medium select-none flex items-start justify-start ${
                  activeElement === elem.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
                }`}
                style={{
                  left: `${elem.x}px`,
                  top: `${elem.y}px`,
                  width: `${elem.width}px`,
                  height: `${elem.height}px`,
                  zIndex: elem.zIndex || 1,
                  ...(elem.type === 'label' && {
                    fontSize: `${Math.min(elem.fontSize, elem.height, elem.width)}px`,
                    //color: elem.color,
                    fontWeight: elem.fontWeight,
                    backgroundColor: 'transparent',
                    border: activeElement === elem.id ? '2px solid blue' : '1px dashed #ccc'
                  }),
                  ...(elem.type === 'dynamicText' && {
                    fontSize: `${Math.max(20, elem.fontSize || 20)}px`,
                    //color: elem.color,
                    fontWeight: elem.fontWeight,
                    backgroundColor: 'transparent',
                    border: activeElement === elem.id ? '2px solid blue' : '1px dashed #ccc',
                    cursor: 'move',
                    userSelect: 'none'
                  })
                }}
                onMouseDown={(e) => handleMouseDown(e, elem.id)}
              >
                {elem.type === 'image' ? (
                  <img
                    src={elem.imageUrl}
                    alt="Element"
                    //className="w-full h-full object-contain"
                    className="w-full h-full object-fill"
                    draggable={false}
                  />


                ) : elem.type === 'label' ? (
                  (() => {
                    const fontSize = Math.min(elem.fontSize, elem.width, elem.height);
                    const text = elem.text || '';
                    const isVertical = elem.textDirection === 'vertical';

                    const maxCols = Math.floor(elem.width / fontSize);
                    const maxRows = Math.floor(elem.height / fontSize);
                    const maxChars = maxCols * maxRows;
                    const chars = text.slice(0, maxChars).split('');
                    const n = chars.length;

                    const canDistributeInLine = isVertical
                      ? n <= maxRows // 垂直情況：可以在一列內放完
                      : n <= maxCols; // 水平情況：可以在一行內放完

                    if (canDistributeInLine) {
                      // 👉 可以單排平均分散
                      const availableSpace = isVertical ? elem.height : elem.width;
                      const usedSize = fontSize * n;
                      const spacing = n > 1 ? (availableSpace - usedSize) / (n - 1) : 0;
                      //console.count("🔄 Rerendered element");
                      return (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          {chars.map((char, index) => (
                            <div
                              key={index}
                              style={{
                                position: 'absolute',
                                left: isVertical ? 0 : `${index * (fontSize + spacing)}px`,
                                top: isVertical ? `${index * (fontSize + spacing)}px` : 0,
                                width: `${fontSize}px`,
                                height: `${fontSize}px`,
                                fontSize: `${fontSize}px`,
                                lineHeight: `${fontSize}px`,
                                fontWeight: elem.fontWeight,
                                //color: elem.color,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                pointerEvents: 'none', // 讓鼠標事件穿透到父元素
                              }}
                            >
                              {char}
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      // 👉 多行/多列排列
                      const horizontalSpacing = maxCols > 1 ? (elem.width - fontSize * maxCols) / (maxCols - 1) : 0;
                      const verticalSpacing = maxRows > 1 ? (elem.height - fontSize * maxRows) / (maxRows - 1) : 0;
                      return (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          {chars.map((char, index) => {
                            let row, col;
                            if (isVertical) {
                              // 縱向：按列排列
                              col = Math.floor(index / maxRows);
                              row = index % maxRows;
                            } else {
                              // 橫向：按行排列
                              row = Math.floor(index / maxCols);
                              col = index % maxCols;
                            }
                            return (
                              <div
                                key={index}
                                style={{
                                  position: 'absolute',
                                  top: `${row * (fontSize + verticalSpacing)}px`,
                                  left: `${col * (fontSize + horizontalSpacing)}px`,
                                  width: `${fontSize}px`,
                                  height: `${fontSize}px`,
                                  fontSize: `${fontSize}px`,
                                  lineHeight: `${fontSize}px`,
                                  fontWeight: elem.fontWeight,
                                  //color: elem.color,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  pointerEvents: 'none', // 讓鼠標事件穿透到父元素
                                  textAlign: 'center',
                                }}
                              >
                                {char}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  })()
                ) : elem.type === 'dynamicText' ? (
                  (() => {
                    const fontSize = Math.min(Math.max(20, elem.fontSize || 20), elem.width || 100, elem.height || 50);
                    const text = elem.text || '';
                    const isVertical = elem.textDirection === 'vertical';

                    const maxCols = Math.floor((elem.width || 100) / fontSize);
                    const maxRows = Math.floor((elem.height || 50) / fontSize);
                    const maxChars = maxCols * maxRows;
                    const chars = text.slice(0, maxChars).split('');
                    const n = chars.length;

                    const canDistributeInLine = isVertical
                      ? n <= maxRows // 垂直情況：可以在一列內放完
                      : n <= maxCols; // 水平情況：可以在一行內放完

                    if (canDistributeInLine) {
                      // 👉 可以單排平均分散
                      const availableSpace = isVertical ? (elem.height || 50) : (elem.width || 100);
                      const usedSize = fontSize * n;
                      const spacing = n > 1 ? (availableSpace - usedSize) / (n - 1) : 0;
                      //console.count("🔄 Rerendered element");
                      return (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          {chars.map((char, index) => (
                            <div
                              key={index}
                              style={{
                                position: 'absolute',
                                left: isVertical ? 0 : `${index * (fontSize + spacing)}px`,
                                top: isVertical ? `${index * (fontSize + spacing)}px` : 0,
                                width: `${fontSize}px`,
                                height: `${fontSize}px`,
                                fontSize: `${fontSize}px`,
                                lineHeight: `${fontSize}px`,
                                fontWeight: elem.fontWeight,
                                color: elem.color || 'black',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                pointerEvents: 'none', // 讓鼠標事件穿透到父元素
                              }}
                            >
                              {char}
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      // 👉 多行/多列排列（平均分散）
                      const horizontalSpacing = maxCols > 1 ? ((elem.width || 100) - fontSize * maxCols) / (maxCols - 1) : 0;
                      const verticalSpacing = maxRows > 1 ? ((elem.height || 50) - fontSize * maxRows) / (maxRows - 1) : 0;
                      return (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          {chars.map((char, index) => {
                            let row, col;
                            if (isVertical) {
                              // 縱向：按列排列
                              col = Math.floor(index / maxRows);
                              row = index % maxRows;
                            } else {
                              // 橫向：按行排列
                              row = Math.floor(index / maxCols);
                              col = index % maxCols;
                            }
                            return (
                              <div
                                key={index}
                                style={{
                                  position: 'absolute',
                                  top: `${row * (fontSize + verticalSpacing)}px`,
                                  left: `${col * (fontSize + horizontalSpacing)}px`,
                                  width: `${fontSize}px`,
                                  height: `${fontSize}px`,
                                  fontSize: `${fontSize}px`,
                                  lineHeight: `${fontSize}px`,
                                  fontWeight: elem.fontWeight,
                                  color: elem.color || 'black',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  pointerEvents: 'none', // 讓鼠標事件穿透到父元素
                                  textAlign: 'center',
                                }}
                              >
                                {char}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  })()
                ) : elem.type === 'dynamicImage' ? (
                  elem.imageUrl ? (
                    <img
                      src={elem.imageUrl}
                      alt="Dynamic Image"
                      className="w-full h-full object-fill"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 border-2 border-dashed border-gray-400 text-gray-500 text-sm">
                      尚未設定圖片
                    </div>
                  )
                ) : elem.type === 'guestQRCode' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white border-2 border-dashed border-blue-400 text-blue-600">
                    <div className="text-2xl mb-2">📱</div>
                    <div className="text-xs font-semibold text-center px-2">訪客 QR Code</div>
                    <div className="text-xs text-gray-500 mt-1">位置標記</div>
                  </div>
                ) : (
                  elem.name
                )}

                {/* Resize handle - Guest QR Code 不顯示 */}
                {activeElement === elem.id && elem.type !== 'guestQRCode' && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 cursor-se-resize rounded-tl-lg shadow-sm"></div>
                )}
              </div>
            ))}








          </div>
        </div>
      </div>



      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-96 border border-slate-200">
            <h3 className="text-xl font-bold mb-6 text-slate-800">保存佈局</h3>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-700">
                  佈局名稱:
                </label>
                {configOptions.length >= MAX_LAYOUT_COUNT && !configOptions.some(opt => opt.name === exportLayoutName.trim()) && (
                  <span className="text-xs text-red-600 font-medium">
                    已達上限 ({configOptions.length}/{MAX_LAYOUT_COUNT})
                  </span>
                )}
              </div>
              <input
                type="text"
                value={exportLayoutName}
                onChange={(e) => setExportLayoutName(e.target.value.slice(0, 20))}
                className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="輸入佈局名稱..."
                maxLength={20}
              />
              {configOptions.length >= MAX_LAYOUT_COUNT && !configOptions.some(opt => opt.name === exportLayoutName.trim()) && (
                <p className="text-xs text-red-600 mt-2">
                  佈局數量已達上限，請刪除一些佈局或使用現有佈局名稱更新
                </p>
              )}
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-6 py-3 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
              >
                取消
              </button>
              <button
                onClick={performExport}
                disabled={!exportLayoutName.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 font-semibold shadow-sm transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-96 border border-slate-200">
            <h3 className="text-xl font-bold mb-6 text-red-600">確認刪除</h3>
            <p className="text-slate-700 mb-8 text-lg">
              您確定要刪除佈局 "{currentLayoutName}" 嗎？此操作無法復原。
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-6 py-3 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 font-semibold transition-colors"
              >
                取消
              </button>
              <button
                onClick={deleteCurrentLayout}
                disabled={isDeleting}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold shadow-sm transition-colors"
              >
                {isDeleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Edit Dialog */}
      {showLabelEditDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-96 border border-slate-200">
            <h3 className="text-xl font-bold mb-6 text-slate-800">編輯文字標籤</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  名稱:
                </label>
                <input
                  type="text"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value.slice(0, 20))}
                  className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="輸入文字..."
                  maxLength={20}
                />
                {isLabelNameDuplicate && (
                  <p className="text-sm text-red-500 mt-2 font-medium">名稱已被使用，請選擇其他名稱。</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  文字內容:
                </label>
                <input
                  type="text"
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                  className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="輸入文字..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  文字方向:
                </label>
                <select
                  value={labelTextDirection}
                  onChange={(e) => setLabelTextDirection(e.target.value)}
                  className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="horizontal">水平</option>
                  <option value="vertical">垂直</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    字體大小:
                  </label>
                  <input
                    type="number"
                    value={labelFontSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 20;
                      setLabelFontSize(Math.max(20, value));
                    }}
                    className="w-full p-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="20"
                    max="72"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              {!isEditingLabelNew && (
                <button
                  onClick={() => setShowLabelEditDialog(false)}
                  className="px-6 py-3 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
                >
                  取消
                </button>
              )}
              <button
                onClick={saveLabelSettings}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm transition-colors"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {showDynamicTextDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">編輯動態文字區塊（dynamicText）</h3>

            <div className="space-y-4">
              {/* 預設文字內容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名稱:
                </label>
                <input
                  type="text"
                  value={DynamicTextName}
                  onChange={(e) => setDynamicTextName(e.target.value.slice(0, 20))}
                  className="w-full p-2 border rounded"
                  placeholder="輸入文字..."
                  maxLength={20}
                />
                {isDynamicTextDuplicate && (
                  <p className="text-sm text-red-500 mt-1">名稱已被使用，請選擇其他名稱。</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  預設文字（defaultText）:
                </label>
                <input
                  type="text"
                  value={dynamicTextDefault}
                  onChange={(e) => setDynamicTextDefault(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="請輸入預設文字..."
                />
              </div>

              {/* 字體大小與粗細 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    字體大小:
                  </label>
                  <input
                    type="number"
                    value={dynamicTextFontSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 20;
                      setDynamicTextFontSize(Math.max(20, value));
                    }}
                    className="w-full p-2 border rounded"
                    min="20"
                    max="72"
                  />
                </div>


              </div>

              {/* 顏色 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  顏色（僅支援黑 / 紅）:
                </label>
                <select
                  value={dynamicTextColor}
                  onChange={(e) => setDynamicTextColor(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="black">黑色</option>
                  <option value="red">紅色</option>
                </select>
              </div>

              {/* 文字排列方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文字排列 :
                </label>
                <select
                  value={textDirection}
                  onChange={(e) => setTextDirection(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="horizontal">水平</option>
                  <option value="vertical">垂直</option>
                </select>
              </div>


              {/* 文字距離（line-height） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  字距（letter-spacing）:
                </label>
                <input
                  type="number"
                  value={dynamicTextLetterSpacing}
                  onChange={(e) => setDynamicTextLetterSpacing(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border rounded"
                  step="1"
                  min="0"
                  max="10"
                />
              </div>
            </div>

            {/* 儲存/取消按鈕 */}
            <div className="flex justify-end gap-3 mt-6">
              {!isEditingLabelNew && (
                <button
                  onClick={() => setShowDynamicTextDialog(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  取消
                </button>
              )}
              <button
                onClick={saveDynamicSettings}
                disabled={!DynamicTextName.trim()}
                className={`px-4 py-2 rounded ${
                  DynamicTextName.trim() 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Image Edit Dialog */}
      {showDynamicImageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">編輯動態圖片</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名稱:
                </label>
                <input
                  type="text"
                  value={dynamicImageName}
                  onChange={(e) => setDynamicImageName(e.target.value.slice(0, 20))}
                  className="w-full p-2 border rounded"
                  placeholder="輸入動態圖片名稱..."
                  maxLength={20}
                />
                {isDynamicImageDuplicate && (
                  <p className="text-sm text-red-500 mt-1">名稱已被使用，請選擇其他名稱。</p>
                )}
              </div>

              {/* 圖片設定區域 - 新增和修改時都顯示 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isEditingDynamicImageNew ? '設定初始圖片:' : '設定/更換圖片:'}
                </label>
                <button
                  onClick={() => {
                    // 保存當前元素到資料庫，然後跳轉到圖片管理器
                    saveElementsToDB(elements).then(() => {
                      const currentElement = elements.find(elem => elem.id === editingDynamicImageId);
                      if (currentElement) {
                        db.saveJSON(currentElement, 'editingImage').then(() => {
                          navigate('/ImageManager');
                        });
                      }
                    });
                  }}
                  className="w-full bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  {isEditingDynamicImageNew ? '選擇圖片' : '更換圖片'}
                </button>
              </div>

              {/* 顯示當前圖片狀態 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  當前圖片狀態:
                </label>
                <div className="p-3 bg-gray-100 rounded border">
                  <p className="text-sm text-gray-600">
                    {elements.find(elem => elem.id === editingDynamicImageId)?.imageUrl 
                      ? '已設定圖片' 
                      : '尚未設定圖片'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {!isEditingDynamicImageNew && (
                <button
                  onClick={() => setShowDynamicImageDialog(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  取消
                </button>
              )}
              <button
                onClick={saveDynamicImageSettings}
                disabled={!dynamicImageName.trim()}
                className={`px-4 py-2 rounded ${
                  dynamicImageName.trim() 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Edit Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">編輯圖片</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名稱:
                </label>
                <input
                  type="text"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value.slice(0, 20))}
                  className="w-full p-2 border rounded"
                  placeholder="輸入圖片名稱..."
                  maxLength={20}
                />
                {isImageDuplicate && (
                  <p className="text-sm text-red-500 mt-1">名稱已被使用，請選擇其他名稱。</p>
                )}
              </div>

              {/* 圖片設定區域 - 新增和修改時都顯示 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isEditingImageNew ? '設定圖片:' : '更換圖片:'}
                </label>
                <button
                  onClick={() => {
                    // 先更新元素的名稱
                    const updatedElements = elements.map(elem =>
                      elem.id === editingImageId
                        ? { ...elem, name: imageName }
                        : elem
                    );
                    
                    // 保存更新後的元素到資料庫，然後跳轉到圖片管理器
                    saveElementsToDB(updatedElements).then(() => {
                      const currentElement = updatedElements.find(elem => elem.id === editingImageId);
                      if (currentElement) {
                        db.saveJSON(currentElement, 'editingImage').then(() => {
                          navigate('/ImageManager');
                        });
                      }
                    });
                  }}
                  className="w-full bg-blue-500 text-white py-2 px-3 rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <Upload size={16} />
                  {isEditingImageNew ? '選擇圖片' : '更換圖片'}
                </button>
              </div>

              {/* 顯示當前圖片狀態 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  當前圖片狀態:
                </label>
                <div className="p-3 bg-gray-100 rounded border">
                  <p className="text-sm text-gray-600">
                    {elements.find(elem => elem.id === editingImageId)?.imageUrl 
                      ? '已設定圖片' 
                      : '尚未設定圖片'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              {!isEditingImageNew && (
                <button
                  onClick={() => setShowImageDialog(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  取消
                </button>
              )}
              <button
                onClick={saveImageSettings}
                disabled={!imageName.trim()}
                className={`px-4 py-2 rounded ${
                  imageName.trim() 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}