export const processAndStoreImage = (imageUrl, threshold = 128, callback) => {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    const MAX_WIDTH = 800;
    const MAX_HEIGHT = 480;

    let targetWidth = img.width;
    let targetHeight = img.height;

    if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
      const widthRatio = MAX_WIDTH / img.width;
      const heightRatio = MAX_HEIGHT / img.height;
      const scale = Math.min(widthRatio, heightRatio);
      targetWidth = Math.floor(img.width * scale);
      targetHeight = Math.floor(img.height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;

    // 灰階 + 二值化
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      const binary = gray >= threshold ? 255 : 0;
      data[i] = binary;
      data[i+1] = binary;
      data[i+2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);
    const base64 = canvas.toDataURL();

    // 讀取 sessionStorage
    let elements = [];
    try {
      const elementsStr = sessionStorage.getItem('elementsData');
      if (elementsStr) {
        elements = JSON.parse(elementsStr);
      }
    } catch (e) {
      console.error('無法解析 elementsData', e);
    }

    // ✅ 檢查是否已有相同圖片（比對 imageUrl 或 base64）
    const existingIndex = elements.findIndex(el =>
      el.type === 'image' &&
      (el.imageUrl === base64 || el.srcImageUrl === imageUrl)
    );

    const newImageElement = {
      id: existingIndex !== -1 ? elements[existingIndex].id : `elem-${Date.now()}`,
      type: 'image',
      x: 10,
      y: 10,
      width: 200,
      height: 150,
      imageUrl: base64,
      srcImageUrl: imageUrl,
      srcThreshold: threshold,
    };

    if (existingIndex !== -1) {
      elements[existingIndex] = newImageElement; // 覆蓋
    } else {
      elements.push(newImageElement); // 新增
    }

    sessionStorage.setItem('elementsData', JSON.stringify(elements));

    if (typeof callback === 'function') {
      callback(null, newImageElement);
    }
  };

  img.onerror = () => {
    if (typeof callback === 'function') {
      callback(new Error('圖片加載失敗'), null);
    }
  };

  img.src = imageUrl;
};
