package org.example.repository;

import org.example.model.ImageLibraryItem;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ImageLibraryRepository extends MongoRepository<ImageLibraryItem, String> {
    
    List<ImageLibraryItem> findByUserId(String userId);
    
    List<ImageLibraryItem> findByUserIdAndNameContainingIgnoreCase(String userId, String name);
    
    void deleteByUserIdAndId(String userId, String id);
}



