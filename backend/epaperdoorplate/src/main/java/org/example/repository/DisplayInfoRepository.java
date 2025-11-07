package org.example.repository;

import org.example.model.DisplayInfo;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DisplayInfoRepository extends MongoRepository<DisplayInfo, String> {
    Optional<DisplayInfo> findByFullName(String fullName);
}
