package org.example.service;

import org.example.dto.AuthResponse;
import org.example.dto.LoginRequest;
import org.example.dto.RegisterRequest;
import org.example.model.User;
import org.example.repository.UserRepository;
import org.example.utils.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Transactional
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

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
}
