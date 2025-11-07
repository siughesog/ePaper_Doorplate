package org.example.service;


import org.example.dto.ImageReferenceDto;
import org.example.model.DoorplateLayout;
import org.example.model.ElementStyle;
import org.example.model.ImageFile;
import org.example.repository.DoorplateLayoutRepository;
import org.example.repository.ImageFileRepository;
import org.example.service.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class ImageService {

    private final ImageFileRepository repository;
    private final DoorplateLayoutRepository layoutRepository;
    private final StorageService storageService;

    public ImageService(ImageFileRepository repository, 
                       DoorplateLayoutRepository layoutRepository,
                       StorageService storageService) {
        this.repository = repository;
        this.layoutRepository = layoutRepository;
        this.storageService = storageService;
    }

    public List<ImageFile> getAllImages() {
        return repository.findAll();
    }

    public List<ImageFile> getImagesByUserId(String userId) {
        // 只獲取屬於該用戶的圖片
        return repository.findByUserId(userId);
    }

    public ImageFile saveImage(MultipartFile file, String userId) throws IOException {
        // 1. 驗證檔案不為空
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("檔案不能為空");
        }

        // 2. 驗證檔案大小（最大 10MB）
        long maxSize = 10 * 1024 * 1024; // 10MB
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException("檔案大小超過限制（最大 10MB）");
        }

        // 3. 驗證 MIME 類型
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("只允許上傳圖片檔案。收到類型: " + contentType);
        }

        // 4. 驗證允許的圖片格式
        List<String> allowedMimeTypes = Arrays.asList(
            "image/jpeg", "image/jpg", "image/png", "image/gif", 
            "image/webp", "image/bmp", "image/svg+xml"
        );
        if (!allowedMimeTypes.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("不支援的圖片格式: " + contentType);
        }

        // 5. 驗證檔案副檔名
        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isEmpty()) {
            throw new IllegalArgumentException("檔案名稱不能為空");
        }

        String extension = "";
        if (originalName.contains(".")) {
            extension = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
        }

        List<String> allowedExtensions = Arrays.asList(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg");
        if (!extension.isEmpty() && !allowedExtensions.contains(extension)) {
            throw new IllegalArgumentException("不支援的檔案副檔名: " + extension);
        }

        // 6. 驗證檔案內容（檢查檔案魔術數字）
        if (!isValidImageFile(file)) {
            throw new IllegalArgumentException("檔案內容驗證失敗：不是有效的圖片檔案");
        }

        // 7. 保存檔案到存儲服務（本地或雲端）
        String storedFileName = UUID.randomUUID() + extension;
        String filePath;
        try {
            filePath = storageService.saveFile(file.getBytes(), storedFileName);
        } catch (Exception e) {
            throw new IOException("檔案保存失敗: " + e.getMessage(), e);
        }

        ImageFile image = new ImageFile();
        image.setName(originalName);
        image.setPath(filePath); // 使用存儲服務返回的路徑
        image.setUploadTime(Instant.now());
        image.setUserId(userId);

        return repository.save(image);
    }

    /**
     * 驗證檔案內容是否為有效的圖片格式（檢查檔案魔術數字）
     */
    private boolean isValidImageFile(MultipartFile file) throws IOException {
        byte[] header = new byte[12];
        try (InputStream is = file.getInputStream()) {
            int bytesRead = is.read(header);
            if (bytesRead < 4) {
                return false;
            }
        }

        // 檢查常見圖片格式的魔術數字
        // JPEG: FF D8 FF
        if (header[0] == (byte)0xFF && header[1] == (byte)0xD8 && header[2] == (byte)0xFF) {
            return true;
        }
        
        // PNG: 89 50 4E 47
        if (header[0] == (byte)0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47) {
            return true;
        }
        
        // GIF: 47 49 46 38 (GIF8)
        if (header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x38) {
            return true;
        }
        
        // BMP: 42 4D
        if (header[0] == 0x42 && header[1] == 0x4D) {
            return true;
        }
        
        // WebP: 需要檢查 RIFF 和 WEBP
        if (header.length >= 12) {
            if (header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46) {
                // 檢查是否包含 WEBP
                String webpCheck = new String(header, 8, 4);
                if ("WEBP".equals(webpCheck)) {
                    return true;
                }
            }
        }
        
        // SVG: 檢查是否以 <svg 或 <?xml 開頭（文字格式）
        String start = new String(header, 0, Math.min(header.length, 100));
        if (start.trim().startsWith("<svg") || start.trim().startsWith("<?xml")) {
            return true;
        }

        return false;
    }

    public void deleteImage(String id, String userId) {
        repository.findById(id).ifPresent(image -> {
            // 檢查圖片是否屬於該用戶
            if (!userId.equals(image.getUserId())) {
                throw new SecurityException("無權限刪除此圖片");
            }
            // 使用存儲服務刪除檔案
            storageService.deleteFile(image.getPath());
            repository.deleteById(id);
        });
    }

    public List<ImageReferenceDto> getImageReferences(String imageId) {
        List<ImageReferenceDto> references = new ArrayList<>();
        
        // 查找所有包含該圖片的layout
        List<DoorplateLayout> allLayouts = layoutRepository.findAll();
        
        for (DoorplateLayout layout : allLayouts) {
            if (layout.getElements() != null) {
                for (ElementStyle element : layout.getElements()) {
                    // 檢查普通圖片元素
                    if ("image".equals(element.getType()) && imageId.equals(element.getImageId())) {
                        references.add(new ImageReferenceDto(
                            layout.getId(),
                            layout.getLayoutName(),
                            layout.getUserId()
                        ));
                        break; // 每個layout只需要添加一次
                    }
                    // 檢查動態圖片元素（dynamicImage 也使用 imageId 字段存儲原始圖片ID）
                    if ("dynamicImage".equals(element.getType()) && imageId.equals(element.getImageId())) {
                        references.add(new ImageReferenceDto(
                            layout.getId(),
                            layout.getLayoutName(),
                            layout.getUserId()
                        ));
                        break; // 每個layout只需要添加一次
                    }
                }
            }
        }
        
        return references;
    }

    /**
     * 獲取圖片輸入流（用於代理圖片請求）
     * @param fileName 文件名（例如：xxx.webp）
     * @return 圖片輸入流
     * @throws Exception 如果圖片不存在或讀取失敗
     */
    public InputStream getImageInputStream(String fileName) throws Exception {
        // 處理路徑格式：統一轉換為存儲服務可識別的格式
        // fileName 可能是：xxx.webp
        
        // 首先嘗試從數據庫查找圖片，使用實際存儲的路徑
        // 這樣可以確保使用正確的 S3 key 或本地路徑
        List<ImageFile> images = repository.findByPathContaining(fileName);
        
        String actualPath = null;
        ImageFile matchedImage = null;
        
        if (!images.isEmpty()) {
            // 精確匹配：找到路徑以該文件名結尾的圖片
            for (ImageFile image : images) {
                String path = image.getPath();
                // 檢查路徑是否以該文件名結尾（支持多種格式）
                if (path.endsWith(fileName) || 
                    path.endsWith("/" + fileName) || 
                    path.endsWith("images/" + fileName) ||
                    path.endsWith("/images/" + fileName)) {
                    actualPath = path;
                    matchedImage = image;
                    break;
                }
            }
            // 如果沒有精確匹配，使用第一個匹配的
            if (actualPath == null && !images.isEmpty()) {
                actualPath = images.get(0).getPath();
                matchedImage = images.get(0);
            }
        }
        
        // 如果數據庫中找不到，使用文件名構建標準路徑
        // StorageService 會根據存儲類型處理：
        // - S3StorageService: 添加 "images/" 前綴 → "images/xxx.webp"
        // - LocalStorageService: 移除 "images/" 前綴 → "uploads/xxx.webp"
        if (actualPath == null) {
            // 構建標準路徑格式：images/xxx.webp
            actualPath = "images/" + fileName;
            System.out.println("⚠️ 數據庫中未找到圖片，使用構建的路徑: " + actualPath);
        } else {
            System.out.println("✅ 從數據庫找到圖片:");
            System.out.println("   - 圖片ID: " + (matchedImage != null ? matchedImage.getId() : "N/A"));
            System.out.println("   - 存儲路徑: " + actualPath);
        }
        
        // 先檢查文件是否存在（避免不必要的異常）
        if (!storageService.fileExists(actualPath)) {
            System.err.println("❌ 圖片文件不存在:");
            System.err.println("   - 請求的文件名: " + fileName);
            System.err.println("   - 使用的路徑: " + actualPath);
            if (matchedImage != null) {
                System.err.println("   - 數據庫記錄ID: " + matchedImage.getId());
                System.err.println("   - 數據庫記錄路徑: " + matchedImage.getPath());
            }
            throw new IOException("圖片文件不存在: " + actualPath);
        }
        
        // 使用實際存儲的路徑從存儲服務獲取圖片流
        return storageService.getFileInputStream(actualPath);
    }

    /**
     * 獲取圖片內容類型（用於設置HTTP響應頭）
     * @param fileName 文件名
     * @return MIME類型
     */
    public String getImageContentType(String fileName) {
        if (fileName == null) {
            return "application/octet-stream";
        }
        
        String extension = "";
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0 && lastDot < fileName.length() - 1) {
            extension = fileName.substring(lastDot + 1).toLowerCase();
        }
        
        switch (extension) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            case "webp":
                return "image/webp";
            case "bmp":
                return "image/bmp";
            case "svg":
                return "image/svg+xml";
            default:
                return "application/octet-stream";
        }
    }
}
