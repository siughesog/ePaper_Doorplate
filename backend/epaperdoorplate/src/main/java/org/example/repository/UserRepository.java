package org.example.repository;

import org.example.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByUsername(String username);

    Optional<User> findByLineUserId(String lineUserId);

    // 你也可以加上其他查詢條件
    // Optional<User> findByUsernameAndPasswordHash(String username, String passwordHash);
}
