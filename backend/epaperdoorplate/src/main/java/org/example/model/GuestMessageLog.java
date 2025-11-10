package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;

@Document("guest_message_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GuestMessageLog {

    @Id
    private String id;

    private String deviceId; // 關聯的設備 ID
    private String userId; // 關聯的用戶 ID
    private String token; // QR code token
    private String ipAddress; // 訪客 IP 地址
    private String message; // 留言內容
    private LocalDateTime createdAt; // 留言時間

    // 用於防濫用查詢的索引
    @Indexed
    private String ipDeviceKey; // IP + DeviceId 組合鍵（用於快速查詢）
}

