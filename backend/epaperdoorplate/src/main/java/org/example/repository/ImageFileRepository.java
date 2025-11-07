package org.example.repository;

import org.example.model.ImageFile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ImageFileRepository extends MongoRepository<ImageFile, String> {
    List<ImageFile> findByUserId(String userId);
    
    /**
     * 根據路徑查找圖片（支持部分匹配，用於查找文件名）
     * 例如：path 包含 "xxx.webp" 的圖片
     */
    List<ImageFile> findByPathContaining(String path);
}
