package org.example.repository;

import org.example.model.GuestMessageLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface GuestMessageLogRepository extends MongoRepository<GuestMessageLog, String> {
    
    // 查詢指定 IP 在指定時間範圍內的留言記錄
    List<GuestMessageLog> findByIpAddressAndCreatedAtAfter(String ipAddress, LocalDateTime after);
    
    // 查詢指定 deviceId 在指定時間範圍內的留言記錄
    List<GuestMessageLog> findByDeviceIdAndCreatedAtAfter(String deviceId, LocalDateTime after);
    
    // 查詢指定 IP + DeviceId 組合在指定時間範圍內的留言記錄
    @Query("{ 'ipDeviceKey': ?0, 'createdAt': { $gt: ?1 } }")
    List<GuestMessageLog> findByIpDeviceKeyAndCreatedAtAfter(String ipDeviceKey, LocalDateTime after);
}

