package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "display_info")
@Data
@NoArgsConstructor
@AllArgsConstructor
// DetailData.java
public class DisplayInfo {

    @Id
    private String id;


    private String userId;
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

    // getters & setters
}
