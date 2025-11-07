package org.example.controller;

import org.example.model.User;
import org.example.repository.UserRepository;
import org.example.service.HardwareWhitelistService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/hardware-whitelist")
public class HardwareWhitelistController {

    @Autowired
    private HardwareWhitelistService whitelistService;

    @Autowired
    private UserRepository userRepository;

    // 檢查當前用戶是否為超級用戶
    private boolean isCurrentUserSuperuser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        
        String username = authentication.getName();
        User user = userRepository.findByUsername(username);
        return user != null && user.isSuperuser();
    }

    // 返回權限錯誤響應
    private ResponseEntity<Map<String, Object>> forbiddenResponse() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", "只有超級用戶才能訪問硬體白名單管理功能");
        return ResponseEntity.status(403).body(response);
    }

    @GetMapping
    public ResponseEntity<?> getAllWhitelist() {
        if (!isCurrentUserSuperuser()) {
            return forbiddenResponse();
        }
        return ResponseEntity.ok(whitelistService.getAllWhitelist());
    }

    @PostMapping("/add")
    public ResponseEntity<Map<String, Object>> addToWhitelist(@RequestParam("uniqueId") String uniqueId) {
        if (!isCurrentUserSuperuser()) {
            return forbiddenResponse();
        }
        return ResponseEntity.ok(whitelistService.addToWhitelist(uniqueId));
    }

    @PostMapping("/remove")
    public ResponseEntity<Map<String, Object>> removeFromWhitelist(@RequestParam("uniqueId") String uniqueId) {
        if (!isCurrentUserSuperuser()) {
            return forbiddenResponse();
        }
        return ResponseEntity.ok(whitelistService.removeFromWhitelist(uniqueId));
    }

    @GetMapping("/check")
    public ResponseEntity<Map<String, Object>> checkWhitelist(@RequestParam("uniqueId") String uniqueId) {
        if (!isCurrentUserSuperuser()) {
            return forbiddenResponse();
        }
        return ResponseEntity.ok(whitelistService.checkWhitelist(uniqueId));
    }
}
