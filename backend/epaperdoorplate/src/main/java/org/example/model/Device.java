package org.example.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document("devices")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Device {

    @Id
    private String id; // MongoDB document id

    @Indexed(unique = true)
    private String deviceId; // 後端分配的裝置 ID

    @Indexed(unique = true)
    private String uniqueId; // 硬體唯一 ID (ESP32 efuse mac 等)

    @JsonProperty("isActivated")
    private boolean isActivated; // 是否完成綁定/激活

    private String activationCode; // 目前關聯的臨時激活碼（僅在流程中短暫使用）

    private Integer refreshInterval; // 門牌刷新間隔（秒）

    private Integer lastRefreshInterval; // 設備最後一次更新時使用的刷新間隔（秒），用於判斷離線狀態

    private String currentDoorplateId; // 目前要顯示的門牌 ID

    private String currentTemplateId; // 目前使用的模板 ID

    private String currentElements; // 目前使用的動態元素配置 (JSON 字符串)

    private boolean needUpdate; // 是否需要更新內容

    private boolean forceNoUpdate; // 強制不更新（即使 needUpdate 為 true，也不返回更新）

    private String deviceName; // 顯示名稱（前端設定）

    private String userId; // 綁定的用戶 ID

    private boolean unbound; // 是否已解除綁定

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    // Guest QR Code 相關
    private String guestQRCodeToken; // Guest QR Code 的 token（用於生成 QR code URL）
}



