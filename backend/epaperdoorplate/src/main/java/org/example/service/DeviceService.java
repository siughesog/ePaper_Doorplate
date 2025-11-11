package org.example.service;

import org.example.model.ActivationCode;
import org.example.model.Device;
import org.example.model.HardwareWhitelist;
import org.example.model.User;
import org.example.repository.ActivationCodeRepository;
import org.example.repository.DeviceRepository;
import org.example.repository.HardwareWhitelistRepository;
import org.example.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class DeviceService {

    @Autowired
    private DeviceRepository deviceRepository;

    @Autowired
    private ActivationCodeRepository activationCodeRepository;

    @Autowired
    private HardwareWhitelistRepository whitelistRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DoorplateRendererService rendererService;

    @Autowired
    private DoorplateLayoutService layoutService;

    @Autowired
    private MongoTemplate mongoTemplate;

    private static final SecureRandom RANDOM = new SecureRandom();

    public Map<String, Object> activate(String uniqueId) {
        System.out.println("\n========== 設備激活API ==========");
        System.out.println("unique_id: " + uniqueId);
        
        Optional<HardwareWhitelist> allow = whitelistRepository.findByUniqueId(uniqueId);
        Map<String, Object> resp = new HashMap<>();
        if (allow.isEmpty()) {
            System.out.println("❌ unique_id 不在白名單中");
            resp.put("success", false);
            resp.put("message", "unique_id not in whitelist");
            return resp;
        }

        // 檢查設備是否已經綁定
        Optional<Device> existingDevice = deviceRepository.findByUniqueId(uniqueId);
        if (existingDevice.isPresent()) {
            Device device = existingDevice.get();
            // 如果設備已激活且未解綁，返回設備狀態
            if (device.isActivated() && !device.isUnbound()) {
                String deviceId = device.getDeviceId();
                System.out.println("✅ 設備已激活，返回狀態資訊");
                System.out.println("   - deviceID: " + deviceId);
                System.out.println("   - needUpdate: " + device.isNeedUpdate());
                System.out.println("   - currentTemplateId: " + device.getCurrentTemplateId());
                
                // 返回類似 status API 的響應
                resp.put("success", true);
                resp.put("alreadyActivated", true);
                resp.put("deviceID", deviceId);
                resp.put("isActivated", true);
                resp.put("needUpdate", device.isNeedUpdate());
                resp.put("refreshInterval", device.getRefreshInterval());
                
                // 注意：activate 不再回傳 binData / binSize，統一交由 /device/status 負責
                
                // 輸出響應摘要
                System.out.println("\n📤 響應內容摘要:");
                System.out.println("   - success: " + resp.get("success"));
                System.out.println("   - alreadyActivated: " + resp.get("alreadyActivated"));
                System.out.println("   - deviceID: " + resp.get("deviceID"));
                System.out.println("   - needUpdate: " + resp.get("needUpdate"));
                // 不輸出 bin 相關欄位
                
                // 輸出響應字段列表（不輸出 binData 內容）
                System.out.println("\n📋 響應字段列表:");
                for (String key : resp.keySet()) {
                    Object value = resp.get(key);
                    if ("binData".equals(key) && value instanceof String) {
                        String binDataStr = (String) value;
                        System.out.println("   - " + key + ": [Base64字符串, 長度=" + binDataStr.length() + " 字符]");
                    } else {
                        System.out.println("   - " + key + ": " + value);
                    }
                }
                
                System.out.println("========== 激活API完成 ==========\n");
                
                return resp;
            }
        }

        // 檢查是否已經存在未過期的激活碼
        List<ActivationCode> existingCodes = activationCodeRepository.findByUniqueId(uniqueId);
        LocalDateTime now = LocalDateTime.now();
        
        if (!existingCodes.isEmpty()) {
            // 查找未過期的激活碼（按創建時間降序排序，選擇最新的）
            ActivationCode validCode = existingCodes.stream()
                .filter(ac -> ac.getExpireAt() != null && ac.getExpireAt().isAfter(now))
                .sorted((a, b) -> {
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt()); // 降序，最新的在前
                })
                .findFirst()
                .orElse(null);
            
            if (validCode != null) {
                System.out.println("✅ 發現未過期的激活碼，返回現有激活碼");
                System.out.println("   - activation_code: " + validCode.getActivationCode());
                System.out.println("   - expire_at: " + validCode.getExpireAt());
                System.out.println("   - 共找到 " + existingCodes.size() + " 個激活碼記錄，其中 " + 
                    existingCodes.stream().filter(ac -> ac.getExpireAt() != null && ac.getExpireAt().isAfter(now)).count() + 
                    " 個未過期");
                
                resp.put("success", true);
                resp.put("alreadyActivated", false);
                resp.put("activation_code", validCode.getActivationCode());
                resp.put("expire_at", validCode.getExpireAt().toString());
                return resp;
            } else {
                // 所有激活碼都已過期，刪除所有過期的激活碼
                System.out.println("⚠️ 發現 " + existingCodes.size() + " 個激活碼記錄，但都已過期，將刪除並生成新的激活碼");
                activationCodeRepository.deleteAll(existingCodes);
            }
        }

        // 設備未激活或未綁定，且沒有未過期的激活碼，生成新的激活碼
        String code = generateComplexActivationCode();
        ActivationCode ac = new ActivationCode();
        ac.setActivationCode(code);
        ac.setUniqueId(uniqueId);
        ac.setCreatedAt(now);
        ac.setExpireAt(now.plusMinutes(5));
        activationCodeRepository.save(ac);

        System.out.println("✅ 生成新的激活碼");
        System.out.println("   - activation_code: " + code);
        System.out.println("   - expire_at: " + ac.getExpireAt());

        resp.put("success", true);
        resp.put("alreadyActivated", false);
        resp.put("activation_code", code);
        resp.put("expire_at", ac.getExpireAt().toString());
        
        // 嘗試找到並渲染激活碼顯示佈局
        try {
            System.out.println("🔄 開始查找激活碼顯示佈局");
            Optional<org.example.model.DoorplateLayout> layoutOpt = layoutService.findLayoutByUserIdAndName("superUser", "EP");
            
            if (layoutOpt.isPresent()) {
                System.out.println("✅ 找到激活碼顯示佈局 (superUser/EP)");
                org.example.model.DoorplateLayout layout = layoutOpt.get();
                List<Map<String, Object>> elements = convertElementStylesToMap(layout.getElements());
                
                // 找到 Name="activationCode" 的元素並更新其 text
                boolean foundActivationCodeElement = false;
                for (Map<String, Object> element : elements) {
                    // 同時檢查 "name" 和 "Name" 以確保兼容性
                    String elementName = (String) element.get("name");
                    if (elementName == null) {
                        elementName = (String) element.get("Name");
                    }
                    if ("activationCode".equals(elementName)) {
                        foundActivationCodeElement = true;
                        element.put("text", code);
                        System.out.println("✅ 已更新激活碼元素，將 text 設為: " + code);
                        System.out.println("   元素 ID: " + element.get("id"));
                        System.out.println("   元素類型: " + element.get("type"));
                        System.out.println("   元素 Name: " + elementName);
                        break;
                    }
                }
                
                if (!foundActivationCodeElement) {
                    System.out.println("⚠️ 未找到 Name='activationCode' 的元素");
                }
                
                // 渲染門牌並獲取 bin 數據
                System.out.println("🚀 開始渲染激活碼顯示門牌");
                DoorplateRendererService.RenderResult result = rendererService.renderDoorplate(elements, layout.getId());
                byte[] binData = result.getBinData();
                
                if (binData != null && binData.length > 0) {
                    String base64Data = java.util.Base64.getEncoder().encodeToString(binData);
                    resp.put("binData", base64Data);
                    resp.put("binSize", binData.length);
                    System.out.println("✅ 成功生成並返回 bin 數據");
                    System.out.println("   - 原始大小: " + binData.length + " bytes");
                    System.out.println("   - Base64 大小: " + base64Data.length() + " 字符");
                } else {
                    System.out.println("❌ bin 數據為空或未生成");
                }
            } else {
                System.out.println("⚠️ 未找到激活碼顯示佈局 (superUser/EP)，跳過 binData 生成");
            }
        } catch (Exception e) {
            System.err.println("❌ 處理激活碼顯示佈局失敗: " + e.getMessage());
            e.printStackTrace();
            // 不影響激活碼的返回，只是沒有 binData
        }
        
        return resp;
    }

    public Map<String, Object> bind(String activationCode, String deviceName, String username) {
        Map<String, Object> resp = new HashMap<>();
        Optional<ActivationCode> acOpt = activationCodeRepository.findByActivationCode(activationCode);
        if (acOpt.isEmpty()) {
            resp.put("success", false);
            resp.put("message", "invalid activation code");
            return resp;
        }
        ActivationCode ac = acOpt.get();
        if (ac.getExpireAt() == null || ac.getExpireAt().isBefore(LocalDateTime.now())) {
            resp.put("success", false);
            resp.put("message", "activation code expired");
            return resp;
        }

        String uniqueId = ac.getUniqueId();
        Optional<Device> existingByUnique = deviceRepository.findByUniqueId(uniqueId);

        String deviceId = existingByUnique.map(Device::getDeviceId).orElseGet(() -> generateDeviceId());

        User user = userRepository.findByUsername(username).orElse(null);
        String userId = user != null ? user.getId() : null;

        Device device = existingByUnique.orElseGet(Device::new);
        boolean isNewDevice = existingByUnique.isEmpty();
        
        device.setUniqueId(uniqueId);
        device.setDeviceId(deviceId);
        device.setActivated(true);
        device.setActivationCode(null);
        device.setDeviceName(deviceName);
        device.setUserId(userId);
        if (device.getRefreshInterval() == null) {
            device.setRefreshInterval(300); // default 5 minutes
        }
        device.setNeedUpdate(false);
        device.setForceNoUpdate(false); // 默認不強制不更新
        device.setUnbound(false);

        LocalDateTime now = LocalDateTime.now();
        if (device.getCreatedAt() == null) {
            device.setCreatedAt(now);
        }
        device.setUpdatedAt(now);

        // 生成 Guest QR Code Token（如果還沒有）
        if (device.getGuestQRCodeToken() == null || device.getGuestQRCodeToken().isEmpty()) {
            device.setGuestQRCodeToken(UUID.randomUUID().toString());
        }

        deviceRepository.save(device);

        // 如果是新設備，確保 currentTemplateId 字段存在於數據庫中（即使為 null）
        // 使用 MongoTemplate 的 Update 操作來確保字段被保存到數據庫
        if (isNewDevice) {
            Query query = new Query(Criteria.where("deviceId").is(deviceId));
            Update update = new Update();
            // 使用 $set 確保 currentTemplateId 字段被保存（即使值為 null）
            // 這樣可以確保字段在數據庫中存在，方便後續查詢和更新
            update.set("currentTemplateId", device.getCurrentTemplateId());
            mongoTemplate.updateFirst(query, update, Device.class);
        }

        // 綁定成功後，可以刪除此激活碼避免重複使用
        activationCodeRepository.delete(ac);

        resp.put("success", true);
        resp.put("deviceID", deviceId);
        resp.put("isActivated", true);
        resp.put("refreshInterval", device.getRefreshInterval());
        resp.put("currentDoorplateId", device.getCurrentDoorplateId());
        return resp;
    }

    public Map<String, Object> update(String deviceId, String deviceName, Integer refreshInterval, Boolean forceNoUpdate) {
        Map<String, Object> resp = new HashMap<>();
        Optional<Device> devOpt = deviceRepository.findByDeviceId(deviceId);
        if (devOpt.isEmpty()) {
            resp.put("success", false);
            resp.put("message", "device not found");
            return resp;
        }
        Device device = devOpt.get();
        if (deviceName != null && !deviceName.isBlank()) {
            device.setDeviceName(deviceName);
        }
        if (refreshInterval != null) {
            // 驗證刷新間隔必須 >= 300 秒
            if (refreshInterval < 300) {
                resp.put("success", false);
                resp.put("message", "刷新間隔必須至少 300 秒");
                return resp;
            }
            device.setRefreshInterval(refreshInterval);
        }
        if (forceNoUpdate != null) {
            device.setForceNoUpdate(forceNoUpdate);
            // 如果強制不更新為 true，則 needUpdate 永遠為 false
            if (forceNoUpdate) {
                device.setNeedUpdate(false);
            }
        }
        // 只有在強制不更新為 false 時，才設置 needUpdate = true
        if (!device.isForceNoUpdate()) {
            device.setNeedUpdate(true);
        }
        // 注意：updatedAt 只在設備發送 Status 請求時更新，不在這裡更新
        deviceRepository.save(device);

        resp.put("success", true);
        return resp;
    }

    public Map<String, Object> unbind(String deviceId) {
        Map<String, Object> resp = new HashMap<>();
        Optional<Device> devOpt = deviceRepository.findByDeviceId(deviceId);
        if (devOpt.isEmpty()) {
            resp.put("success", false);
            resp.put("message", "device not found");
            return resp;
        }
        Device device = devOpt.get();
        device.setActivated(false);
        device.setUnbound(true);
        device.setNeedUpdate(false);
        device.setCurrentDoorplateId(null);
        device.setUpdatedAt(LocalDateTime.now());
        deviceRepository.save(device);
        resp.put("success", true);
        return resp;
    }

    public Map<String, Object> status(String deviceId) {
        return status(deviceId, true); // 默認是設備請求，會改變狀態
    }

    public Map<String, Object> status(String deviceId, boolean isDeviceRequest) {
        System.out.println("\n========== 設備狀態查詢 ==========");
        System.out.println("設備ID: " + deviceId);
        System.out.println("請求來源: " + (isDeviceRequest ? "設備請求（會改變狀態）" : "前端查詢（不改變狀態）"));
        
        Map<String, Object> resp = new HashMap<>();
        Optional<Device> devOpt = deviceRepository.findByDeviceId(deviceId);
        if (devOpt.isEmpty()) {
            System.out.println("❌ 設備不存在");
            resp.put("success", false);
            resp.put("message", "device not found");
            return resp;
        }
        Device device = devOpt.get();
        if (!device.isActivated() || device.isUnbound()) {
            System.out.println("⚠️ 設備未激活或已解綁");
            resp.put("success", true);
            resp.put("isActivated", false);
            resp.put("action", "return_to_activation");
            return resp;
        }

        System.out.println("✅ 設備已激活");
        System.out.println("   - needUpdate: " + device.isNeedUpdate());
        System.out.println("   - forceNoUpdate: " + device.isForceNoUpdate());
        System.out.println("   - currentTemplateId: " + device.getCurrentTemplateId());
        System.out.println("   - refreshInterval: " + device.getRefreshInterval());

        // 如果強制不更新為 true，則 needUpdate 永遠為 false
        // 但只有設備請求時才保存這個改變（前端查詢時只讀取狀態）
        if (device.isForceNoUpdate()) {
            if (isDeviceRequest) {
                device.setNeedUpdate(false);
                System.out.println("   - 強制不更新已啟用，將 needUpdate 設為 false（設備請求，已保存）");
            } else {
                System.out.println("   - 強制不更新已啟用，needUpdate 應為 false（前端查詢，不保存）");
            }
        }

        // 只有設備請求時才更新 updatedAt（最後更新時間）
        if (isDeviceRequest) {
            device.setUpdatedAt(LocalDateTime.now());
            deviceRepository.save(device);
            System.out.println("   - 已更新最後更新時間: " + device.getUpdatedAt());
        }

        resp.put("success", true);
        resp.put("isActivated", true);
        // 如果強制不更新為 true，響應中的 needUpdate 應該為 false（即使前端查詢不保存）
        boolean responseNeedUpdate = device.isForceNoUpdate() ? false : device.isNeedUpdate();
        resp.put("needUpdate", responseNeedUpdate);
        resp.put("refreshInterval", device.getRefreshInterval());
        
        // 如果有模板配置，嘗試獲取 bin 檔案
        if (device.getCurrentTemplateId() != null) {
            System.out.println("📋 設備有模板配置，開始處理 bin 檔案");
            try {
                // 檢查是否強制不更新
                boolean shouldGenerate = device.isNeedUpdate() && !device.isForceNoUpdate();
                System.out.println("   - needUpdate: " + device.isNeedUpdate());
                System.out.println("   - forceNoUpdate: " + device.isForceNoUpdate());
                System.out.println("   - 是否需要生成新檔案: " + shouldGenerate);
                
                // 渲染門牌並獲取 bin 數據（不保存文件，直接返回）
                System.out.println("🔄 開始渲染門牌並生成 bin 數據");
                // 根據模板ID獲取模板數據
                Optional<org.example.model.DoorplateLayout> layoutOpt = layoutService.findLayoutById(device.getCurrentTemplateId());
                if (layoutOpt.isEmpty()) {
                    resp.put("message", "template not found: " + device.getCurrentTemplateId());
                    return resp;
                }
                
                org.example.model.DoorplateLayout layout = layoutOpt.get();
                List<Map<String, Object>> elements = convertElementStylesToMap(layout.getElements());
                
                // 為 guestQRCode 元素添加 token
                String guestQRCodeToken = device.getGuestQRCodeToken();
                System.out.println("🔍 檢查 Guest QR Code Token");
                System.out.println("   Device ID: " + deviceId);
                System.out.println("   Token: " + (guestQRCodeToken != null ? guestQRCodeToken : "null"));
                
                if (guestQRCodeToken == null || guestQRCodeToken.isEmpty()) {
                    System.err.println("⚠️ Guest QR Code Token 為空，生成新的 token");
                    guestQRCodeToken = UUID.randomUUID().toString();
                    device.setGuestQRCodeToken(guestQRCodeToken);
                    deviceRepository.save(device);
                    System.out.println("✅ 已生成新的 Guest QR Code Token: " + guestQRCodeToken);
                }
                
                int guestQRCodeCount = 0;
                System.out.println("🔍 開始檢查所有元素，總數: " + elements.size());
                for (Map<String, Object> element : elements) {
                    String elementType = (String) element.get("type");
                    System.out.println("   元素類型: " + elementType + ", ID: " + element.get("id"));
                    if ("guestQRCode".equals(elementType)) {
                        guestQRCodeCount++;
                        element.put("guestQRCodeToken", guestQRCodeToken);
                        System.out.println("✅ 已為 Guest QR Code 元素添加 token");
                        System.out.println("   元素 ID: " + element.get("id"));
                        System.out.println("   元素位置: x=" + element.get("x") + ", y=" + element.get("y"));
                        System.out.println("   Token 值: " + guestQRCodeToken);
                        System.out.println("   添加後元素所有鍵: " + element.keySet());
                        System.out.println("   驗證 token 是否存在: " + element.containsKey("guestQRCodeToken"));
                        System.out.println("   驗證 token 值: " + element.get("guestQRCodeToken"));
                    }
                }
                
                if (guestQRCodeCount == 0) {
                    System.out.println("ℹ️ 模板中沒有 Guest QR Code 元素");
                } else {
                    System.out.println("📊 找到 " + guestQRCodeCount + " 個 Guest QR Code 元素");
                }
                
                // 再次驗證 token 是否還在 elements 中
                System.out.println("🔍 傳遞給 rendererService 前的最後檢查:");
                for (Map<String, Object> element : elements) {
                    if ("guestQRCode".equals(element.get("type"))) {
                        System.out.println("   Guest QR Code 元素 - Token: " + element.get("guestQRCodeToken"));
                        System.out.println("   元素所有鍵: " + element.keySet());
                    }
                }
                
                // 渲染門牌（直接返回數據，不保存文件）
                System.out.println("🚀 調用 rendererService.renderDoorplate，傳遞 " + elements.size() + " 個元素");
                DoorplateRendererService.RenderResult result = rendererService.renderDoorplate(elements, device.getCurrentTemplateId());
                byte[] binData = result.getBinData();
                
                if (binData != null && binData.length > 0) {
                    String base64Data = java.util.Base64.getEncoder().encodeToString(binData);
                    resp.put("binData", base64Data);
                    resp.put("binSize", binData.length);
                    
                    // 如果需要更新，且是設備請求（不是前端查詢），才標記為已更新
                    if (shouldGenerate && isDeviceRequest) {
                        device.setNeedUpdate(false);
                        deviceRepository.save(device);
                        System.out.println("✅ 生成並返回 bin 數據（設備請求，已標記為已更新，needUpdate 設為 false）:");
                    } else if (shouldGenerate && !isDeviceRequest) {
                        System.out.println("✅ 返回 bin 數據（前端查詢，不改變 needUpdate 狀態）:");
                    } else {
                        System.out.println("✅ 返回 bin 數據（無需更新）:");
                    }
                    
                    System.out.println("   - 原始大小: " + binData.length + " bytes");
                    System.out.println("   - Base64 大小: " + base64Data.length() + " 字符");
                    System.out.println("   - 響應中包含 binData: 是");
                } else {
                    System.out.println("❌ bin 數據為空或未生成");
                    resp.put("message", "bin data not generated");
                }
            } catch (Exception e) {
                System.err.println("❌ 處理 bin 檔案失敗: " + e.getMessage());
                e.printStackTrace();
                resp.put("message", "failed to process bin file: " + e.getMessage());
            }
        } else {
            System.out.println("⚠️ 設備沒有模板配置 (currentTemplateId: null)");
            System.out.println("   - 響應中包含 binData: 否");
        }
        
        // 輸出最終響應摘要
        System.out.println("\n📤 響應內容摘要:");
        System.out.println("   - success: " + resp.get("success"));
        System.out.println("   - isActivated: " + resp.get("isActivated"));
        System.out.println("   - needUpdate: " + resp.get("needUpdate"));
        System.out.println("   - refreshInterval: " + resp.get("refreshInterval"));
        System.out.println("   - 包含 binData: " + resp.containsKey("binData"));
        System.out.println("   - binSize: " + (resp.containsKey("binSize") ? resp.get("binSize") : "無"));
        
        if (resp.containsKey("binData")) {
            String binDataStr = (String) resp.get("binData");
            System.out.println("   - binData 長度: " + (binDataStr != null ? binDataStr.length() : 0) + " 字符");
            if (binDataStr != null && binDataStr.length() > 0) {
                System.out.println("   - binData 前50字符: " + binDataStr.substring(0, Math.min(50, binDataStr.length())) + "...");
                System.out.println("   - binData 後50字符: ..." + binDataStr.substring(Math.max(0, binDataStr.length() - 50)));
            }
        }
        
        if (resp.containsKey("message")) {
            System.out.println("   - message: " + resp.get("message"));
        }
        
        // 輸出響應字段列表（不輸出 binData 內容）
        System.out.println("\n📋 響應字段列表:");
        for (String key : resp.keySet()) {
            Object value = resp.get(key);
            if ("binData".equals(key) && value instanceof String) {
                String binDataStr = (String) value;
                System.out.println("   - " + key + ": [Base64字符串, 長度=" + binDataStr.length() + " 字符]");
            } else {
                System.out.println("   - " + key + ": " + value);
            }
        }
        
        System.out.println("========== 狀態查詢完成 ==========\n");
        
        return resp;
    }

    /**
     * 生成複雜的激活碼（包含大小寫字母和數字）
     * 格式：12-16位字符，包含大寫字母、小寫字母和數字
     * 例如：A7bK9mP2xQ4nR8
     */
    private String generateComplexActivationCode() {
        // 字符集：大寫字母、小寫字母、數字（排除易混淆的字符）
        String uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 排除 I, O
        String lowercase = "abcdefghijkmnpqrstuvwxyz";   // 排除 l, o
        String digits = "23456789";                     // 排除 0, 1（容易與 O, I 混淆）
        String allChars = uppercase + lowercase + digits;
        
        // 生成12-16位隨機長度
        int length = 12 + RANDOM.nextInt(5); // 12-16位
        
        StringBuilder sb = new StringBuilder();
        
        // 確保至少包含一個大寫字母、一個小寫字母和一個數字
        sb.append(uppercase.charAt(RANDOM.nextInt(uppercase.length())));
        sb.append(lowercase.charAt(RANDOM.nextInt(lowercase.length())));
        sb.append(digits.charAt(RANDOM.nextInt(digits.length())));
        
        // 填充剩餘位置
        for (int i = 3; i < length; i++) {
            sb.append(allChars.charAt(RANDOM.nextInt(allChars.length())));
        }
        
        // 打亂順序以增加隨機性
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char temp = chars[i];
            chars[i] = chars[j];
            chars[j] = temp;
        }
        
        return new String(chars);
    }

    /**
     * 舊的純數字生成方法（保留以備不時之需）
     * @deprecated 使用 generateComplexActivationCode() 代替
     */
    @Deprecated
    @SuppressWarnings("unused")
    private String generateNumericCode(int digits) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digits; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    public Map<String, Object> getUserDevices(String username) {
        Map<String, Object> resp = new HashMap<>();
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            resp.put("success", false);
            resp.put("message", "user not found");
            return resp;
        }

        // 獲取用戶的所有已綁定且未解除綁定的設備
        java.util.List<Device> userDevices = deviceRepository.findByUserIdAndUnboundFalse(user.getId());
        
        // 確保設備列表中的每個設備都有正確的激活狀態
        // Device對象會通過Jackson自動序列化，@JsonProperty會確保isActivated字段正確映射
        
        resp.put("success", true);
        resp.put("devices", userDevices);
        resp.put("count", userDevices.size());
        return resp;
    }

    public Map<String, Object> updateDeviceTemplate(String deviceId, String templateId) {
        Map<String, Object> resp = new HashMap<>();
        Optional<Device> devOpt = deviceRepository.findByDeviceId(deviceId);
        if (devOpt.isEmpty()) {
            resp.put("success", false);
            resp.put("message", "device not found");
            return resp;
        }
        
        Device device = devOpt.get();
        device.setCurrentTemplateId(templateId);
        // 如果強制不更新為 true，則 needUpdate 永遠為 false
        if (device.isForceNoUpdate()) {
            device.setNeedUpdate(false);
        } else {
            // 只有在強制不更新為 false 時，才設置 needUpdate = true
            device.setNeedUpdate(true);
        }
        // 注意：updatedAt 只在設備發送 Status 請求時更新，不在這裡更新
        deviceRepository.save(device);
        
        resp.put("success", true);
        resp.put("message", "device template updated");
        return resp;
    }

    private String generateDeviceId() {
        return UUID.randomUUID().toString();
    }


    private List<Map<String, Object>> convertElementStylesToMap(List<org.example.model.ElementStyle> elementStyles) {
        return elementStyles.stream()
                .map(elementStyle -> {
                    Map<String, Object> elementMap = new HashMap<>();
                    elementMap.put("id", elementStyle.getId());
                    elementMap.put("type", elementStyle.getType());
                    elementMap.put("name", elementStyle.getName());
                    elementMap.put("x", elementStyle.getX());
                    elementMap.put("y", elementStyle.getY());
                    elementMap.put("width", elementStyle.getWidth());
                    elementMap.put("height", elementStyle.getHeight());
                    elementMap.put("content", elementStyle.getContent());
                    elementMap.put("text", elementStyle.getText());
                    elementMap.put("fontSize", elementStyle.getFontSize());
                    elementMap.put("color", elementStyle.getColor());
                    elementMap.put("letterSpacing", elementStyle.getLetterSpacing());
                    elementMap.put("textDirection", elementStyle.getTextDirection());
                    elementMap.put("imageUrl", elementStyle.getImageUrl());
                    elementMap.put("imageId", elementStyle.getImageId());
                    elementMap.put("blackThreshold", elementStyle.getBlackThreshold());
                    elementMap.put("whiteThreshold", elementStyle.getWhiteThreshold());
                    elementMap.put("contrast", elementStyle.getContrast());
                    
                    // 添加 zIndex（如果 ElementStyle 有這個欄位，否則使用預設值）
                    elementMap.put("zIndex", 1); // 預設值，如果 ElementStyle 有 zIndex 欄位可以從那裡獲取
                    
                    return elementMap;
                })
                .collect(java.util.stream.Collectors.toList());
    }
}


