package org.example.dto;

import lombok.Data;

@Data
public class DetailDTO {
    private String fullName;
    private String department;
    private String comment;
    private String qrCodeUrl;
    private String labName;
    private String floor;
    private String status;

    private String statusTextSize;
    private String fullNameTextSize;
    private String departmentTextSize;
    private String labNameTextSize;
    private String floorTextSize;
    private String commentTextSize;
    private String qrCodeUrlTextSize;

    private String statusTextAlign;
    private String fullNameTextAlign;
    private String departmentTextAlign;
    private String labNameTextAlign;
    private String floorTextAlign;
    private String commentTextAlign;
    private String qrCodeUrlTextAlign;
}
