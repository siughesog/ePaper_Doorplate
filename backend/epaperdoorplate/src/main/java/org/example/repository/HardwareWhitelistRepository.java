package org.example.repository;

import org.example.model.HardwareWhitelist;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface HardwareWhitelistRepository extends MongoRepository<HardwareWhitelist, String> {
    Optional<HardwareWhitelist> findByUniqueId(String uniqueId);
}







