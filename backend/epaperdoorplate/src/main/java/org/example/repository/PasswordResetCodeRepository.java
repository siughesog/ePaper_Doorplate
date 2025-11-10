package org.example.repository;

import org.example.model.PasswordResetCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PasswordResetCodeRepository extends MongoRepository<PasswordResetCode, String> {
    Optional<PasswordResetCode> findByEmailAndCodeAndUsedFalse(String email, String code);
    Optional<PasswordResetCode> findFirstByEmailOrderByCreatedAtDesc(String email);
}

