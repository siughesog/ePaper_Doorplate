package org.example.service.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.core.sync.RequestBody;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;

/**
 * AWS S3 雲端存儲服務實現
 * 用於生產環境，提供高可用性和災難恢復
 */
@Service
@ConditionalOnProperty(name = "storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    private final S3Client s3Client;
    private final String bucketName;

    public S3StorageService(
            @Value("${storage.s3.bucket}") String bucketName,
            @Value("${storage.s3.region:us-east-1}") String region,
            @Value("${storage.s3.access-key:}") String accessKey,
            @Value("${storage.s3.secret-key:}") String secretKey) {
        
        this.bucketName = bucketName;
        
        // 創建 S3 客戶端
        if (accessKey != null && !accessKey.isEmpty() && 
            secretKey != null && !secretKey.isEmpty()) {
            AwsBasicCredentials awsCreds = AwsBasicCredentials.create(accessKey, secretKey);
            this.s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(awsCreds))
                    .build();
        } else {
            // 使用默認憑證（環境變數、IAM 角色等）
            this.s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .build();
        }
    }

    @Override
    public String saveFile(byte[] fileContent, String fileName) throws Exception {
        String key = "images/" + fileName;
        
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(getContentType(fileName))
                .build();

        s3Client.putObject(putObjectRequest, RequestBody.fromBytes(fileContent));
        
        return key; // 返回 S3 key
    }

    @Override
    public boolean deleteFile(String filePath) {
        try {
            String key = filePath.startsWith("images/") ? filePath : "images/" + filePath;
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            s3Client.deleteObject(deleteObjectRequest);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public InputStream getFileInputStream(String filePath) throws Exception {
        // 處理路徑格式：
        // - 輸入可能是：images/xxx.webp 或 /images/xxx.webp 或 xxx.webp
        // - 統一轉換為：images/xxx.webp（S3 key）
        String normalizedPath = filePath;
        
        // 移除前導斜線
        if (normalizedPath.startsWith("/images/")) {
            normalizedPath = normalizedPath.substring(1); // 移除 "/" → "images/xxx.webp"
        } else if (normalizedPath.startsWith("/")) {
            normalizedPath = normalizedPath.substring(1); // 移除 "/" → "xxx.webp"
        }
        
        // 確保有 "images/" 前綴
        if (!normalizedPath.startsWith("images/")) {
            normalizedPath = "images/" + normalizedPath;
        }
        
        final String key = normalizedPath; // 用於 lambda 表達式
        
        try {
            return s3Client.getObject(builder -> builder
                    .bucket(bucketName)
                    .key(key)
            );
        } catch (NoSuchKeyException e) {
            // 記錄詳細錯誤信息以便調試
            System.err.println("❌ S3 圖片不存在:");
            System.err.println("   - 請求的 key: " + key);
            System.err.println("   - 原始 filePath: " + filePath);
            System.err.println("   - Bucket: " + bucketName);
            throw new IOException("S3 圖片不存在: " + key, e);
        }
    }

    @Override
    public boolean fileExists(String filePath) {
        try {
            String key = filePath.startsWith("images/") ? filePath : "images/" + filePath;
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            s3Client.headObject(headObjectRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String getPublicUrl(String filePath) {
        String key = filePath.startsWith("images/") ? filePath : "images/" + filePath;
        
        // 生成預簽名 URL（有效期 1 小時）
        // 或者如果 bucket 是公開的，可以直接返回 URL
        try {
            URL url = s3Client.utilities().getUrl(builder -> builder
                    .bucket(bucketName)
                    .key(key)
            );
            return url.toString();
        } catch (Exception e) {
            // 如果無法生成 URL，返回相對路徑（需要通過 API 代理）
            return "/api/images/s3/" + key;
        }
    }

    private String getContentType(String fileName) {
        String extension = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
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

