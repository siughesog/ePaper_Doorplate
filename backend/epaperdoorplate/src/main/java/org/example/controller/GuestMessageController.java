package org.example.controller;

import org.example.model.Device;
import org.example.model.GuestMessageLog;
import org.example.model.User;
import org.example.repository.DeviceRepository;
import org.example.repository.GuestMessageLogRepository;
import org.example.repository.UserRepository;
import org.example.service.LineBotService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/guest")
public class GuestMessageController {

    @Autowired
    private DeviceRepository deviceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GuestMessageLogRepository guestMessageLogRepository;

    @Autowired
    private LineBotService lineBotService;

    @Value("${app.guest-message.max-per-ip-per-hour:3}")
    private int maxPerIpPerHour;

    @Value("${app.guest-message.max-per-device-per-hour:5}")
    private int maxPerDevicePerHour;

    /**
     * 提交 Guest 留言
     */
    @PostMapping("/message")
    public ResponseEntity<Map<String, Object>> submitMessage(
            @RequestParam("token") String token,
            @RequestParam("message") String message,
            HttpServletRequest request) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // 1. 驗證 token 並找到對應的 device
            Optional<Device> deviceOpt = deviceRepository.findByGuestQRCodeToken(token);
            if (deviceOpt.isEmpty()) {
                response.put("success", false);
                response.put("message", "無效的 QR code");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            Device device = deviceOpt.get();
            
            // 2. 檢查 device 是否已激活
            if (!device.isActivated() || device.isUnbound()) {
                response.put("success", false);
                response.put("message", "設備未激活");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            // 3. 找到對應的用戶
            if (device.getUserId() == null) {
                response.put("success", false);
                response.put("message", "設備未綁定用戶");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            Optional<User> userOpt = userRepository.findById(device.getUserId());
            if (userOpt.isEmpty()) {
                response.put("success", false);
                response.put("message", "用戶不存在");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            User user = userOpt.get();

            // 4. 檢查用戶是否接受 guest 訊息
            if (!user.isAcceptGuestMessages()) {
                response.put("success", false);
                response.put("message", "該用戶不接受訪客訊息");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }

            // 5. 檢查用戶是否已綁定 Line
            if (!user.isLineBound() || user.getLineUserId() == null) {
                response.put("success", false);
                response.put("message", "用戶未綁定 Line Bot");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            // 6. 獲取 IP 地址
            String ipAddress = getClientIpAddress(request);
            
            // 7. 防濫用檢查
            if (!checkAbusePrevention(ipAddress, device.getDeviceId(), token)) {
                response.put("success", false);
                response.put("message", "留言過於頻繁，請稍後再試");
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
            }

            // 8. 記錄留言
            GuestMessageLog log = new GuestMessageLog();
            log.setDeviceId(device.getDeviceId());
            log.setUserId(user.getId());
            log.setToken(token);
            log.setIpAddress(ipAddress);
            log.setMessage(message);
            log.setCreatedAt(LocalDateTime.now());
            log.setIpDeviceKey(ipAddress + "_" + device.getDeviceId());
            guestMessageLogRepository.save(log);

            // 9. 發送到 Line Bot
            String lineMessage = String.format("📩 收到訪客留言（設備：%s）\n\n%s", 
                    device.getDeviceName() != null ? device.getDeviceName() : device.getDeviceId(), 
                    message);
            
            boolean sent = lineBotService.sendMessage(user.getLineUserId(), lineMessage);
            
            if (sent) {
                response.put("success", true);
                response.put("message", "留言已發送");
            } else {
                response.put("success", false);
                response.put("message", "留言發送失敗，請稍後再試");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "處理留言時發生錯誤: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 獲取 Guest 留言頁面設定（公開 API，不需要認證）
     */
    @GetMapping("/message-page")
    public ResponseEntity<Map<String, Object>> getMessagePageSettings(
            @RequestParam("token") String token) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<Device> deviceOpt = deviceRepository.findByGuestQRCodeToken(token);
            if (deviceOpt.isEmpty()) {
                response.put("success", false);
                response.put("message", "無效的 QR code");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            Device device = deviceOpt.get();
            
            if (device.getUserId() == null) {
                response.put("success", false);
                response.put("message", "設備未綁定用戶");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            Optional<User> userOpt = userRepository.findById(device.getUserId());
            if (userOpt.isEmpty()) {
                response.put("success", false);
                response.put("message", "用戶不存在");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            User user = userOpt.get();

            response.put("success", true);
            response.put("welcomeText", user.getGuestMessageWelcomeText() != null ? 
                    user.getGuestMessageWelcomeText() : "歡迎留言給我們");
            response.put("hintText", user.getGuestMessageHintText() != null ? 
                    user.getGuestMessageHintText() : "請輸入您的留言");
            response.put("submitText", user.getGuestMessageSubmitText() != null ? 
                    user.getGuestMessageSubmitText() : "發送留言");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "獲取設定失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 防濫用檢查
     */
    private boolean checkAbusePrevention(String ipAddress, String deviceId, String token) {
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        
        // 檢查同一 IP 在 1 小時內的留言次數
        List<GuestMessageLog> ipLogs = guestMessageLogRepository.findByIpAddressAndCreatedAtAfter(ipAddress, oneHourAgo);
        if (ipLogs.size() >= maxPerIpPerHour) {
            return false;
        }
        
        // 檢查同一 device 在 1 小時內的留言次數
        List<GuestMessageLog> deviceLogs = guestMessageLogRepository.findByDeviceIdAndCreatedAtAfter(deviceId, oneHourAgo);
        if (deviceLogs.size() >= maxPerDevicePerHour) {
            return false;
        }
        
        // 檢查同一 IP + Device 組合在 1 小時內的留言次數
        String ipDeviceKey = ipAddress + "_" + deviceId;
        List<GuestMessageLog> ipDeviceLogs = guestMessageLogRepository.findByIpDeviceKeyAndCreatedAtAfter(ipDeviceKey, oneHourAgo);
        if (ipDeviceLogs.size() >= maxPerDevicePerHour) {
            return false;
        }
        
        return true;
    }

    /**
     * 獲取客戶端 IP 地址
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // 如果有多個 IP，取第一個
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}

