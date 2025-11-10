package org.example.service;

import org.example.dto.AuthResponse;
import org.example.dto.LoginRequest;
import org.example.dto.RegisterRequest;
import org.example.model.PasswordResetCode;
import org.example.model.User;
import org.example.repository.PasswordResetCodeRepository;
import org.example.repository.UserRepository;
import org.example.utils.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@Service
@Transactional
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordResetCodeRepository passwordResetCodeRepository;

    @Autowired
    private EmailService emailService;

    public AuthResponse register(RegisterRequest request) {
        // 驗證密碼確認
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            return new AuthResponse(null, null, "密碼確認不匹配");
        }

        // 檢查用戶名是否已存在
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return new AuthResponse(null, null, "用戶名已存在");
        }

        // 檢查電子郵件是否已存在
        Optional<User> existingUserByEmail = userRepository.findAll().stream()
                .filter(user -> user.getEmail() != null && user.getEmail().equals(request.getEmail()))
                .findFirst();
        if (existingUserByEmail.isPresent()) {
            return new AuthResponse(null, null, "電子郵件已被使用");
        }

        // 創建新用戶
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setEmail(request.getEmail());
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        user.setEnabled(true);

        User savedUser = userRepository.save(user);
        String token = jwtUtil.generateToken(savedUser.getUsername());

        return new AuthResponse(token, savedUser.getUsername(), "註冊成功", savedUser.isSuperuser());
    }

    public AuthResponse login(LoginRequest request) {
        // 首先嘗試用username查找
        Optional<User> userOpt = userRepository.findByUsername(request.getUsername());
        User user = null;
        
        if (userOpt.isPresent()) {
            user = userOpt.get();
        } else {
            // 如果找不到，嘗試用email查找
            user = userRepository.findAll().stream()
                    .filter(u -> u.getEmail() != null && u.getEmail().equals(request.getUsername()))
                    .findFirst()
                    .orElse(null);
        }
        
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return new AuthResponse(null, null, "用戶名或密碼錯誤");
        }

        if (!user.isEnabled()) {
            return new AuthResponse(null, null, "帳戶已被禁用");
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), "登入成功", user.isSuperuser());
    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    public boolean validateToken(String token) {
        try {
            return jwtUtil.validateToken(token) && !jwtUtil.isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 發送密碼重置驗證碼
     */
    public Map<String, Object> sendPasswordResetCode(String email) {
        Map<String, Object> response = new HashMap<>();

        // 查找用戶
        Optional<User> userOpt = userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().equals(email))
                .findFirst();

        if (userOpt.isEmpty()) {
            // 為了安全，即使用戶不存在也返回成功（防止用戶枚舉）
            response.put("success", true);
            response.put("message", "如果該電子郵件地址存在，我們已發送驗證碼");
            return response;
        }

        // 生成6位數字驗證碼
        Random random = new Random();
        String code = String.format("%06d", random.nextInt(1000000));

        // 保存驗證碼
        PasswordResetCode resetCode = new PasswordResetCode();
        resetCode.setEmail(email);
        resetCode.setCode(code);
        resetCode.setCreatedAt(LocalDateTime.now());
        resetCode.setExpiresAt(LocalDateTime.now().plusMinutes(5)); // 5分鐘有效期
        resetCode.setUsed(false);
        passwordResetCodeRepository.save(resetCode);

        // 發送 email
        emailService.sendPasswordResetCode(email, code);

        response.put("success", true);
        response.put("message", "驗證碼已發送至您的電子郵件");
        return response;
    }

    /**
     * 驗證密碼重置驗證碼
     */
    public Map<String, Object> verifyPasswordResetCode(String email, String code) {
        Map<String, Object> response = new HashMap<>();

        Optional<PasswordResetCode> codeOpt = passwordResetCodeRepository
                .findByEmailAndCodeAndUsedFalse(email, code);

        if (codeOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "驗證碼錯誤或已使用");
            return response;
        }

        PasswordResetCode resetCode = codeOpt.get();

        // 檢查是否過期
        if (resetCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            response.put("success", false);
            response.put("message", "驗證碼已過期");
            return response;
        }

        response.put("success", true);
        response.put("message", "驗證碼正確");
        return response;
    }

    /**
     * 重置密碼
     */
    public Map<String, Object> resetPassword(String email, String code, String newPassword) {
        Map<String, Object> response = new HashMap<>();

        // 驗證驗證碼
        Optional<PasswordResetCode> codeOpt = passwordResetCodeRepository
                .findByEmailAndCodeAndUsedFalse(email, code);

        if (codeOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "驗證碼錯誤或已使用");
            return response;
        }

        PasswordResetCode resetCode = codeOpt.get();

        // 檢查是否過期
        if (resetCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            response.put("success", false);
            response.put("message", "驗證碼已過期");
            return response;
        }

        // 查找用戶
        Optional<User> userOpt = userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().equals(email))
                .findFirst();

        if (userOpt.isEmpty()) {
            response.put("success", false);
            response.put("message", "用戶不存在");
            return response;
        }

        User user = userOpt.get();

        // 更新密碼
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 標記驗證碼為已使用
        resetCode.setUsed(true);
        passwordResetCodeRepository.save(resetCode);

        response.put("success", true);
        response.put("message", "密碼重置成功");
        return response;
    }
}
