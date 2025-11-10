package org.example.controller;

import org.example.model.Device;
import org.example.model.User;
import org.example.repository.DeviceRepository;
import org.example.repository.UserRepository;
import org.example.service.DoorplateRendererService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/render")
public class DoorplateRenderController {
    
    @Autowired
    private DoorplateRendererService rendererService;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private DeviceRepository deviceRepository;
    
    @PostMapping("/doorplate")
    public ResponseEntity<Resource> renderDoorplate(
            @RequestParam String layoutId,
            @RequestParam(required = false) String userId,
            @RequestBody List<Map<String, Object>> elements,
            Authentication authentication) {
        
        try {
            System.out.println("=== 開始渲染門牌 ===");
            System.out.println("Layout ID: " + layoutId);
            
            // 從 Authentication 獲取當前用戶（優先使用）
            String currentUsername = authentication != null ? authentication.getName() : null;
            
            // 如果 userId 參數未提供，使用當前登錄用戶
            if (userId == null || userId.isEmpty()) {
                if (currentUsername == null || currentUsername.isEmpty()) {
                    throw new SecurityException("無法確定用戶身份，請提供 userId 參數或確保已登錄");
                }
                userId = currentUsername;
                System.out.println("未提供 userId 參數，使用當前登錄用戶: " + userId);
            }
            
            System.out.println("User ID: " + userId);
            System.out.println("元素數量: " + elements.size());
            
            // 驗證當前登錄用戶是否與請求的userId匹配
            if (currentUsername != null && !currentUsername.equals(userId)) {
                throw new SecurityException("無權限為其他用戶渲染門牌");
            }
            
            // 打印元素詳情
            for (int i = 0; i < elements.size(); i++) {
                Map<String, Object> element = elements.get(i);
                System.out.println("元素 " + (i + 1) + ": " + element.get("type") + " - " + element.get("name"));
            }
            
            // 為 guestQRCode 元素添加 token
            String guestQRCodeToken = null;
            Optional<User> userOpt = userRepository.findByUsername(userId);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                // 查找該用戶的第一個設備（用於獲取 token）
                List<Device> userDevices = deviceRepository.findByUserIdAndUnboundFalse(user.getId());
                if (!userDevices.isEmpty()) {
                    Device device = userDevices.get(0);
                    guestQRCodeToken = device.getGuestQRCodeToken();
                    if (guestQRCodeToken == null || guestQRCodeToken.isEmpty()) {
                        // 如果設備沒有 token，生成一個
                        guestQRCodeToken = UUID.randomUUID().toString();
                        device.setGuestQRCodeToken(guestQRCodeToken);
                        deviceRepository.save(device);
                        System.out.println("✅ 為設備生成新的 Guest QR Code Token: " + guestQRCodeToken);
                    } else {
                        System.out.println("✅ 使用設備的 Guest QR Code Token: " + guestQRCodeToken);
                    }
                } else {
                    // 如果用戶沒有設備，生成一個臨時 token（僅用於預覽）
                    guestQRCodeToken = UUID.randomUUID().toString();
                    System.out.println("⚠️ 用戶沒有設備，生成臨時 Token 用於預覽: " + guestQRCodeToken);
                }
            }
            
            // 為所有 guestQRCode 元素添加 token
            if (guestQRCodeToken != null) {
                int guestQRCodeCount = 0;
                for (Map<String, Object> element : elements) {
                    if ("guestQRCode".equals(element.get("type"))) {
                        guestQRCodeCount++;
                        element.put("guestQRCodeToken", guestQRCodeToken);
                        System.out.println("✅ 已為 Guest QR Code 元素添加 token");
                        System.out.println("   元素 ID: " + element.get("id"));
                        System.out.println("   Token: " + guestQRCodeToken);
                    }
                }
                if (guestQRCodeCount > 0) {
                    System.out.println("📊 找到 " + guestQRCodeCount + " 個 Guest QR Code 元素，已添加 token");
                }
            } else {
                System.out.println("⚠️ 無法獲取 Guest QR Code Token，Guest QR Code 將無法正常渲染");
            }
            
            // 渲染門牌（直接返回數據，不保存文件）
            DoorplateRendererService.RenderResult result = rendererService.renderDoorplate(elements, layoutId);
            byte[] bmpData = result.getBmpData();
            
            System.out.println("渲染成功，BMP數據大小: " + bmpData.length + " bytes");
            
            // 創建內存資源
            Resource resource = new ByteArrayResource(bmpData);
            
            // 設置響應頭
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=doorplate.bmp");
            headers.add(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
            headers.add(HttpHeaders.PRAGMA, "no-cache");
            headers.add(HttpHeaders.EXPIRES, "0");
            
            System.out.println("=== 渲染完成，返回圖片（內存數據） ===");
            return ResponseEntity.ok()
                    .headers(headers)
                    .contentType(MediaType.IMAGE_PNG) // 前端期望PNG格式
                    .body(resource);
                    
        } catch (Exception e) {
            System.out.println("=== 渲染失敗 ===");
            System.out.println("錯誤信息: " + e.getMessage());
            e.printStackTrace();
            System.out.println("=== 錯誤結束 ===");
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @GetMapping("/preview/{layoutId}")
    public ResponseEntity<Resource> getPreview(@PathVariable String layoutId) {
        // 預覽功能需要重新渲染，不從文件系統讀取
        // 如果需要預覽，應該調用 /render/doorplate 接口
        return ResponseEntity.notFound().build();
    }
}
