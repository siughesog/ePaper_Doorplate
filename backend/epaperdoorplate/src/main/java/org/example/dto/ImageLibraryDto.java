package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImageLibraryDto {
    private String id;
    private String name;
    private String originalImageId;
    private String originalImagePath;
    private double blackThreshold;
    private double whiteThreshold;
    private double contrast;
    private String processedImageUrl;
    private String format;
    private String description;
    private String[] tags;
}



