package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("hardware_whitelist")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HardwareWhitelist {

    @Id
    private String id;

    @Indexed(unique = true)
    private String uniqueId; // 允許的硬體唯一 ID
}

























