package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

@Document("users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id;

    @NotBlank(message = "用戶名不能為空")
    @Size(min = 3, max = 20, message = "用戶名長度必須在3-20個字符之間")
    @Indexed(unique = true)
    private String username;

    @NotBlank(message = "密碼不能為空")
    @Size(min = 6, message = "密碼長度至少6個字符")
    private String passwordHash;

    @Email(message = "請輸入有效的電子郵件地址")
    @Indexed(unique = true)
    private String email;

    // 關聯內容 ID（對應 UserContent.id）
    private String contentId;

    private String defaultLayoutId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean enabled = true;
    private boolean isSuperuser = false; // 超級用戶標記

    // Line Bot 相關欄位
    private String lineUserId; // Line User ID
    private boolean lineBound = false; // 是否已綁定 Line Bot

    // Guest 訊息相關設定
    private boolean acceptGuestMessages = true; // 是否接受 guest 訊息
    private String guestMessageWelcomeText; // Guest 留言頁面歡迎文字
    private String guestMessageHintText; // Guest 留言頁面提示文字
    private String guestMessageSubmitText; // Guest 留言頁面提交按鈕文字
}
