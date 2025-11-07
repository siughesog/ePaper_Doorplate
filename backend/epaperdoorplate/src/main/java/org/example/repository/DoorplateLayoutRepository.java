package org.example.repository;

import org.example.model.DoorplateLayout;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DoorplateLayoutRepository extends MongoRepository<DoorplateLayout, String> {
    Optional<DoorplateLayout> findByUserId(String userId);

    Optional<DoorplateLayout> findByUserIdAndLayoutName(String userId, String layoutName);

    void deleteByUserIdAndLayoutName(String userId, String layoutName);

    List<DoorplateLayout> findAllByUserId(String userId);

}
