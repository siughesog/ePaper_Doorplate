package org.example.repository;

import org.example.model.Device;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceRepository extends MongoRepository<Device, String> {
    Optional<Device> findByDeviceId(String deviceId);
    Optional<Device> findByUniqueId(String uniqueId);
    List<Device> findByUserIdAndUnboundFalse(String userId);
}


