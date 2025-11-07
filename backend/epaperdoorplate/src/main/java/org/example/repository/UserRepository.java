package org.example.repository;

import org.example.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

    User findByUsername(String username);

    // 你也可以加上其他查詢條件
    // Optional<User> findByUsernameAndPasswordHash(String username, String passwordHash);
}
