package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;

@Document("password_reset_codes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetCode {
    @Id
    private String id;

    @Indexed
    private String email; // 用戶電子郵件

    private String code; // 6位數字驗證碼

    private LocalDateTime createdAt; // 創建時間

    private LocalDateTime expiresAt; // 過期時間（5分鐘後）

    private boolean used = false; // 是否已使用
}

