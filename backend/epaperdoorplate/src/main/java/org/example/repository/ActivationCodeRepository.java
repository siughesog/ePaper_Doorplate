package org.example.repository;

import org.example.model.ActivationCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ActivationCodeRepository extends MongoRepository<ActivationCode, String> {
    Optional<ActivationCode> findByActivationCode(String activationCode);
    List<ActivationCode> findByUniqueId(String uniqueId);
}







