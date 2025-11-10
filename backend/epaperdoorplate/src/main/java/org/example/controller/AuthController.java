package org.example.controller;

import org.example.dto.AuthResponse;
import org.example.dto.LoginRequest;
import org.example.dto.RegisterRequest;
import org.example.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        
        if (response.getToken() != null) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        
        if (response.getToken() != null) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        // 如果沒有Authorization header，返回未認證
        if (authHeader == null || authHeader.trim().isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                "valid", false,
                "message", "No authorization header provided"
            ));
        }
        
        String token = authHeader.trim();
        if (token.startsWith("Bearer ")) {
            token = token.substring(7).trim();
        }
        
        // 如果token為空，返回未認證
        if (token.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of(
                "valid", false,
                "message", "No token provided"
            ));
        }
        
        try {
            // 檢查token是否有效且未過期
            boolean isValid = authService.validateToken(token);
            if (isValid) {
                return ResponseEntity.ok().body(Map.of(
                    "valid", true,
                    "message", "Token is valid"
                ));
            } else {
                return ResponseEntity.status(401).body(Map.of(
                    "valid", false,
                    "message", "Token is invalid or expired"
                ));
            }
        } catch (Exception e) {
            // 記錄錯誤但返回401而不是500
            logger.error("Token validation error: ", e);
            return ResponseEntity.status(401).body(Map.of(
                "valid", false,
                "message", "Token validation failed: " + (e.getMessage() != null ? e.getMessage() : "Unknown error")
            ));
        }
    }

    /**
     * 發送密碼重置驗證碼
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null || email.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "請提供電子郵件地址");
            return ResponseEntity.badRequest().body(response);
        }

        Map<String, Object> result = authService.sendPasswordResetCode(email);
        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 驗證密碼重置驗證碼
     */
    @PostMapping("/verify-reset-code")
    public ResponseEntity<Map<String, Object>> verifyResetCode(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String code = request.get("code");

        if (email == null || email.trim().isEmpty() || code == null || code.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "請提供電子郵件地址和驗證碼");
            return ResponseEntity.badRequest().body(response);
        }

        Map<String, Object> result = authService.verifyPasswordResetCode(email, code);
        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    /**
     * 重置密碼
     */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String code = request.get("code");
        String newPassword = request.get("newPassword");

        if (email == null || email.trim().isEmpty() || 
            code == null || code.trim().isEmpty() || 
            newPassword == null || newPassword.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "請提供所有必要資訊");
            return ResponseEntity.badRequest().body(response);
        }

        if (newPassword.length() < 6) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "密碼長度至少6個字符");
            return ResponseEntity.badRequest().body(response);
        }

        Map<String, Object> result = authService.resetPassword(email, code, newPassword);
        if ((Boolean) result.get("success")) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }
}

