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
            @RequestHeader(value = "X-Line-Signature", required = false) String signature,
            HttpServletRequest request) {
        
        String body = null;
        try {
            System.out.println("📥 收到 Line Bot Webhook 請求");
            System.out.println("   Signature: " + (signature != null ? signature.substring(0, Math.min(20, signature.length())) + "..." : "null"));
            
            // 從 HttpServletRequest 直接讀取原始請求體（避免 Spring 修改內容）
            body = readRequestBody(request);
            System.out.println("   Body length: " + (body != null ? body.length() : 0) + " characters");
            
            // 驗證簽名
            if (signature == null) {
                System.err.println("❌ Line Bot Webhook 缺少簽名");
                // Line 要求返回 200，即使驗證失敗也要返回 200 避免重試
                return ResponseEntity.ok().build();
            }
            
            if (!lineBotService.verifySignature(body, signature)) {
                System.err.println("❌ Line Bot Webhook 簽名驗證失敗");
                System.err.println("   請檢查：1) LINE_BOT_CHANNEL_SECRET 環境變數是否正確設置");
                System.err.println("           2) Channel Secret 值是否與 Line Developers Console 一致");
                // Line 要求返回 200，即使驗證失敗也要返回 200 避免重試
                return ResponseEntity.ok().build();
            }
            
            System.out.println("✅ Line Bot Webhook 簽名驗證成功");

            // 解析 JSON 請求體
            JsonNode root;
            try {
                root = objectMapper.readTree(body);
                System.out.println("📋 解析 JSON 成功");
            } catch (Exception e) {
                System.err.println("❌ 解析 JSON 失敗: " + e.getMessage());
                System.err.println("   Body 內容: " + (body != null ? body.substring(0, Math.min(200, body.length())) : "null"));
                e.printStackTrace();
                return ResponseEntity.ok().build();
            }

            JsonNode events = root.get("events");
            System.out.println("📦 事件數量: " + (events != null && events.isArray() ? events.size() : 0));

            if (events != null && events.isArray()) {
                for (JsonNode event : events) {
                    String type = event.has("type") ? event.get("type").asText() : "unknown";
                    System.out.println("📨 處理事件類型: " + type);
                    
                    if ("message".equals(type)) {
                        JsonNode message = event.get("message");
                        if (message == null) {
                            System.err.println("⚠️ 事件中沒有 message 欄位");
                            continue;
                        }
                        
                        String messageType = message.has("type") ? message.get("type").asText() : "unknown";
                        System.out.println("💬 訊息類型: " + messageType);
                        String replyToken = event.has("replyToken") ? event.get("replyToken").asText() : null;
                        System.out.println("🔑 Reply Token: " + (replyToken != null ? replyToken.substring(0, Math.min(20, replyToken.length())) + "..." : "null"));
                        
                        if ("text".equals(messageType)) {
                            String text = message.has("text") ? message.get("text").asText() : "";
                            JsonNode source = event.get("source");
                            String lineUserId = null;
                            
                            if (source != null && source.has("userId")) {
                                lineUserId = source.get("userId").asText();
                            }
                            
                            if (lineUserId == null) {
                                System.err.println("⚠️ 無法獲取 Line User ID");
                                System.err.println("   Source: " + (source != null ? source.toString() : "null"));
                                continue;
                            }
                            
                            System.out.println("📩 收到 Line 訊息: " + text + " (User ID: " + lineUserId + ")");
                            
                            // 檢查是否為驗證碼（6位數字）
                            if (text.matches("\\d{6}")) {
                                System.out.println("🔐 檢測到驗證碼: " + text);
                                boolean success = lineBotService.verifyAndBind(text, lineUserId);
                                
                                if (success) {
                                    System.out.println("✅ 驗證碼驗證成功，綁定 Line User ID: " + lineUserId);
                                    // 使用 Reply API 回覆訊息
                                    if (replyToken != null) {
                                        boolean replySuccess = lineBotService.replyMessage(replyToken, "✅ Line Bot 綁定成功！\n\n您現在可以接收訪客留言通知了。");
                                        if (!replySuccess) {
                                            System.err.println("⚠️ 回覆訊息失敗，嘗試使用 Push API");
                                            lineBotService.sendMessage(lineUserId, "✅ Line Bot 綁定成功！\n\n您現在可以接收訪客留言通知了。");
                                        }
                                    } else {
                                        // 如果沒有 replyToken，使用 Push API
                                        System.out.println("⚠️ 沒有 replyToken，使用 Push API");
                                        lineBotService.sendMessage(lineUserId, "✅ Line Bot 綁定成功！\n\n您現在可以接收訪客留言通知了。");
                                    }
                                } else {
                                    System.out.println("❌ 驗證碼驗證失敗: " + text);
                                    // 使用 Reply API 回覆訊息
                                    if (replyToken != null) {
                                        lineBotService.replyMessage(replyToken, "❌ 驗證碼無效或已過期。\n\n請重新在設定頁面生成驗證碼。");
                                    } else {
                                        // 如果沒有 replyToken，使用 Push API
                                        lineBotService.sendMessage(lineUserId, "❌ 驗證碼無效或已過期。\n\n請重新在設定頁面生成驗證碼。");
                                    }
                                }
                            } else {
                                System.out.println("ℹ️ 收到非驗證碼訊息: " + text);
                                // 如果不是驗證碼，回覆提示訊息
                                if (replyToken != null) {
                                    lineBotService.replyMessage(replyToken, "請輸入 6 位數字驗證碼來綁定 Line Bot。\n\n驗證碼可以在設定頁面獲取。");
                                }
                            }
                        } else {
                            System.out.println("ℹ️ 忽略非文字訊息類型: " + messageType);
                        }
                    } else {
                        System.out.println("ℹ️ 忽略非訊息事件類型: " + type);
                    }
                }
            } else {
                System.out.println("⚠️ 沒有事件或 events 不是陣列");
                if (body != null) {
                    System.out.println("   Body 內容: " + body.substring(0, Math.min(500, body.length())));
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
     * 從 HttpServletRequest 讀取原始請求體
     * 必須使用原始請求體進行簽名驗證，避免 Spring 修改內容
     * 注意：保留原始格式，包括換行符
     */
    private String readRequestBody(HttpServletRequest request) {
        try {
            StringBuilder body = new StringBuilder();
            try (java.io.BufferedReader reader = request.getReader()) {
                String line;
                boolean firstLine = true;
                while ((line = reader.readLine()) != null) {
                    if (!firstLine) {
                        body.append("\n");  // 保留換行符
                    }
                    body.append(line);
                    firstLine = false;
                }
            }
            return body.toString();
        } catch (Exception e) {
            System.err.println("❌ 讀取請求體失敗: " + e.getMessage());
            e.printStackTrace();
            return null;
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

