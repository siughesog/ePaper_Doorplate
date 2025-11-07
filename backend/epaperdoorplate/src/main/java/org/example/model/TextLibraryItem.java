package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document("textLibrary")
public class TextLibraryItem {
    
    @Id
    private String id;
    
    private String userId;
    private String text;
    private String elementId; // 關聯到特定的動態文字元素
    private Instant createdAt;
    private Instant updatedAt;
    
    // 可選：描述或標籤
    private String description;
    private String[] tags;
}
