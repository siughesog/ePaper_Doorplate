package org.example.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class DoorplateRendererService {
    
    @Value("${server.port:8080}")
    private String serverPort;
    
    @Value("${server.address:0.0.0.0}")
    private String serverAddress;
    
    @Value("${server.ssl.enabled:false}")
    private String sslEnabled;
    
    @Value("${upload.folder:uploads}")
    private String uploadFolder;
    
    // Python 腳本現在與 JAR 文件在同一目錄（backend/epaperdoorplate/）
    private static final String PYTHON_SCRIPT_PATH = getPythonScriptPath();
    
    private static String getPythonScriptPath() {
        // 獲取當前工作目錄（JAR 文件所在目錄）
        String currentDir = System.getProperty("user.dir");
        System.out.println("當前工作目錄: " + currentDir);
        
        // Python 腳本現在與 JAR 文件在同一目錄
        String scriptPath = currentDir + File.separator + "render_doorplate_fixed.py";
        System.out.println("Python 腳本路徑: " + scriptPath);
        
        // 檢查腳本是否存在
        File scriptFile = new File(scriptPath);
        if (!scriptFile.exists()) {
            System.out.println("⚠️ 警告: Python 腳本不存在於預期位置: " + scriptPath);
            // 嘗試其他可能的位置（向後兼容）
            String[] possiblePaths = {
                currentDir + File.separator + "backend" + File.separator + "render_doorplate_fixed.py",
                currentDir + File.separator + ".." + File.separator + "render_doorplate_fixed.py",
                currentDir + File.separator + ".." + File.separator + "backend" + File.separator + "render_doorplate_fixed.py"
            };
            
            for (String path : possiblePaths) {
                File possibleFile = new File(path);
                if (possibleFile.exists()) {
                    System.out.println("✅ 找到 Python 腳本於: " + possibleFile.getAbsolutePath());
                    return possibleFile.getAbsolutePath();
                }
            }
        } else {
            System.out.println("✅ Python 腳本存在於: " + scriptFile.getAbsolutePath());
        }
        
        return scriptPath;
    }
    
    // 保留 getBackendPath() 方法用於其他用途（如 uploads 目錄）
    private static String getBackendPath() {
        // 獲取當前工作目錄
        String currentDir = System.getProperty("user.dir");
        System.out.println("當前工作目錄: " + currentDir);
        
        // 如果當前在epaperdoorplate目錄，則返回上一級目錄（backend目錄）
        if (currentDir.endsWith("epaperdoorplate")) {
            File parentDir = new File(currentDir).getParentFile();
            if (parentDir != null) {
                String backendPath = parentDir.getAbsolutePath();
                System.out.println("Backend目錄: " + backendPath);
                return backendPath;
            }
        }
        
        // 如果當前在backend目錄，則返回當前目錄
        if (currentDir.endsWith("backend")) {
            System.out.println("Backend目錄: " + currentDir);
            return currentDir;
        }
        
        // 否則返回當前目錄下的backend目錄
        String backendPath = currentDir + File.separator + "backend";
        System.out.println("Backend目錄: " + backendPath);
        return backendPath;
    }
    
    /**
     * 渲染結果類，包含BMP和BIN數據
     */
    public static class RenderResult {
        private final byte[] bmpData;
        private final byte[] binData;
        
        public RenderResult(byte[] bmpData, byte[] binData) {
            this.bmpData = bmpData;
            this.binData = binData;
        }
        
        public byte[] getBmpData() {
            return bmpData;
        }
        
        public byte[] getBinData() {
            return binData;
        }
    }
    
    /**
     * 渲染門牌並返回數據（不保存文件）
     * @param elements 模板元素
     * @param layoutId 佈局ID
     * @return 渲染結果（包含BMP和BIN數據）
     */
    public RenderResult renderDoorplate(List<Map<String, Object>> elements, String layoutId) {
        File tempBmpFile = null;
        File tempBinFile = null;
        File tempJsonFile = null;
        
        try {
            System.out.println("開始渲染門牌，layoutId: " + layoutId);
            System.out.println("Python腳本路徑: " + PYTHON_SCRIPT_PATH);
            System.out.println("📥 renderDoorplate 收到 " + elements.size() + " 個元素");
            
            // 檢查是否有 guestQRCode 元素
            for (Map<String, Object> element : elements) {
                if ("guestQRCode".equals(element.get("type"))) {
                    System.out.println("🔍 在 renderDoorplate 中找到 guestQRCode 元素");
                    System.out.println("   元素 ID: " + element.get("id"));
                    System.out.println("   元素所有鍵: " + element.keySet());
                    System.out.println("   Token: " + element.get("guestQRCodeToken"));
                }
            }
            
            // 檢查Python腳本是否存在
            File pythonScript = new File(PYTHON_SCRIPT_PATH);
            if (!pythonScript.exists()) {
                throw new RuntimeException("Python腳本不存在: " + PYTHON_SCRIPT_PATH);
            }
            
            // 創建臨時文件（使用系統臨時目錄）
            String tempDir = System.getProperty("java.io.tmpdir");
            String timestamp = String.valueOf(System.currentTimeMillis());
            tempJsonFile = new File(tempDir, "temp_elements_" + timestamp + ".json");
            tempBmpFile = new File(tempDir, "doorplate_" + layoutId + "_" + timestamp + ".bmp");
            tempBinFile = new File(tempDir, "doorplate_" + layoutId + "_" + timestamp + ".bin");
            
            // 創建臨時JSON文件
            createTempJsonFile(elements, tempJsonFile);
            System.out.println("臨時JSON文件: " + tempJsonFile.getAbsolutePath());
            
            // 執行Python腳本
            ProcessBuilder processBuilder = new ProcessBuilder(
                "python", PYTHON_SCRIPT_PATH, 
                "--input", tempJsonFile.getAbsolutePath(),
                "--output", tempBmpFile.getAbsolutePath(),
                "--width", "800",
                "--height", "480"
            );
            
            // 設置環境變數，讓 Python 腳本知道後端 URL
            // 對於 Guest QR Code，必須使用公開的 API URL（訪客需要從外部訪問）
            // 優先使用環境變數 PUBLIC_API_URL，如果沒有則構建公開 URL
            String publicApiUrl = System.getenv("PUBLIC_API_URL");
            
            if (publicApiUrl == null || publicApiUrl.isEmpty()) {
                // 如果沒有設置 PUBLIC_API_URL，嘗試從 Railway 環境變數獲取
                String railwayUrl = System.getenv("RAILWAY_PUBLIC_DOMAIN");
                if (railwayUrl != null && !railwayUrl.isEmpty()) {
                    // Railway 提供的公開域名（自動包含 https://）
                    if (!railwayUrl.startsWith("http://") && !railwayUrl.startsWith("https://")) {
                        publicApiUrl = "https://" + railwayUrl;
                    } else {
                        publicApiUrl = railwayUrl;
                    }
                } else {
                    // 回退到構建 URL（生產環境應該設置 PUBLIC_API_URL）
                    String protocol = "true".equalsIgnoreCase(sslEnabled) ? "https" : "http";
                    // 注意：這裡應該使用公開域名，而不是內部地址
                    // 如果 server.address 是 0.0.0.0，這表示監聽所有接口，但公開 URL 需要是實際域名
                    if ("0.0.0.0".equals(serverAddress)) {
                        // 生產環境應該設置 PUBLIC_API_URL 環境變數
                        // 這裡使用 localhost 作為回退（僅用於開發環境）
                        publicApiUrl = protocol + "://localhost:" + serverPort;
                        System.err.println("⚠️ 警告: 未設置 PUBLIC_API_URL 環境變數，使用 localhost（僅適用於開發環境）");
                        System.err.println("   生產環境請設置 PUBLIC_API_URL，例如: https://your-backend.railway.app");
                    } else {
                        publicApiUrl = protocol + "://" + serverAddress + ":" + serverPort;
                    }
                }
            }
            
            // 設置環境變數（Guest QR Code 使用公開 URL）
            processBuilder.environment().put("API_BASE_URL", publicApiUrl);
            System.out.println("設置 API_BASE_URL 環境變數（公開 URL）: " + publicApiUrl);
            
            // 設置 uploads 目錄路徑（絕對路徑）
            String backendPath = getBackendPath();
            File uploadsDir = new File(backendPath, "epaperdoorplate" + File.separator + uploadFolder);
            // 如果不存在，嘗試相對路徑
            if (!uploadsDir.exists()) {
                uploadsDir = new File(uploadFolder);
            }
            // 如果還是不存在，嘗試從當前工作目錄
            if (!uploadsDir.exists()) {
                String currentDir = System.getProperty("user.dir");
                uploadsDir = new File(currentDir, uploadFolder);
            }
            
            String uploadsDirPath = uploadsDir.getAbsolutePath();
            processBuilder.environment().put("UPLOADS_DIR", uploadsDirPath);
            System.out.println("設置 UPLOADS_DIR 環境變數: " + uploadsDirPath);
            System.out.println("uploads 目錄是否存在: " + uploadsDir.exists());
            
            // 設置工作目錄為當前目錄（JAR 文件所在目錄，Python 腳本也在這裡）
            processBuilder.directory(new File(System.getProperty("user.dir")));
            System.out.println("執行命令: " + String.join(" ", processBuilder.command()));
            Process process = processBuilder.start();
            
            // 啟動線程讀取實時輸出
            Thread outputReader = new Thread(() -> {
                try {
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(process.getInputStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println("Python輸出: " + line);
                    }
                } catch (Exception e) {
                    System.out.println("讀取Python輸出時出錯: " + e.getMessage());
                }
            });
            outputReader.start();
            
            // 啟動線程讀取錯誤輸出
            Thread errorReader = new Thread(() -> {
                try {
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(process.getErrorStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println("Python錯誤: " + line);
                    }
                } catch (Exception e) {
                    System.out.println("讀取Python錯誤輸出時出錯: " + e.getMessage());
                }
            });
            errorReader.start();
            
            // 等待執行完成
            System.out.println("等待Python腳本執行完成...");
            boolean finished = process.waitFor(60, TimeUnit.SECONDS);
            
            if (!finished) {
                System.out.println("Python腳本執行超時，強制終止");
                process.destroyForcibly();
                throw new RuntimeException("Python腳本執行超時");
            }
            
            int exitCode = process.exitValue();
            System.out.println("Python腳本退出碼: " + exitCode);
            
            if (exitCode != 0) {
                String errorOutput = new String(process.getErrorStream().readAllBytes());
                String standardOutput = new String(process.getInputStream().readAllBytes());
                System.out.println("Python錯誤輸出: " + errorOutput);
                System.out.println("Python標準輸出: " + standardOutput);
                throw new RuntimeException("Python腳本執行失敗 (退出碼: " + exitCode + "): " + errorOutput);
            }
            
            // 讀取BMP文件數據
            if (!tempBmpFile.exists()) {
                throw new RuntimeException("BMP文件不存在: " + tempBmpFile.getAbsolutePath());
            }
            byte[] bmpData = Files.readAllBytes(tempBmpFile.toPath());
            System.out.println("BMP文件讀取成功，大小: " + bmpData.length + " bytes");
            
            // 讀取BIN文件數據
            byte[] binData = null;
            if (tempBinFile.exists()) {
                binData = Files.readAllBytes(tempBinFile.toPath());
                System.out.println("BIN文件讀取成功，大小: " + binData.length + " bytes");
            } else {
                System.out.println("警告: BIN文件不存在: " + tempBinFile.getAbsolutePath());
            }
            
            return new RenderResult(bmpData, binData);
            
        } catch (Exception e) {
            throw new RuntimeException("渲染門牌失敗: " + e.getMessage(), e);
        } finally {
            // 清理所有臨時文件
            try {
                if (tempJsonFile != null && tempJsonFile.exists()) {
                    Files.deleteIfExists(tempJsonFile.toPath());
                    System.out.println("臨時JSON文件已刪除: " + tempJsonFile.getName());
                }
                if (tempBmpFile != null && tempBmpFile.exists()) {
                    Files.deleteIfExists(tempBmpFile.toPath());
                    System.out.println("臨時BMP文件已刪除: " + tempBmpFile.getName());
                }
                if (tempBinFile != null && tempBinFile.exists()) {
                    Files.deleteIfExists(tempBinFile.toPath());
                    System.out.println("臨時BIN文件已刪除: " + tempBinFile.getName());
                }
            } catch (IOException e) {
                System.out.println("清理臨時文件時出錯: " + e.getMessage());
            }
        }
    }
    
    
    private void createTempJsonFile(List<Map<String, Object>> elements, File outputFile) throws IOException {
        // 創建包含元素數據的JSON文件
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"elements\": [\n");
        
        for (int i = 0; i < elements.size(); i++) {
            Map<String, Object> element = elements.get(i);
            String elementType = element.get("type").toString();
            System.out.println("📝 處理元素 #" + (i + 1) + ": type=" + elementType + ", id=" + element.get("id"));
            
            // 如果是 guestQRCode，檢查 token
            if ("guestQRCode".equals(elementType)) {
                Object token = element.get("guestQRCodeToken");
                System.out.println("🔍 Guest QR Code 元素 - Token: " + (token != null ? token.toString() : "null"));
                System.out.println("   元素所有鍵: " + element.keySet());
            }
            
            json.append("    {\n");
            json.append("      \"id\": \"").append(escapeJsonString(element.getOrDefault("_id", element.get("id")).toString())).append("\",\n");
            json.append("      \"type\": \"").append(escapeJsonString(elementType)).append("\",\n");
            json.append("      \"name\": \"").append(escapeJsonString(element.getOrDefault("name", element.getOrDefault("Name", "")).toString())).append("\",\n");
            json.append("      \"x\": ").append(element.get("x")).append(",\n");
            json.append("      \"y\": ").append(element.get("y")).append(",\n");
            json.append("      \"width\": ").append(element.get("width")).append(",\n");
            json.append("      \"height\": ").append(element.get("height")).append(",\n");
            json.append("      \"zIndex\": ").append(element.getOrDefault("zIndex", 1)).append("\n");
            
            // 根據元素類型添加特定屬性
            if ("label".equals(elementType) || "dynamicText".equals(elementType) || "text".equals(elementType)) {
                json.append("      ,\"text\": \"").append(escapeJsonString(element.getOrDefault("text", "").toString())).append("\"\n");
                json.append("      ,\"fontSize\": ").append(element.getOrDefault("fontSize", 16)).append("\n");
                json.append("      ,\"color\": \"").append(escapeJsonString(element.getOrDefault("color", "#000000").toString())).append("\"\n");
                json.append("      ,\"textDirection\": \"").append(escapeJsonString(element.getOrDefault("textDirection", "horizontal").toString())).append("\"\n");
            } else if ("image".equals(elementType) || "dynamicImage".equals(elementType)) {
                Object imageUrl = element.getOrDefault("imageUrl", "");
                Object content = element.getOrDefault("content", "");
                Object imageId = element.getOrDefault("imageId", "");
                
                // 處理null值
                String imageUrlStr = (imageUrl == null) ? "" : imageUrl.toString();
                String contentStr = (content == null) ? "" : content.toString();
                String imageIdStr = (imageId == null) ? "" : imageId.toString();
                
                json.append("      ,\"imageUrl\": \"").append(escapeJsonString(imageUrlStr)).append("\"\n");
                json.append("      ,\"content\": \"").append(escapeJsonString(contentStr)).append("\"\n");
                if (!imageIdStr.isEmpty()) {
                    json.append("      ,\"imageId\": \"").append(escapeJsonString(imageIdStr)).append("\"\n");
                }
                json.append("      ,\"blackThreshold\": ").append(element.getOrDefault("blackThreshold", 128)).append("\n");
                json.append("      ,\"whiteThreshold\": ").append(element.getOrDefault("whiteThreshold", 128)).append("\n");
                json.append("      ,\"contrast\": ").append(element.getOrDefault("contrast", 1.0)).append("\n");
            } else if ("qrCode".equals(elementType)) {
                json.append("      ,\"content\": \"").append(escapeJsonString(element.getOrDefault("content", "").toString())).append("\"\n");
            } else if ("guestQRCode".equals(elementType)) {
                // Guest QR Code 需要 token
                System.out.println("🔧 處理 guestQRCode 類型元素");
                Object token = element.get("guestQRCodeToken");
                System.out.println("   Token 值: " + (token != null ? token.toString() : "null"));
                System.out.println("   元素包含的鍵: " + element.keySet());
                
                if (token != null) {
                    json.append("      ,\"guestQRCodeToken\": \"").append(escapeJsonString(token.toString())).append("\"\n");
                    System.out.println("✅ 在 JSON 中添加 Guest QR Code Token: " + token.toString());
                } else {
                    System.err.println("❌ Guest QR Code 元素缺少 guestQRCodeToken");
                    System.err.println("   元素完整內容: " + element);
                }
            } else if ("barcode".equals(elementType)) {
                json.append("      ,\"content\": \"").append(escapeJsonString(element.getOrDefault("content", "").toString())).append("\"\n");
            }
            
            json.append("    }");
            if (i < elements.size() - 1) {
                json.append(",");
            }
            json.append("\n");
        }
        
        json.append("  ]\n");
        json.append("}\n");
        
        // 寫入臨時文件
        Files.write(outputFile.toPath(), json.toString().getBytes(StandardCharsets.UTF_8));
    }
    
    private String escapeJsonString(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
}
