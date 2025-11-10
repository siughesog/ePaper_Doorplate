package org.example.controller;

import org.example.model.User;
import org.example.repository.UserRepository;
import org.example.utils.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private PasswordEncoder passwordEncoder;

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
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());
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
            boolean usernameChanged = false;
            
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
            response.put("usernameChanged", usernameChanged);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "更新設定失敗: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * 更新帳戶資訊（用戶名、電子郵件、密碼）
     */
    @PutMapping("/account")
    public ResponseEntity<Map<String, Object>> updateAccount(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestBody Map<String, Object> accountData) {
        
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
            boolean passwordChanged = false;
            
            // 注意：用戶名不可修改，已移除修改用戶名的功能
            
            // 更新電子郵件
            if (accountData.containsKey("email")) {
                String newEmail = (String) accountData.get("email");
                if (newEmail != null && !newEmail.trim().isEmpty() && !newEmail.equals(user.getEmail())) {
                    // 檢查新電子郵件是否已存在
                    Optional<User> existingUserByEmail = userRepository.findAll().stream()
                            .filter(u -> u.getEmail() != null && u.getEmail().equals(newEmail) && !u.getId().equals(user.getId()))
                            .findFirst();
                    if (existingUserByEmail.isPresent()) {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", false);
                        response.put("message", "電子郵件已被使用");
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                    }
                    
                    // 簡單的電子郵件格式驗證
                    if (!newEmail.contains("@") || !newEmail.contains(".")) {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", false);
                        response.put("message", "請輸入有效的電子郵件地址");
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                    }
                    
                    user.setEmail(newEmail);
                }
            }
            
            // 更新密碼
            if (accountData.containsKey("currentPassword") && accountData.containsKey("newPassword")) {
                String currentPassword = (String) accountData.get("currentPassword");
                String newPassword = (String) accountData.get("newPassword");
                
                if (currentPassword != null && newPassword != null && !newPassword.trim().isEmpty()) {
                    // 驗證當前密碼
                    if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", false);
                        response.put("message", "當前密碼錯誤");
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                    }
                    
                    // 驗證新密碼長度
                    if (newPassword.length() < 6) {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", false);
                        response.put("message", "新密碼長度至少6個字符");
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                    }
                    
                    user.setPasswordHash(passwordEncoder.encode(newPassword));
                    passwordChanged = true;
                }
            }
            
            userRepository.save(user);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "帳戶資訊已更新");
            response.put("passwordChanged", passwordChanged);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "更新帳戶資訊失敗: " + e.getMessage());
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

