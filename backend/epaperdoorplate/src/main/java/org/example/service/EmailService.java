package org.example.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
public class EmailService {

    @Value("${app.email.enabled:false}")
    private boolean emailEnabled;

    @Value("${app.email.smtp.host:}")
    private String smtpHost;

    @Value("${app.email.smtp.port:587}")
    private int smtpPort;

    @Value("${app.email.smtp.username:}")
    private String smtpUsername;

    @Value("${app.email.smtp.password:}")
    private String smtpPassword;

    @Value("${app.email.from:}")
    private String fromEmail;

    /**
     * 發送密碼重置驗證碼到電子郵件
     * 注意：目前實作為簡單版本，在開發環境中打印到控制台
     * 生產環境需要配置 SMTP 服務器
     */
    public boolean sendPasswordResetCode(String email, String code) {
        if (emailEnabled && smtpHost != null && !smtpHost.isEmpty()) {
            // TODO: 實作真正的 email 發送（使用 JavaMail 或 SendGrid 等）
            // 目前先打印到控制台
            System.out.println("========================================");
            System.out.println("📧 密碼重置驗證碼");
            System.out.println("========================================");
            System.out.println("收件人: " + email);
            System.out.println("驗證碼: " + code);
            System.out.println("有效期: 5 分鐘");
            System.out.println("========================================");
            return true;
        } else {
            // 開發環境：打印到控制台
            System.out.println("========================================");
            System.out.println("📧 密碼重置驗證碼（開發模式）");
            System.out.println("========================================");
            System.out.println("收件人: " + email);
            System.out.println("驗證碼: " + code);
            System.out.println("有效期: 5 分鐘");
            System.out.println("注意：這是開發模式，驗證碼僅顯示在控制台");
            System.out.println("生產環境請配置 SMTP 服務器以發送真實 email");
            System.out.println("========================================");
            return true;
        }
    }
}

