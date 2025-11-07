package org.example.service;

import org.example.model.HardwareWhitelist;
import org.example.repository.HardwareWhitelistRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class HardwareWhitelistService {

    @Autowired
    private HardwareWhitelistRepository whitelistRepository;

    public List<HardwareWhitelist> getAllWhitelist() {
        return whitelistRepository.findAll();
    }

    public Map<String, Object> addToWhitelist(String uniqueId) {
        Map<String, Object> response = new HashMap<>();
        
        if (uniqueId == null || uniqueId.trim().isEmpty()) {
            response.put("success", false);
            response.put("message", "unique_id 不能為空");
            return response;
        }

        // 檢查是否已存在
        Optional<HardwareWhitelist> existing = whitelistRepository.findByUniqueId(uniqueId.trim());
        if (existing.isPresent()) {
            response.put("success", false);
            response.put("message", "此 unique_id 已在白名單中");
            return response;
        }

        // 新增到白名單
        HardwareWhitelist whitelist = new HardwareWhitelist();
        whitelist.setUniqueId(uniqueId.trim());
        whitelistRepository.save(whitelist);

        response.put("success", true);
        response.put("message", "已成功新增到白名單");
        response.put("uniqueId", uniqueId.trim());
        return response;
    }

    public Map<String, Object> removeFromWhitelist(String uniqueId) {
        Map<String, Object> response = new HashMap<>();
        
        if (uniqueId == null || uniqueId.trim().isEmpty()) {
            response.put("success", false);
            response.put("message", "unique_id 不能為空");
            return response;
        }

        Optional<HardwareWhitelist> existing = whitelistRepository.findByUniqueId(uniqueId.trim());
        if (existing.isEmpty()) {
            response.put("success", false);
            response.put("message", "此 unique_id 不在白名單中");
            return response;
        }

        HardwareWhitelist whitelist = existing.get();
        // 使用 deleteById 确保从数据库正确删除
        whitelistRepository.deleteById(whitelist.getId());
        response.put("success", true);
        response.put("message", "已成功從白名單移除");
        return response;
    }

    public Map<String, Object> checkWhitelist(String uniqueId) {
        Map<String, Object> response = new HashMap<>();
        
        if (uniqueId == null || uniqueId.trim().isEmpty()) {
            response.put("success", false);
            response.put("message", "unique_id 不能為空");
            return response;
        }

        Optional<HardwareWhitelist> existing = whitelistRepository.findByUniqueId(uniqueId.trim());
        response.put("success", true);
        response.put("isWhitelisted", existing.isPresent());
        response.put("uniqueId", uniqueId.trim());
        return response;
    }
}



