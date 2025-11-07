package org.example.service.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 本地存儲服務實現
 * 用於開發環境和單實例部署
 */
@Service
public class LocalStorageService implements StorageService {

    @Value("${upload.folder:uploads}")
    private String uploadFolder;

    @Value("${server.port:8080}")
    private String serverPort;

    @Value("${storage.local.base-url:}")
    private String baseUrl;

    @Override
    public String saveFile(byte[] fileContent, String fileName) throws IOException {
        Path path = Paths.get(uploadFolder, fileName);
        Files.createDirectories(path.getParent()); // 確保資料夾存在
        Files.write(path, fileContent);
        
        // 返回相對路徑
        return "/images/" + fileName;
    }

    @Override
    public boolean deleteFile(String filePath) {
        try {
            // 處理路徑格式：移除 /images/ 或 images/ 前綴
            String actualPath = filePath;
            if (actualPath.startsWith("/images/")) {
                actualPath = actualPath.substring(8);
            } else if (actualPath.startsWith("images/")) {
                actualPath = actualPath.substring(7);
            }
            Path path = Paths.get(uploadFolder, actualPath);
            return Files.deleteIfExists(path);
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public InputStream getFileInputStream(String filePath) throws IOException {
        // 處理路徑格式：
        // - 輸入可能是：images/xxx.webp 或 /images/xxx.webp
        // - 需要移除 images/ 前綴，得到文件名 xxx.webp
        String actualPath = filePath;
        
        // 移除 /images/ 或 images/ 前綴
        if (actualPath.startsWith("/images/")) {
            actualPath = actualPath.substring(8); // 移除 "/images/"
        } else if (actualPath.startsWith("images/")) {
            actualPath = actualPath.substring(7); // 移除 "images/"
        }
        
        // 構建完整路徑：uploads/xxx.webp
        Path path = Paths.get(uploadFolder, actualPath);
        return new FileInputStream(path.toFile());
    }

    @Override
    public boolean fileExists(String filePath) {
        // 處理路徑格式：移除 /images/ 或 images/ 前綴
        String actualPath = filePath;
        if (actualPath.startsWith("/images/")) {
            actualPath = actualPath.substring(8);
        } else if (actualPath.startsWith("images/")) {
            actualPath = actualPath.substring(7);
        }
        Path path = Paths.get(uploadFolder, actualPath);
        return Files.exists(path);
    }

    @Override
    public String getPublicUrl(String filePath) {
        // 如果配置了 base-url，使用它；否則使用相對路徑
        if (baseUrl != null && !baseUrl.isEmpty()) {
            return baseUrl + filePath;
        }
        return filePath;
    }
}

