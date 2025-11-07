package org.example.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {
    
    @NotBlank(message = "用戶名不能為空")
    @Size(min = 3, max = 20, message = "用戶名長度必須在3-20個字符之間")
    private String username;
    
    @NotBlank(message = "密碼不能為空")
    @Size(min = 6, message = "密碼長度至少6個字符")
    private String password;
    
    @NotBlank(message = "確認密碼不能為空")
    private String confirmPassword;
    
    @Email(message = "請輸入有效的電子郵件地址")
    @NotBlank(message = "電子郵件不能為空")
    private String email;

    public RegisterRequest() {}

    public RegisterRequest(String username, String password, String confirmPassword, String email) {
        this.username = username;
        this.password = password;
        this.confirmPassword = confirmPassword;
        this.email = email;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}




