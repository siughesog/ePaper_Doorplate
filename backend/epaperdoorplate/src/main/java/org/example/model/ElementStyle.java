package org.example.model;

import lombok.Data;

@Data
public class ElementStyle {
    private String id;
    private String type;
    private int x;
    private int y;
    private int width;
    private int height;

    private String imageUrl;
    private String imageId;
    private String Name;
    private String text;
    private String color;


    private int fontSize;
    private int letterSpacing;
    private int blackThreshold;
    private int whiteThreshold;
    private double contrast;
    private String content;
    private String textDirection;
    private String selectedImageId; // 動態圖片庫項目的ID（用於 dynamicImage 類型）
}
