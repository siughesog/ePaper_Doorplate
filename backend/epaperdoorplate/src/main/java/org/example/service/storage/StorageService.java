package org.example.service.storage;

import java.io.InputStream;

/**
 * 存儲服務接口
 * 支援本地存儲和雲端存儲的統一接口
 */
public interface StorageService {
    
    /**
     * 保存檔案
     * @param fileContent 檔案內容
     * @param fileName 檔案名稱
     * @return 檔案在存儲中的路徑或 URL
     * @throws Exception 保存失敗時拋出異常
     */
    String saveFile(byte[] fileContent, String fileName) throws Exception;
    
    /**
     * 刪除檔案
     * @param filePath 檔案路徑或 URL
     * @return 是否成功刪除
     */
    boolean deleteFile(String filePath);
    
    /**
     * 獲取檔案輸入流
     * @param filePath 檔案路徑或 URL
     * @return 檔案輸入流
     * @throws Exception 獲取失敗時拋出異常
     */
    InputStream getFileInputStream(String filePath) throws Exception;
    
    /**
     * 檢查檔案是否存在
     * @param filePath 檔案路徑或 URL
     * @return 是否存在
     */
    boolean fileExists(String filePath);
    
    /**
     * 獲取檔案的公開 URL（用於前端訪問）
     * @param filePath 檔案路徑或 URL
     * @return 公開 URL
     */
    String getPublicUrl(String filePath);
}












