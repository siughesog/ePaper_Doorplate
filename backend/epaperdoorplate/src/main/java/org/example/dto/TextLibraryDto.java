package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TextLibraryDto {
    private String id;
    private String text;
    private String elementId; // 關聯到特定的動態文字元素
    private String description;
    private String[] tags;
}
