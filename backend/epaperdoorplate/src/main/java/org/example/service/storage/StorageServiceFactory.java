package org.example.service.storage;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.List;

/**
 * 存儲服務工廠
 * 根據配置選擇使用本地存儲或雲端存儲
 */
@Configuration
public class StorageServiceFactory {

    @Value("${storage.type:local}")
    private String storageType;

    @Autowired
    private List<StorageService> storageServices;

    @Bean
    @Primary
    public StorageService storageService() {
        if ("s3".equalsIgnoreCase(storageType)) {
            return storageServices.stream()
                    .filter(service -> service instanceof S3StorageService)
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("S3 storage service not found. Please configure AWS credentials."));
        } else {
            // 默認使用本地存儲
            return storageServices.stream()
                    .filter(service -> service instanceof LocalStorageService)
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Local storage service not found."));
        }
    }
}

