package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.service.LineBotService;
import org.example.utils.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/line")
public class LineBotController {

    @Autowired
    private LineBotService lineBotService;

    @Autowired
    private JwtUtil jwtUtil;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Line Bot Webhook（接收 Line 事件）
     */
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(
            @RequestBody String body,
            @RequestHeader(value = "X-Line-Signature", required = false) String signature,
            HttpServletRequest request) {
        
        try {
            // 驗證簽名
            if (signature == null || !lineBotService.verifySignature(body, signature)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            JsonNode root = objectMapper.readTree(body);
            JsonNode events = root.get("events");

            if (events != null && events.isArray()) {
                for (JsonNode event : events) {
                    String type = event.get("type").asText();
                    
                    if ("message".equals(type)) {
                        JsonNode message = event.get("message");
                        String messageType = message.get("type").asText();
                        
                        if ("text".equals(messageType)) {
                            String text = message.get("text").asText();
                            String lineUserId = event.get("source").get("userId").asText();
                            
                            // 檢查是否為驗證碼（6位數字）
                            if (text.matches("\\d{6}")) {
                                boolean success = lineBotService.verifyAndBind(text, lineUserId);
                                if (success) {
                                    // 發送成功訊息
                                    lineBotService.sendMessage(lineUserId, "✅ Line Bot 綁定成功！");
                                } else {
                                    // 發送失敗訊息
                                    lineBotService.sendMessage(lineUserId, "❌ 驗證碼無效或已過期，請重新獲取驗證碼。");
                                }
                            }
                        }
                    }
                }
            }

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 獲取 Line Bot 資訊（包括 QR Code URL）
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getLineBotInfo(
            @RequestHeader(value = "Authorization") String authHeader) {
        
        try {
            String username = extractUsernameFromToken(authHeader);
            
            if (username == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "無法識別用戶");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            Map<String, Object> botInfo = lineBotService.getLineBotInfo();
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.putAll(botInfo);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "獲取 Line Bot 資訊失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 獲取 Line Bot 綁定驗證碼
     */
    @PostMapping("/generate-verification-code")
    public ResponseEntity<Map<String, Object>> generateVerificationCode(
            @RequestHeader(value = "Authorization") String authHeader) {
        
        try {
            // 從 JWT token 中獲取用戶名（簡化處理，實際應該從 token 解析）
            String username = extractUsernameFromToken(authHeader);
            
            if (username == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "無法識別用戶");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            String code = lineBotService.generateVerificationCode(username);
            
            // 同時返回 Line Bot 資訊（包括 QR Code URL）
            Map<String, Object> botInfo = lineBotService.getLineBotInfo();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("verificationCode", code);
            response.put("expiresIn", 300); // 5分鐘
            response.putAll(botInfo);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "生成驗證碼失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 解除 Line Bot 綁定
     */
    @PostMapping("/unbind")
    public ResponseEntity<Map<String, Object>> unbind(
            @RequestHeader(value = "Authorization") String authHeader) {
        
        try {
            String username = extractUsernameFromToken(authHeader);
            
            if (username == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "無法識別用戶");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            lineBotService.unbindLine(username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "已解除 Line Bot 綁定");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "解除綁定失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 從 Authorization header 中提取用戶名
     */
    private String extractUsernameFromToken(String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return null;
            }
            
            String token = authHeader.substring(7).trim();
            if (token.isEmpty()) {
                return null;
            }
            
            if (!jwtUtil.validateToken(token)) {
                return null;
            }
            
            return jwtUtil.getUsernameFromToken(token);
        } catch (Exception e) {
            return null;
        }
    }
}

