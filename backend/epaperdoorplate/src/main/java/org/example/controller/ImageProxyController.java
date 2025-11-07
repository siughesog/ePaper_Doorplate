package org.example.controller;

import org.example.service.ImageService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.io.InputStream;

/**
 * 圖片代理控制器
 * 處理 /images/** 路徑的請求，從存儲服務（本地或S3）讀取圖片並返回
 */
@RestController
public class ImageProxyController {

    private final ImageService imageService;

    public ImageProxyController(ImageService imageService) {
        this.imageService = imageService;
    }

    /**
     * 代理圖片請求 - 處理 /images/** 路徑
     * 從存儲服務（本地或S3）讀取圖片並返回
     * 這個Controller會優先於靜態資源映射，統一處理所有圖片請求
     */
    @GetMapping("/images/**")
    public ResponseEntity<InputStreamResource> serveImage(HttpServletRequest request) {
        try {
            // 從請求URI中提取圖片路徑
            // 例如：/images/1d1b7f09-eeac-450a-b8df-0265d2396225.webp
            String requestURI = request.getRequestURI();
            
            // 移除 /images/ 前綴，獲取文件名
            String imagePath = requestURI;
            if (imagePath.startsWith("/images/")) {
                imagePath = imagePath.substring(8); // 移除 "/images/" (8個字符)
            } else if (imagePath.startsWith("images/")) {
                imagePath = imagePath.substring(7); // 移除 "images/" (7個字符)
            }
            
            if (imagePath == null || imagePath.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            
            // 獲取圖片輸入流（會自動處理本地和S3存儲）
            InputStream imageStream = imageService.getImageInputStream(imagePath);
            
            // 獲取內容類型
            String contentType = imageService.getImageContentType(imagePath);
            
            // 設置響應頭
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl("public, max-age=3600"); // 緩存1小時
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(imageStream));
                    
        } catch (Exception e) {
            // 記錄錯誤以便調試
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}

