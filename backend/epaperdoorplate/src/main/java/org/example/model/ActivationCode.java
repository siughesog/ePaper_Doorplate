package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document("activation_codes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivationCode {

    @Id
    private String id;

    @Indexed(unique = true)
    private String activationCode; // 臨時激活碼

    private String deviceId; // 綁定後的裝置ID（在成功綁定後關聯）

    private String uniqueId; // 首次啟動時對應的硬體 unique_id

    private LocalDateTime createdAt;
    private LocalDateTime expireAt;
}












