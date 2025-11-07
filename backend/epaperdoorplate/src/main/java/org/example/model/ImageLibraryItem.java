package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document("imageLibrary")
public class ImageLibraryItem {
    
    @Id
    private String id;
    
    private String userId;
    private String name;
    private String originalImageId; // 對應到 ImageFile 的 ID
    private String originalImagePath; // 原始圖片路徑
    
    // 圖片處理參數
    private double blackThreshold;
    private double whiteThreshold;
    private double contrast;
    
    // 處理後的圖片數據
    private String processedImageUrl; // Base64 或 URL
    private String format; // webp, png 等
    
    private Instant createdAt;
    private Instant updatedAt;
    
    // 可選：描述或標籤
    private String description;
    private String[] tags;
}



