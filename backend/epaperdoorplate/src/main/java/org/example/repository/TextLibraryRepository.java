package org.example.repository;

import org.example.model.TextLibraryItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TextLibraryRepository extends MongoRepository<TextLibraryItem, String> {
    List<TextLibraryItem> findByUserId(String userId);
    List<TextLibraryItem> findByUserIdAndElementId(String userId, String elementId);
    void deleteByUserIdAndId(String userId, String id);
}
