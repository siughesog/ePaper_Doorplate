package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.model.User;
import org.example.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class LineBotService {

    @Autowired
    private UserRepository userRepository;

    @Value("${line.bot.channel-secret:}")
    private String channelSecret;

    @Value("${line.bot.channel-access-token:}")
    private String channelAccessToken;

    @Value("${line.bot.bot-id:}")
    private String botId;

    @Value("${line.bot.webhook-url:}")
    private String webhookUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 儲存驗證碼和對應的用戶名（臨時，實際應該用 Redis 或資料庫）
    private final Map<String, LineVerificationCode> verificationCodes = new HashMap<>();

    /**
     * 生成 Line Bot 綁定驗證碼
     */
    public String generateVerificationCode(String username) {
        // 生成 6 位數字驗證碼
        Random random = new Random();
        String code = String.format("%06d", random.nextInt(1000000));
        
        // 儲存驗證碼（5 分鐘過期）
        LineVerificationCode verificationCode = new LineVerificationCode();
        verificationCode.setCode(code);
        verificationCode.setUsername(username);
        verificationCode.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        
        verificationCodes.put(code, verificationCode);
        
        return code;
    }

    /**
     * 驗證驗證碼並綁定 Line User ID
     */
    public boolean verifyAndBind(String code, String lineUserId) {
        LineVerificationCode verificationCode = verificationCodes.get(code);
        
        if (verificationCode == null) {
            return false;
        }
        
        if (verificationCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            verificationCodes.remove(code);
            return false;
        }
        
        String username = verificationCode.getUsername();
        Optional<User> userOpt = userRepository.findByUsername(username);
        
        if (userOpt.isEmpty()) {
            return false;
        }
        
        User user = userOpt.get();
        user.setLineUserId(lineUserId);
        user.setLineBound(true);
        userRepository.save(user);
        
        // 清除驗證碼
        verificationCodes.remove(code);
        
        return true;
    }

    /**
     * 解除 Line 綁定
     */
    public void unbindLine(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLineUserId(null);
            user.setLineBound(false);
            userRepository.save(user);
        }
    }

    /**
     * 發送訊息到 Line
     */
    public boolean sendMessage(String lineUserId, String message) {
        if (channelAccessToken == null || channelAccessToken.isEmpty()) {
            System.err.println("Line Bot Channel Access Token 未設置");
            return false;
        }

        try {
            String url = "https://api.line.me/v2/bot/message/push";
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("to", lineUserId);
            
            List<Map<String, Object>> messages = new ArrayList<>();
            Map<String, Object> textMessage = new HashMap<>();
            textMessage.put("type", "text");
            textMessage.put("text", message);
            messages.add(textMessage);
            
            requestBody.put("messages", messages);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(channelAccessToken);
            
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            System.err.println("發送 Line 訊息失敗: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * 驗證 Line Webhook 簽名
     */
    public boolean verifySignature(String body, String signature) {
        if (channelSecret == null || channelSecret.isEmpty()) {
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(channelSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hash = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            String calculatedSignature = Base64.getEncoder().encodeToString(hash);
            
            return calculatedSignature.equals(signature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * 獲取 Line Bot 加入好友連結（用於生成 QR Code）
     * 格式：https://line.me/R/ti/p/@bot-id
     */
    public String getLineBotFriendUrl() {
        if (botId == null || botId.isEmpty()) {
            System.err.println("Line Bot ID 未設置，無法生成加入好友連結");
            return null;
        }
        
        // 確保 bot-id 不包含 @ 符號
        String cleanBotId = botId.startsWith("@") ? botId.substring(1) : botId;
        return "https://line.me/R/ti/p/@" + cleanBotId;
    }

    /**
     * 獲取 Line Bot QR Code URL（用於前端顯示）
     * 返回加入好友連結，前端可以使用 QR Code 庫生成 QR Code 圖片
     */
    public String getLineBotQRCodeUrl() {
        String friendUrl = getLineBotFriendUrl();
        if (friendUrl != null) {
            return friendUrl;
        }
        
        // 如果沒有設置 bot-id，返回空
        System.err.println("Line Bot ID 未設置，無法生成 QR Code URL");
        return null;
    }

    /**
     * 獲取 Line Bot 資訊（用於前端顯示）
     * 返回包含加入好友連結和 QR Code 資料的 Map
     */
    public Map<String, Object> getLineBotInfo() {
        Map<String, Object> info = new HashMap<>();
        
        String friendUrl = getLineBotFriendUrl();
        if (friendUrl != null) {
            info.put("friendUrl", friendUrl);
            info.put("qrCodeUrl", friendUrl); // 前端可以用這個 URL 生成 QR Code
            info.put("hasBotId", true);
        } else {
            info.put("hasBotId", false);
            info.put("message", "Line Bot ID 未設置，請在環境變數中設置 LINE_BOT_BOT_ID");
        }
        
        info.put("webhookUrl", webhookUrl);
        info.put("isConfigured", channelSecret != null && !channelSecret.isEmpty() 
                && channelAccessToken != null && !channelAccessToken.isEmpty());
        
        return info;
    }

    /**
     * 驗證碼內部類
     */
    private static class LineVerificationCode {
        private String code;
        private String username;
        private LocalDateTime expiresAt;

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public LocalDateTime getExpiresAt() {
            return expiresAt;
        }

        public void setExpiresAt(LocalDateTime expiresAt) {
            this.expiresAt = expiresAt;
        }
    }
}

