package org.example.controller;

import org.example.model.User;
import org.example.repository.UserRepository;
import org.example.utils.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * 獲取用戶設定
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings(
            @RequestHeader(value = "Authorization") String authHeader) {
        
        try {
            String username = extractUsernameFromToken(authHeader);
            
            if (username == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "無法識別用戶");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "用戶不存在");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            User user = userOpt.get();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("lineBound", user.isLineBound());
            response.put("lineUserId", user.getLineUserId());
            response.put("acceptGuestMessages", user.isAcceptGuestMessages());
            response.put("guestMessageWelcomeText", user.getGuestMessageWelcomeText());
            response.put("guestMessageHintText", user.getGuestMessageHintText());
            response.put("guestMessageSubmitText", user.getGuestMessageSubmitText());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "獲取設定失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 更新用戶設定
     */
    @PutMapping
    public ResponseEntity<Map<String, Object>> updateSettings(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestBody Map<String, Object> settings) {
        
        try {
            String username = extractUsernameFromToken(authHeader);
            
            if (username == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "無法識別用戶");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
            }

            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "用戶不存在");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            User user = userOpt.get();
            
            // 更新設定（只更新提供的欄位）
            if (settings.containsKey("acceptGuestMessages")) {
                user.setAcceptGuestMessages((Boolean) settings.get("acceptGuestMessages"));
            }
            if (settings.containsKey("guestMessageWelcomeText")) {
                user.setGuestMessageWelcomeText((String) settings.get("guestMessageWelcomeText"));
            }
            if (settings.containsKey("guestMessageHintText")) {
                user.setGuestMessageHintText((String) settings.get("guestMessageHintText"));
            }
            if (settings.containsKey("guestMessageSubmitText")) {
                user.setGuestMessageSubmitText((String) settings.get("guestMessageSubmitText"));
            }
            
            userRepository.save(user);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "設定已更新");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "更新設定失敗: " + e.getMessage());
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

