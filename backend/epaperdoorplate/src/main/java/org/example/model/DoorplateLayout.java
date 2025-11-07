package org.example.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document("doorplates")
public class DoorplateLayout {

    @Id
    private String id;

    private String userId;
    private String layoutName;

    // 這裡是內嵌的 List<LayoutElement>
    private List<ElementStyle> elements;

    private Instant updatedAt;

    // Getters and Setters
}
