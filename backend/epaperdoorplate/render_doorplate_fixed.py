#!/usr/bin/env python3
"""
門牌模板渲染器 - 修復版本
完全按照獨立腳本的邏輯處理圖片
"""

import argparse
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont
import requests
import base64
import io
import numpy as np
from typing import List, Dict, Any, Tuple
import urllib3
try:
    import qrcode
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False
    print("警告: qrcode 庫未安裝，Guest QR Code 功能將不可用")

# 禁用SSL警告（僅用於本地開發環境）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class DoorplateRenderer:
    def __init__(self, width: int = 800, height: int = 480):
        self.width = width
        self.height = height
        self.canvas = Image.new('RGB', (width, height), 'white')
        self.draw = ImageDraw.Draw(self.canvas)
        self.elements_data = []  # 存儲元素數據
        
        # 嘗試載入字體（支持 Windows 和 Linux）
        # 優先使用支持中文的字體
        try:
            # 中文字體路徑（優先）
            chinese_font_paths = [
                # Linux 中文字體（優先）
                "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",  # Noto Sans CJK
                "/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc",  # Noto Serif CJK
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",  # Noto Sans CJK (OpenType)
                "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",  # 文泉驛微米黑
                "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",  # 文泉驛正黑
                # Windows 中文字體
                "C:/Windows/Fonts/msyh.ttc",  # 微軟雅黑
                "C:/Windows/Fonts/simsun.ttc",  # 宋體
                "C:/Windows/Fonts/simhei.ttf",  # 黑體
            ]
            
            # 備用字體（不支持中文，僅在找不到中文字體時使用）
            fallback_font_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # DejaVu Sans
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",  # Liberation Sans
            ]
            
            self.default_font = None
            
            # 首先嘗試加載中文字體
            for font_path in chinese_font_paths:
                if os.path.exists(font_path):
                    try:
                        # 測試字體是否可以正常加載，並測試是否支持中文
                        test_font = ImageFont.truetype(font_path, 12)
                        # 測試字體是否支持中文字符
                        test_text = "中"
                        try:
                            # 嘗試獲取字符的邊界框，如果成功則說明字體支持中文
                            bbox = test_font.getbbox(test_text)
                            if bbox[2] > bbox[0] and bbox[3] > bbox[1]:  # 有寬度和高度
                                self.default_font = font_path
                                print(f"✅ 成功加載中文字體: {font_path}")
                                break
                        except:
                            # 如果測試失敗，繼續下一個字體
                            continue
                    except Exception as e:
                        print(f"⚠️ 字體加載失敗 {font_path}: {e}")
                        continue
            
            # 如果沒有找到中文字體，使用備用字體
            if not self.default_font:
                print("⚠️ 未找到中文字體，嘗試使用備用字體（可能不支持中文）")
                for font_path in fallback_font_paths:
                    if os.path.exists(font_path):
                        try:
                            test_font = ImageFont.truetype(font_path, 12)
                            self.default_font = font_path
                            print(f"⚠️ 使用備用字體（不支持中文）: {font_path}")
                            break
                        except Exception as e:
                            print(f"⚠️ 備用字體加載失敗 {font_path}: {e}")
                            continue
                            
        except Exception as e:
            print(f"❌ 字體初始化錯誤: {e}")
            self.default_font = None
    
    def get_font(self, size: int) -> ImageFont.FreeTypeFont:
        """獲取指定大小的字體"""
        try:
            if self.default_font:
                return ImageFont.truetype(self.default_font, size)
            else:
                # 如果沒有找到字體，嘗試使用系統默認字體
                # 對於中文，嘗試查找 Noto 或文泉驛字體
                chinese_fonts = [
                    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
                    "/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc",
                    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
                    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
                ]
                for font_path in chinese_fonts:
                    if os.path.exists(font_path):
                        try:
                            font = ImageFont.truetype(font_path, size)
                            print(f"✅ 動態加載中文字體: {font_path}")
                            return font
                        except Exception as e:
                            print(f"⚠️ 動態字體加載失敗 {font_path}: {e}")
                            continue
                # 最後回退到默認字體（不支持中文）
                print("❌ 警告: 未找到中文字體，中文可能無法正確顯示（將顯示為方塊）")
                return ImageFont.load_default()
        except Exception as e:
            print(f"❌ 字體加載錯誤: {e}")
            return ImageFont.load_default()
    
    def hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """將十六進制顏色轉換為RGB"""
        if hex_color.startswith('#'):
            hex_color = hex_color[1:]
        elif hex_color.lower() in ['black', 'red', 'white']:
            color_map = {'black': '000000', 'red': 'ff0000', 'white': 'ffffff'}
            hex_color = color_map[hex_color.lower()]
        
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def process_image_with_params(self, image_path: str, black_threshold: int, 
                                white_threshold: int, contrast: float, target_width: int = None, target_height: int = None) -> Image.Image:
        """處理圖片 - 完全按照獨立腳本邏輯"""
        try:
            print(f"開始處理圖片: {image_path}")
            print(f"參數 - 黑閾值: {black_threshold}, 白閾值: {white_threshold}, 對比度: {contrast}")
            
            # 載入圖片
            if image_path.startswith('data:'):
                header, data = image_path.split(',', 1)
                img = Image.open(io.BytesIO(base64.b64decode(data)))
            elif image_path.startswith('http'):
                # 如果是 localhost 或 127.0.0.1，禁用 SSL 驗證（自簽名證書）
                verify_ssl = True
                if 'localhost' in image_path or '127.0.0.1' in image_path:
                    verify_ssl = False
                    print(f"檢測到本地地址，禁用 SSL 驗證")
                
                response = requests.get(image_path, verify=verify_ssl)
                img = Image.open(io.BytesIO(response.content))
            else:
                # 首先嘗試直接訪問本地文件
                # 正確路徑應該是 backend/epaperdoorplate/uploads/
                # 因為 Python 腳本的工作目錄是 backend 目錄（由 Java 設置）
                local_path = None
                
                # 獲取腳本所在目錄，用於確定正確的相對路徑
                script_dir = os.path.dirname(os.path.abspath(__file__))
                # 獲取當前工作目錄（由 Java 設置）
                cwd = os.getcwd()
                # 從環境變數獲取 uploads 目錄路徑
                uploads_dir = os.environ.get('UPLOADS_DIR', '')
                
                print(f"腳本目錄: {script_dir}")
                print(f"當前工作目錄: {cwd}")
                print(f"環境變數 UPLOADS_DIR: {uploads_dir}")
                print(f"圖片路徑: {image_path}")
                
                # 提取文件名
                filename = None
                if image_path.startswith('/images/'):
                    filename = image_path[8:]  # 移除 /images/
                elif image_path.startswith('images/'):
                    filename = image_path[7:]  # 移除 images/
                else:
                    filename = image_path
                
                print(f"提取的文件名: {filename}")
                
                # 構建可能的路徑列表
                possible_paths = []
                
                # 1. 如果設置了 UPLOADS_DIR 環境變數，優先使用
                if uploads_dir and uploads_dir.strip():
                    possible_paths.append(os.path.join(uploads_dir, filename))
                    print(f"添加環境變數路徑: {os.path.join(uploads_dir, filename)}")
                
                # 2. 嘗試從當前工作目錄查找
                possible_paths.extend([
                    os.path.join(cwd, "epaperdoorplate", "uploads", filename),
                    os.path.join(cwd, "uploads", filename),
                ])
                
                # 3. 嘗試從腳本目錄查找
                possible_paths.extend([
                    os.path.join(script_dir, "epaperdoorplate", "uploads", filename),
                    os.path.join(script_dir, "uploads", filename),
                    os.path.join(os.path.dirname(script_dir), "epaperdoorplate", "uploads", filename),
                ])
                
                # 4. 嘗試絕對路徑（如果 image_path 本身是絕對路徑）
                if os.path.isabs(image_path):
                    possible_paths.append(image_path)
                
                # 打印所有嘗試的路徑
                print(f"嘗試查找以下路徑:")
                for i, path in enumerate(possible_paths, 1):
                    exists = os.path.exists(path)
                    print(f"  {i}. {path} {'✅ 存在' if exists else '❌ 不存在'}")
                
                # 嘗試第一個存在的路徑
                for path in possible_paths:
                    if os.path.exists(path):
                        local_path = path
                        break
                
                if local_path:
                    img = Image.open(local_path)
                    print(f"✅ 成功載入本地圖片: {local_path}")
                elif os.path.exists(image_path):
                    img = Image.open(image_path)
                    print(f"✅ 成功載入本地圖片（直接路徑）: {image_path}")
                else:
                    # 嘗試從後端 API 下載
                    try:
                        # 從環境變數獲取後端 URL，如果沒有則使用默認值
                        # 在本地開發時使用 localhost，在云端部署時使用 127.0.0.1 或環境變數
                        api_base_url = os.environ.get('API_BASE_URL', 'http://127.0.0.1:8080')
                        # 如果環境變數是空字符串，使用默認值
                        if not api_base_url or api_base_url.strip() == '':
                            api_base_url = 'http://127.0.0.1:8080'
                        
                        # 構建完整的圖片 URL
                        if image_path.startswith('/images/'):
                            api_url = f"{api_base_url}{image_path}"
                        elif image_path.startswith('images/'):
                            api_url = f"{api_base_url}/{image_path}"
                        else:
                            api_url = f"{api_base_url}/images/{image_path}"
                        
                        print(f"嘗試從 API 下載圖片: {api_url}")
                        # 如果是 localhost 或 127.0.0.1，禁用 SSL 驗證（自簽名證書）
                        verify_ssl = True
                        if 'localhost' in api_url or '127.0.0.1' in api_url:
                            verify_ssl = False
                            print(f"檢測到本地地址，禁用 SSL 驗證")
                        
                        response = requests.get(api_url, timeout=10, verify=verify_ssl)
                        response.raise_for_status()  # 如果狀態碼不是 200，會拋出異常
                        img = Image.open(io.BytesIO(response.content))
                        print(f"✅ 從 API 下載圖片成功: {api_url}")
                    except Exception as e:
                        print(f"❌ 從 API 下載失敗: {e}")
                        print(f"   嘗試的 URL: {api_url if 'api_url' in locals() else 'N/A'}")
                        # 創建錯誤圖片
                        img = Image.new('RGB', (100, 100), 'red')
                        draw = ImageDraw.Draw(img)
                        draw.text((10, 10), "NO IMAGE", fill='white')
            
            # 轉換為RGB，自動填充透明背景為白色
            img = img.convert('RGB')
            
            # 檢查圖片尺寸限制（與前端一致）
            MAX_WIDTH = 800
            MAX_HEIGHT = 480
            
            # 如果沒有指定目標尺寸，檢查是否需要等比例縮放
            if not target_width and not target_height:
                if img.width > MAX_WIDTH or img.height > MAX_HEIGHT:
                    width_ratio = MAX_WIDTH / img.width
                    height_ratio = MAX_HEIGHT / img.height
                    scale = min(width_ratio, height_ratio)
                    target_width = int(img.width * scale)
                    target_height = int(img.height * scale)
                    print(f"圖片超出限制，等比例縮放: {img.width}x{img.height} -> {target_width}x{target_height}")
            
            # 先縮放到目標尺寸（與前端一致）
            if target_width and target_height:
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                print(f"縮放後圖片尺寸: {img.size}")
            
            arr = np.array(img).astype(np.float32)
            gray = np.dot(arr[...,:3], [0.299, 0.587, 0.114])
            
            print(f"灰階轉換後 - 值範圍: {gray.min():.2f} - {gray.max():.2f}")
            
            # 對比度調整（與前端一致，使用 gamma 校正）
            if contrast != 1.0:
                gray = 255 * np.power(gray / 255, 1 / contrast)
                gray = np.clip(gray, 0, 255)
                print(f"對比度處理後 - 值範圍: {gray.min():.2f} - {gray.max():.2f}")
            
            # 三色遮罩（與前端ImageManager.jsx完全一致）
            mask_black = gray < black_threshold
            mask_white = gray > white_threshold  # 使用 > 與ImageManager.jsx一致
            mask_red = (gray >= black_threshold) & (gray <= white_threshold)
            
            print(f"黑色像素數量: {np.sum(mask_black)}")
            print(f"白色像素數量: {np.sum(mask_white)}")
            print(f"紅色像素數量: {np.sum(mask_red)}")
            
            # 建立結果（像獨立腳本一樣）
            result = np.zeros_like(arr)
            result[mask_black] = [0, 0, 0]
            result[mask_white] = [255, 255, 255]
            result[mask_red] = [255, 0, 0]
            
            processed_img = Image.fromarray(result.astype(np.uint8))
            
            return processed_img
            
        except Exception as e:
            print(f"處理圖片失敗: {e}")
            error_img = Image.new('RGB', (100, 100), 'red')
            draw = ImageDraw.Draw(error_img)
            draw.text((10, 10), "ERROR", fill='white')
            return error_img
    
    def render_text_element(self, element: Dict[str, Any]) -> None:
        """渲染文字元素"""
        x = int(element.get('x', 0))
        y = int(element.get('y', 0))
        width = int(element.get('width', 200))
        height = int(element.get('height', 40))
        text = element.get('text', '')
        fontSize = int(element.get('fontSize', 16))
        color = element.get('color', '#000000')
        textDirection = element.get('textDirection', 'horizontal')
        
        rgb_color = self.hex_to_rgb(color)
        fontSize = min(fontSize, width, height)
        
        maxCols = width // fontSize
        maxRows = height // fontSize
        maxChars = maxCols * maxRows
        
        chars = list(text[:maxChars])
        
        isVertical = textDirection == 'vertical'
        
        # 判斷是否可以單行/單列排列
        canDistributeInLine = isVertical and len(chars) <= maxRows or not isVertical and len(chars) <= maxCols
        
        if canDistributeInLine:
            # 單行/單列平均分散
            if isVertical:
                # 縱向：單列排列
                availableSpace = height
                usedSize = fontSize * len(chars)
                spacing = (availableSpace - usedSize) / (len(chars) - 1) if len(chars) > 1 else 0
                for i, char in enumerate(chars):
                    char_x = x
                    char_y = y + i * (fontSize + spacing)
                    font = self.get_font(fontSize)
                    self.draw.text((char_x, char_y), char, font=font, fill=rgb_color)
            else:
                # 橫向：單行排列
                availableSpace = width
                usedSize = fontSize * len(chars)
                spacing = (availableSpace - usedSize) / (len(chars) - 1) if len(chars) > 1 else 0
                for i, char in enumerate(chars):
                    char_x = x + i * (fontSize + spacing)
                    char_y = y
                    font = self.get_font(fontSize)
                    self.draw.text((char_x, char_y), char, font=font, fill=rgb_color)
        else:
            # 多行/多列排列
            horizontalSpacing = (width - fontSize * maxCols) / (maxCols - 1) if maxCols > 1 else 0
            verticalSpacing = (height - fontSize * maxRows) / (maxRows - 1) if maxRows > 1 else 0
            
            for i, char in enumerate(chars):
                if isVertical:
                    # 縱向：按列排列
                    col = i // maxRows
                    row = i % maxRows
                else:
                    # 橫向：按行排列
                    row = i // maxCols
                    col = i % maxCols
                
                char_x = x + col * (fontSize + horizontalSpacing)
                char_y = y + row * (fontSize + verticalSpacing)
                
                
                font = self.get_font(fontSize)
                self.draw.text((char_x, char_y), char, font=font, fill=rgb_color)
    
    def render_image_element(self, element: Dict[str, Any]) -> None:
        """渲染圖片元素"""
        x = int(element.get('x', 0))
        y = int(element.get('y', 0))
        width = int(element.get('width', 200))
        height = int(element.get('height', 150))
        
        image_url = element.get('imageUrl', '')
        content = element.get('content', '')
        image_id = element.get('imageId', '')  # 也檢查 imageId 字段
        black_threshold = int(element.get('blackThreshold', 128))
        white_threshold = int(element.get('whiteThreshold', 128))
        contrast = float(element.get('contrast', 1.0))
        
        print(f"渲染圖片元素: x={x}, y={y}, w={width}, h={height}")
        print(f"imageUrl: {image_url}")
        print(f"content: {content}")
        print(f"imageId: {image_id}")
        print(f"處理參數 - 黑閾值: {black_threshold}, 白閾值: {white_threshold}, 對比度: {contrast}")
        
        # 優先使用 imageUrl，如果沒有則使用 content，最後嘗試 imageId
        image_path = None
        if image_url and image_url.strip() and image_url != 'null':
            image_path = image_url.strip()
            print(f"使用 imageUrl: {image_path}")
        elif content and content.strip() and content != 'null':
            image_path = content.strip()
            print(f"使用 content: {image_path}")
        elif image_id and image_id.strip() and image_id != 'null':
            # 如果只有 imageId，構建路徑
            image_path = f"/images/{image_id}"
            print(f"使用 imageId 構建路徑: {image_path}")
        
        if not image_path:
            print("錯誤: 沒有有效的圖片路徑（imageUrl、content 和 imageId 都為空）")
            self.draw.rectangle([x, y, x + width, y + height], outline='red', width=2)
            self.draw.text((x + 5, y + 5), "NO IMAGE", fill='red')
            return
        
        if image_path:
            try:
                # 處理圖片（先應用尺寸限制，再縮放到模板元素尺寸）
                # 第一步：應用 800x480 限制
                processed_img = self.process_image_with_params(
                    image_path, black_threshold, white_threshold, contrast
                )
                
                # 第二步：縮放到模板元素的尺寸（使用NEAREST保持三色）
                if processed_img.size != (width, height):
                    processed_img = processed_img.resize((width, height), Image.Resampling.NEAREST)
                    print(f"縮放到模板元素尺寸: {processed_img.size} -> {width}x{height}")
                
                print(f"處理後圖片尺寸: {processed_img.size}")
                print(f"目標渲染尺寸: {width}x{height}")
                
                # 直接貼到畫布上（已經縮放到正確尺寸）
                self.canvas.paste(processed_img, (x, y))
                
            except Exception as e:
                print(f"渲染圖片元素失敗: {e}")
                self.draw.rectangle([x, y, x + width, y + height], outline='red', width=2)
    
    def render_qr_element(self, element: Dict[str, Any]) -> None:
        """渲染QR碼元素"""
        x = int(element.get('x', 0))
        y = int(element.get('y', 0))
        width = int(element.get('width', 100))
        height = int(element.get('height', 100))
        content = element.get('content', 'QR Code')
        
        self.draw.rectangle([x, y, x + width, y + height], outline='black', width=2)
        font = self.get_font(12)
        self.draw.text((x + 5, y + height - 20), content, font=font, fill='black')
    
    def render_guest_qr_code_element(self, element: Dict[str, Any]) -> None:
        """渲染 Guest QR Code 元素（真正的 QR code）"""
        if not QRCODE_AVAILABLE:
            print("❌ qrcode 庫未安裝，無法生成 Guest QR Code")
            x = int(element.get('x', 0))
            y = int(element.get('y', 0))
            width = int(element.get('width', 150))
            height = int(element.get('height', 150))
            self.draw.rectangle([x, y, x + width, y + height], outline='red', width=2)
            self.draw.text((x + 5, y + 5), "QR CODE\nNOT AVAILABLE", fill='red')
            return
        
        x = int(element.get('x', 0))
        y = int(element.get('y', 0))
        # Guest QR Code 固定大小（150x150 或以下）
        width = min(int(element.get('width', 150)), 150)
        height = min(int(element.get('height', 150)), 150)
        
        # 從元素中獲取 token
        token = element.get('guestQRCodeToken', '')
        print(f"🔍 Guest QR Code 元素資訊:")
        print(f"   元素 ID: {element.get('id', 'unknown')}")
        print(f"   位置: x={x}, y={y}")
        print(f"   大小: {width}x{height}")
        print(f"   Token: {token if token else 'MISSING'}")
        print(f"   元素所有鍵: {list(element.keys())}")
        
        if not token:
            print("❌ Guest QR Code 元素缺少 token")
            print(f"   元素完整內容: {element}")
            self.draw.rectangle([x, y, x + width, y + height], outline='red', width=2)
            self.draw.text((x + 5, y + 5), "NO TOKEN", fill='red')
            return
        
        # 從環境變數獲取 API 基礎 URL（應該是公開 URL，訪客可以訪問）
        api_base_url = os.environ.get('API_BASE_URL', 'http://127.0.0.1:8080')
        
        # 構建 QR code URL（指向 Guest 留言頁面）
        # 注意：URL 應該是公開的，不能是 localhost 或 127.0.0.1
        qr_url = f"{api_base_url}/api/guest/message-page?token={token}"
        print(f"生成 Guest QR Code URL: {qr_url}")
        
        # 檢查 URL 是否為本地地址（警告）
        if 'localhost' in api_base_url or '127.0.0.1' in api_base_url:
            print("⚠️ 警告: API_BASE_URL 是本地地址，Guest QR Code 可能無法從外部訪問")
            print("   請設置 PUBLIC_API_URL 環境變數為公開域名，例如: https://your-backend.railway.app")
        
        try:
            # 創建 QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=2,
            )
            qr.add_data(qr_url)
            qr.make(fit=True)
            
            # 生成 QR code 圖片（黑白）
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # 調整大小到指定尺寸
            qr_img = qr_img.resize((width, height), Image.Resampling.LANCZOS)
            
            # 將 QR code 繪製到畫布上
            self.canvas.paste(qr_img, (x, y))
            print(f"✅ Guest QR Code 已繪製到位置 ({x}, {y}), 大小 {width}x{height}")
            
        except Exception as e:
            print(f"❌ 生成 Guest QR Code 失敗: {e}")
            self.draw.rectangle([x, y, x + width, y + height], outline='red', width=2)
            self.draw.text((x + 5, y + 5), "QR ERROR", fill='red')
    
    def render_barcode_element(self, element: Dict[str, Any]) -> None:
        """渲染條碼元素"""
        x = int(element.get('x', 0))
        y = int(element.get('y', 0))
        width = int(element.get('width', 200))
        height = int(element.get('height', 50))
        content = element.get('content', 'Barcode')
        
        self.draw.rectangle([x, y, x + width, y + height], outline='black', width=2)
        font = self.get_font(12)
        self.draw.text((x + 5, y + height - 20), content, font=font, fill='black')
    
    def render_elements(self, elements: List[Dict[str, Any]]) -> None:
        """渲染所有元素"""
        self.elements_data = elements  # 存儲元素數據供 bitmap 轉換使用
        sorted_elements = sorted(elements, key=lambda e: e.get('zIndex', 1))
        
        for element in sorted_elements:
            element_type = element.get('type', '')
            
            print(f"渲染元素: {element_type} - {element.get('name', '')}")
            
            try:
                if element_type in ['label', 'dynamicText', 'text']:
                    print(f"渲染文字元素: {element.get('text', '')}")
                    self.render_text_element(element)
                elif element_type in ['image', 'dynamicImage']:
                    print(f"渲染圖片元素: {element.get('content', '')}")
                    self.render_image_element(element)
                elif element_type == 'guestQRCode':
                    print(f"渲染 Guest QR Code 元素")
                    self.render_guest_qr_code_element(element)
                elif element_type == 'qr':
                    self.render_qr_element(element)
                elif element_type == 'barcode':
                    self.render_barcode_element(element)
                else:
                    print(f"未知元素類型: {element_type}")
                    
            except Exception as e:
                print(f"渲染元素失敗 {element.get('id', 'unknown')}: {e}")
    
    def save_image(self, output_path: str) -> None:
        """保存圖片為 BMP 格式並生成 bitmap.bin"""
        # 確保輸出路徑是 .bmp 格式
        if not output_path.endswith('.bmp'):
            output_path = output_path.rsplit('.', 1)[0] + '.bmp'
        
        self.canvas.save(output_path, 'BMP')
        print(f"門牌圖片已保存到: {output_path}")
        
        # 同時生成 PNG 預覽（可選）
        png_path = output_path.rsplit('.', 1)[0] + '.png'
        self.canvas.save(png_path, 'PNG')
        print(f"PNG 預覽已保存到: {png_path}")
        
        # 生成 bitmap.bin 文件
        self.generate_bitmap_bin(output_path, self.elements_data)
    
    def generate_bitmap_bin(self, bmp_path: str, elements: list) -> None:
        """將 BMP 圖片轉換為 bitmap.bin 格式"""
        try:
            import numpy as np
            
            # 讀取 BMP 圖片
            img = Image.open(bmp_path).convert("RGB")
            pixels = np.array(img)
            h, w = pixels.shape[:2]
            
            print(f"開始轉換 BMP 到 bitmap.bin: {w}x{h}")
            
            # 計算灰階值（用於處理抗鋸齒）
            gray = np.dot(pixels[...,:3], [0.299, 0.587, 0.114])
            
            print(f"BMP 像素值範圍: R={pixels[:,:,0].min()}-{pixels[:,:,0].max()}, G={pixels[:,:,1].min()}-{pixels[:,:,1].max()}, B={pixels[:,:,2].min()}-{pixels[:,:,2].max()}")
            print(f"灰階值範圍: {gray.min():.2f}-{gray.max():.2f}")
            
            # 使用閾值來處理抗鋸齒的灰色像素
            # 閾值：灰階 < 128 視為黑色，>= 128 視為白色
            # 對於紅色：R 明顯高於 G 和 B，且 G 和 B 都較低
            gray_threshold = 128
            
            # 判斷紅色：R 值高，且 G 和 B 都低（允許一些抗鋸齒誤差）
            # 紅色判斷條件（更嚴格）：
            # 1. 接近純紅色：R > 200 且 G < 100 且 B < 100
            # 2. 紅色與白色混合的邊緣：R 明顯高於 G 和 B，且 G 和 B 都較低（避免誤判橙色/棕色）
            #    條件：R > G + 30 且 R > B + 30 且 R > 180 且 G < 120 且 B < 120
            red_mask_condition1 = (pixels[:,:,0] > 200) & (pixels[:,:,1] < 100) & (pixels[:,:,2] < 100)
            red_mask_condition2 = (pixels[:,:,0] > pixels[:,:,1] + 30) & (pixels[:,:,0] > pixels[:,:,2] + 30) & (pixels[:,:,0] > 180) & (pixels[:,:,1] < 120) & (pixels[:,:,2] < 120)
            red_mask = red_mask_condition1 | red_mask_condition2
            
            # 對於非紅色像素，根據灰階值判斷黑色或白色
            # 黑色：灰階 < 閾值
            # 白色：灰階 >= 閾值
            non_red_mask = ~red_mask
            black_mask = non_red_mask & (gray < gray_threshold)
            white_mask = non_red_mask & (gray >= gray_threshold)
            
            print(f"分層結果: 黑色={np.sum(black_mask)}, 紅色={np.sum(red_mask)}, 白色={np.sum(white_mask)}")
            print(f"未分類像素: {h*w - np.sum(black_mask) - np.sum(red_mask) - np.sum(white_mask)}")
            
            black_layer = black_mask.astype(np.uint8)
            red_layer = red_mask.astype(np.uint8)
            
            # 轉成每8像素1 byte
            def layer_to_bytes(layer):
                bytes_arr = []
                for y in range(h):
                    for x in range(0, w, 8):
                        byte = 0
                        for bit in range(8):
                            if x + bit < w and layer[y, x + bit]:
                                byte |= (1 << (7 - bit))
                        bytes_arr.append(byte)
                return bytes_arr
            
            bitmap1 = layer_to_bytes(black_layer)
            bitmap2 = layer_to_bytes(red_layer)
            
            print(f"黑色像素 (bitmap1): {len(bitmap1)} bytes")
            print(f"紅色像素 (bitmap2): {len(bitmap2)} bytes")
            
            # 按 800 bytes 塊大小交錯合併
            block_size = 800
            combined_bytes = []
            pos = 0
            max_len = max(len(bitmap1), len(bitmap2))
            while pos < max_len:
                combined_bytes.extend(bitmap1[pos:pos + block_size])
                combined_bytes.extend(bitmap2[pos:pos + block_size])
                pos += block_size
            
            # 生成 bin 文件路徑
            bin_path = bmp_path.rsplit('.', 1)[0] + '.bin'
            
            # 輸出 bin 文件
            with open(bin_path, "wb") as f:
                f.write(bytearray(combined_bytes))
            
            print(f"bitmap.bin 已生成: {bin_path}，長度: {len(combined_bytes)} bytes")
            
        except Exception as e:
            print(f"生成 bitmap.bin 失敗: {e}")

def main():
    parser = argparse.ArgumentParser(description='門牌模板渲染器 - 修復版本')
    parser.add_argument('--input', required=True, help='輸入JSON文件路徑')
    parser.add_argument('--output', required=True, help='輸出BMP文件路徑')
    parser.add_argument('--width', type=int, default=800, help='畫布寬度')
    parser.add_argument('--height', type=int, default=480, help='畫布高度')
    
    args = parser.parse_args()
    
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        elements = data.get('elements', [])
        
        if not elements:
            print("警告: 沒有找到元素數據")
        
        renderer = DoorplateRenderer(args.width, args.height)
        renderer.render_elements(elements)
        renderer.save_image(args.output)
        
        print("渲染完成!")
        
    except Exception as e:
        print(f"渲染失敗: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
