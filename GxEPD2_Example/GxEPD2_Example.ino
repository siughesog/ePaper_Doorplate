#define ENABLE_GxEPD2_GFX 0

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPping.h>
#include <WebServer.h>

#define CHUNK_SIZE 800  // 每次讀取的位元組數（用於驗證binData格式）
#define BUTTON_PIN_1 34
#define BUTTON_PIN_2 35  // 用於強制查詢狀態
#define BUTTON_STATUS_PIN BUTTON_PIN_2

// WiFi 配置
// ⚠️ 安全提示：WiFi 憑證從 Preferences 存儲中讀取
// 如果首次運行或WiFi連接失敗，設備將自動進入AP模式
// 用戶可以通過Web頁面（http://192.168.4.1）配置WiFi憑證
const char* default_ssid = "";  // 預設為空，必須通過Web頁面設置
const char* default_password = "";  // 預設為空，必須通過Web頁面設置

// API 配置
const char* api_base_url = "https://10.236.124.201:8080";
const unsigned long api_timeout = 10000;  // 10秒超時

// AP 模式配置
const char* ap_ssid = "ESP32-WiFi-Config";
const char* ap_password = "12345678";  // AP 密碼（至少8個字符）
WebServer server(80);  // Web 服務器端口
bool isAPMode = false;  // 是否處於 AP 模式

// 持久化存儲
Preferences preferences;
const char* prefs_namespace = "device_config";
const char* wifi_namespace = "wifi_config";  // WiFi 配置的命名空間

// WiFi 憑證變數（從 Preferences 讀取）
String wifi_ssid = "";
String wifi_password = "";

// 全局變量
bool actionTaken = false;
unsigned long startTime = millis();
const unsigned long button_timeout = 5000;  // 按鈕檢測超時5秒

// 設備狀態結構
struct DeviceConfig {
  bool success;
  bool isActivated;
  bool needUpdate;
  int refreshInterval;  // 秒
  bool hasBinData;
  int binSize;
};

DeviceConfig savedConfig = {false, false, false, 300, false, 0};

// 激活碼結構
struct ActivationInfo {
  String activation_code;
  String expire_at;
  bool isValid;
};

ActivationInfo activationInfo = {"", "", false};

// Base64解碼函數聲明
bool is_base64(unsigned char c);
String base64_decode_simple(String input);

// Base64解碼函數實現
bool is_base64(unsigned char c) {
  return (isalnum(c) || (c == '+') || (c == '/'));
}

String base64_decode_simple(String input) {
  const char* base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String output = "";
  int in_len = input.length();
  int i = 0;
  int j = 0;
  int in = 0;
  char char_array_4[4], char_array_3[3];
  
  while (in_len-- && (input[in] != '=') && is_base64(input[in])) {
    char_array_4[i++] = input[in]; in++;
    if (i == 4) {
      for (i = 0; i < 4; i++) {
        int idx = -1;
        for (int k = 0; k < 64; k++) {
          if (base64_chars[k] == char_array_4[i]) {
            idx = k;
            break;
          }
        }
        char_array_4[i] = (idx >= 0) ? idx : 0;
      }
      
      char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
      char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
      char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
      
      for (i = 0; (i < 3); i++)
        output += char_array_3[i];
      i = 0;
    }
  }
  
  if (i) {
    for (j = i; j < 4; j++)
      char_array_4[j] = 0;
    
    for (j = 0; j < 4; j++) {
      int idx = -1;
      for (int k = 0; k < 64; k++) {
        if (base64_chars[k] == char_array_4[j]) {
          idx = k;
          break;
        }
      }
      char_array_4[j] = (idx >= 0) ? idx : 0;
    }
    
    char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
    char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
    char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
    
    for (j = 0; (j < i - 1); j++) output += char_array_3[j];
  }
  
  return output;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println("========== ESP32 啟動 ==========");
  
  // 初始化按鈕
  pinMode(BUTTON_PIN_1, INPUT_PULLUP);
  pinMode(BUTTON_PIN_2, INPUT_PULLUP);
  
  // 初始化持久化存儲
  preferences.begin(prefs_namespace, false);
  
  // 載入 WiFi 憑證
  loadWiFiCredentials();
  
  // 載入保存的配置
  loadSavedConfig();
  
  // 檢查喚醒原因
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  
  if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) {
    Serial.println("🌞 從按鈕喚醒");
  } else if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) {
    Serial.println("⏰ 從定時器喚醒");
  } else {
    Serial.println("🔌 首次啟動或重置");
  }
  
  // 嘗試連接 WiFi
  bool wifiConnected = false;
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("📶 嘗試連接 WiFi: " + wifi_ssid);
    wifiConnected = connectWiFi();
  } else {
    Serial.println("⚠️ WiFi 憑證未設置");
  }
  
  // 如果 WiFi 連接失敗或未配置，啟動 AP 模式
  if (!wifiConnected) {
    Serial.println("❌ WiFi 連接失敗，啟動 AP 模式進行配置");
    startAPMode();
    return;  // AP 模式下不執行後續邏輯，持續運行 Web 服務器
  }
  
  // WiFi 連接成功，執行正常邏輯
  Serial.println("✅ WiFi 連接成功");
  
  // 獲取設備唯一ID
  String uniqueId = getChipId();
  Serial.println("📱 設備唯一ID: " + uniqueId);
  
  // 檢查是否有 deviceID（判斷是否已激活）
      String deviceID = preferences.getString("deviceID", "");
  bool isActivated = (deviceID.length() > 0);
  
  if (isActivated) {
    // 有 deviceID，發送 Status
    Serial.println("📡 檢測到已保存的 deviceID，查詢狀態");
        callDeviceStatusAPI(deviceID);
      } else {
    // 沒有 deviceID，發送 Activate
        Serial.println("🔐 無 deviceID，進行激活流程");
        callActivateAPI(uniqueId);
  }
  
  // 檢查激活碼是否過期（如果有激活碼）
  if (activationInfo.isValid) {
    checkActivationCodeExpiry();
  }
  
  // 在調用API後，再次檢查是否真的有deviceID（從後端成功獲取）
  // 如果API調用失敗或沒有返回deviceID，就不配置定時喚醒
  String finalDeviceID = preferences.getString("deviceID", "");
  bool hasDeviceIDFromBackend = (finalDeviceID.length() > 0);
  
  if (hasDeviceIDFromBackend) {
    Serial.println("✅ 確認已從後端獲取到 deviceID: " + finalDeviceID);
  } else {
    Serial.println("⚠️ 未從後端獲取到 deviceID，將不配置定時喚醒");
  }
  
  // 完成後進入深度睡眠
  // 只有成功從後端獲取到deviceID，才配置定時喚醒
  goToDeepSleep(savedConfig.refreshInterval, hasDeviceIDFromBackend);
}

void loop() {
  // 如果處於 AP 模式，處理 Web 服務器請求
  if (isAPMode) {
    server.handleClient();
    delay(10);
  }
  // 否則不使用loop，所有邏輯在setup中完成
}

bool connectWiFi() {
  // 檢查 WiFi 憑證是否已設置
  if (wifi_ssid.length() == 0 || wifi_password.length() == 0) {
    Serial.println("❌ WiFi 憑證未設置！");
    Serial.println("💡 請使用 setWiFiCredentials() 函數設置 WiFi 憑證");
    Serial.println("💡 或修改程式碼中的 default_ssid 和 default_password（僅用於開發）");
    return false;
  }
  
  Serial.println("📶 正在連接 WiFi: " + wifi_ssid);
  WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi 連接成功");
    Serial.println("📍 IP 地址: " + WiFi.localIP().toString());
    return true;
  } else {
    Serial.println("\n❌ WiFi 連接失敗");
    return false;
  }
}

String getChipId() {
  uint64_t chipid = ESP.getEfuseMac();
  char chipIdStr[20];
  snprintf(chipIdStr, sizeof(chipIdStr), "%04X%08X", (uint16_t)(chipid >> 32), (uint32_t)chipid);
  return String(chipIdStr);
}

void callActivateAPI(String uniqueId) {
  Serial.println("\n========== 調用激活API ==========");
  Serial.println("📤 發送請求: POST /device/activate");
  Serial.println("🔑 unique_id: " + uniqueId);
  
  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  String url = String(api_base_url) + "/device/activate";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  // 狀態傳輸可能較大，延長超時
  http.setTimeout(60000);
  // 避免 chunked 傳輸導致前綴長度行（如 "2000\r\n"）
  http.useHTTP10(true);
  // 收集關鍵標頭並關閉連線重用，確保可檢測完整結束
  const char* headerKeys1[] = { "Content-Length", "Transfer-Encoding" };
  http.collectHeaders(headerKeys1, 2);
  http.setReuse(false);
  
  String postData = "unique_id=" + uniqueId;
  int httpCode = http.POST(postData);
  
  String response = "";  // 在函數級別聲明 response
  
  if (httpCode > 0 && httpCode == HTTP_CODE_OK) {
    Serial.println("📥 HTTP 狀態碼: " + String(httpCode));
    
    // 檢查可用內存（在讀取響應之前）
    Serial.println("💾 讀取前可用堆內存: " + String(ESP.getFreeHeap()) + " bytes");
    
    // 使用流式讀取響應（避免 String 緩衝區限制）
    Serial.println("📥 開始流式讀取響應...");
    
    response = "";  // 清空響應
    response.reserve(131072);  // 預分配 128KB 空間
    
    // 使用 getStream() 進行流式讀取
    WiFiClient* stream = http.getStreamPtr();
    if (stream == nullptr) {
      Serial.println("❌ 無法獲取流對象");
      http.end();
      return;
    }
    
    unsigned long startTime = millis();
    unsigned long lastDataTime = millis();
    int totalBytes = 0;
    int dotsPrinted = 0;
    
    // 讀取響應數據
    while ((millis() - startTime < 120000)) {  // 最大120秒超時（2分鐘）
      if (stream->available()) {
        // 有數據可讀
        char buffer[1024];  // 增大到 1KB 緩衝區以提高效率
        int available = stream->available();
        int toRead = min(available, 1024);
        int len = stream->readBytes(buffer, toRead);
        
        for (int i = 0; i < len; i++) {
          response += buffer[i];
        }
        
        totalBytes += len;
        lastDataTime = millis();
        
        // 每讀取10KB顯示一個點
        if ((totalBytes / 10240) > dotsPrinted) {
          Serial.print(".");
          dotsPrinted = totalBytes / 10240;
        }
        
      } else {
        // 沒有數據可讀，檢查連接狀態
        bool isConnected = http.connected();
        bool hasData = stream->available() > 0;
        
        // 如果連接已斷開且沒有更多數據，退出
        if (!isConnected && !hasData) {
          Serial.println("\n✅ 連接已關閉，讀取完成");
          break;
        }
        
        // 如果連接已關閉，但還有數據，繼續讀取
        if (!isConnected && hasData) {
          delay(50);  // 給一點時間讓數據到達
          continue;
        }
        
        // 如果連接還活著，但3秒沒有收到數據，可能傳輸完成
        // 但對於大文件，可能需要更長時間
        if (isConnected && (millis() - lastDataTime > 3000)) {
          // 檢查是否真的沒有數據了（等待一小段時間）
          delay(500);
          if (stream->available() == 0 && !http.connected()) {
            Serial.println("\n✅ 傳輸完成");
            break;
          }
          lastDataTime = millis();  // 重置，繼續等待
        }
      }
      
      delay(5);  // 短延遲避免忙等待
    }
    
    // 讀取最後剩餘的數據（確保讀取完整）
    Serial.println("\n📥 讀取剩餘數據...");
    int remainingCount = 0;
    while (stream->available() > 0 || http.connected()) {
      if (stream->available() > 0) {
        char c = stream->read();
        response += c;
        totalBytes++;
        remainingCount++;
        if (remainingCount % 1024 == 0) {
          Serial.print(".");
        }
      } else {
        delay(100);
        if (!http.connected() && stream->available() == 0) {
          break;
        }
      }
    }
    
    if (remainingCount > 0) {
      Serial.println("\n📥 額外讀取了 " + String(remainingCount) + " 字節");
    }
    
    Serial.println("");  // 換行
    Serial.println("📊 流式讀取完成，總共 " + String(totalBytes) + " 字節，耗時 " + String(millis() - startTime) + " ms");
    Serial.println("📥 接收到的響應長度: " + String(response.length()) + " 字符");
    
    // 檢查讀取後的內存
    Serial.println("💾 讀取後可用堆內存: " + String(ESP.getFreeHeap()) + " bytes");
    
    // 檢查響應是否為空
    if (response.length() == 0) {
      Serial.println("❌ 響應為空，無法解析");
      http.end();
      return;
    }
    
    // 檢查響應是否包含 binData（快速檢查）
    bool hasBinDataInResponse = response.indexOf("\"binData\"") >= 0;
    Serial.println("🔍 響應中包含 binData 字段: " + String(hasBinDataInResponse ? "是" : "否"));
    
    if (hasBinDataInResponse) {
      // 找到 binData 的位置和長度
      int binDataStart = response.indexOf("\"binData\":\"") + 11;
      int binDataEnd = response.indexOf("\"", binDataStart);
      if (binDataEnd > binDataStart) {
        int binDataLength = binDataEnd - binDataStart;
        Serial.println("📊 binData 長度: " + String(binDataLength) + " 字符");
        Serial.println("📊 binData 前100字符: " + response.substring(binDataStart, binDataStart + min(100, (int)binDataLength)));
      }
    }
    
    // 計算需要的緩衝區大小
    // ArduinoJson 需要大約響應大小的 1.5-2 倍
    size_t estimatedCapacity = response.length() * 2;
    Serial.println("💡 估算需要的緩衝區: " + String(estimatedCapacity) + " bytes");
    
    // 如果估算的容量超過可用內存，使用可用內存的 80%
    size_t availableMemory = ESP.getFreeHeap();
    size_t maxSafeCapacity = availableMemory * 0.8;
    
    size_t capacity;
    if (estimatedCapacity > maxSafeCapacity) {
      Serial.println("⚠️ 估算容量超過可用內存，使用安全容量: " + String(maxSafeCapacity) + " bytes");
      capacity = maxSafeCapacity;
    } else {
      capacity = estimatedCapacity;
    }
    
    Serial.println("🔧 使用緩衝區大小: " + String(capacity) + " bytes");
    
    // 在某些情況下，響應體前面可能帶有非JSON前綴（例如分塊編碼的長度行）
    int jsonStartIdx = -1;
    for (int i = 0; i < (int)response.length(); i++) {
      char ch = response[i];
      if (ch == '{' || ch == '[') { jsonStartIdx = i; break; }
    }

    if (jsonStartIdx > 0) {
      Serial.println("⚠️ 檢測到非JSON前綴，已跳過前綴長度: " + String(jsonStartIdx));
      response = response.substring(jsonStartIdx);
    }

    // 解析JSON
    DynamicJsonDocument doc(capacity);
    DeserializationError error = deserializeJson(doc, response);
    
    if (error) {
      Serial.println("❌ JSON 解析失敗");
      Serial.println("💬 解析錯誤: " + String(error.c_str()));
      Serial.println("💬 響應長度: " + String(response.length()) + " 字符");
      Serial.println("💬 使用的緩衝區大小: " + String(capacity) + " bytes");
      Serial.println("💬 可用內存: " + String(ESP.getFreeHeap()) + " bytes");
      
      // 輸出響應的前1000字符用於調試
      Serial.println("📄 響應前1000字符:");
      Serial.println(response.substring(0, min(1000, (int)response.length())));
    }
    
    if (!error && doc.containsKey("success")) {
      bool success = doc["success"];
      
      if (!success) {
        // 設備不在白名單
        String message = doc["message"] | "";
        Serial.println("\n❌ unique_id 不在白名單");
        Serial.println("💬 錯誤訊息: " + message);
        activationInfo.isValid = false;
        http.end();
        return;
      }
      
      // 檢查設備是否已激活
      bool alreadyActivated = doc["alreadyActivated"] | false;
      
      if (alreadyActivated) {
        // 設備已激活，處理狀態響應
        Serial.println("\n✅ 設備已激活，獲取狀態資訊");
        
        String deviceID = doc["deviceID"] | "";
        if (deviceID.length() > 0) {
          // 保存 deviceID
          preferences.putString("deviceID", deviceID);
          Serial.println("💾 已保存 deviceID: " + deviceID);
        }
        
        // 處理狀態資訊（類似 status API）
        DeviceConfig newConfig;
        newConfig.success = true;
        newConfig.isActivated = doc["isActivated"] | false;
        newConfig.needUpdate = doc["needUpdate"] | false;
        newConfig.refreshInterval = doc["refreshInterval"] | 300;
        newConfig.hasBinData = doc.containsKey("binData");
        newConfig.binSize = doc["binSize"] | 0;
        
        Serial.println("\n✅ 設備狀態:");
        Serial.println("   - deviceID: " + deviceID);
        Serial.println("   - isActivated: " + String(newConfig.isActivated));
        Serial.println("   - needUpdate: " + String(newConfig.needUpdate));
        Serial.println("   - refreshInterval: " + String(newConfig.refreshInterval) + " 秒");
        
        // 持久化保存配置
        saveConfig(newConfig);
        
        // 如果有binData，就處理（不一定要 needUpdate == true）
        if (newConfig.hasBinData) {
          String binData = doc["binData"] | "";
          Serial.println("   - binSize: " + String(newConfig.binSize) + " bytes");
          Serial.println("   - binData 存在: 是");
          Serial.println("   - needUpdate: " + String(newConfig.needUpdate));
          
          // 處理binData
          bool decodeSuccess = processBinData(binData);
          if (decodeSuccess) {
            Serial.println("✅ binData 處理成功，大小: " + String(newConfig.binSize) + " bytes");
          } else {
            Serial.println("❌ binData 處理失敗");
          }
        } else {
          Serial.println("   - binData 存在: 否");
          if (doc.containsKey("message")) {
            String message = doc["message"] | "";
            Serial.println("   - message: " + message);
          }
        }
        
        // 更新全局配置
        savedConfig = newConfig;
        
      } else {
        // 設備未激活，處理激活碼
        activationInfo.activation_code = doc["activation_code"] | "";
        activationInfo.expire_at = doc["expire_at"] | "";
        activationInfo.isValid = true;
        
        Serial.println("\n✅ 設備在白名單中，但未激活");
        Serial.println("🔐 激活碼: " + activationInfo.activation_code);
        Serial.println("⏰ 過期時間: " + activationInfo.expire_at);
        
        // 保存激活碼信息（用於後續檢查）
        preferences.putString("activation_code", activationInfo.activation_code);
        preferences.putString("expire_at", activationInfo.expire_at);
        preferences.putULong("last_activate_time", millis() / 1000);
      }
      
    } else {
      Serial.println("❌ JSON 解析失敗");
      if (error) {
        Serial.println("💬 解析錯誤: " + String(error.c_str()));
      }
    }
  } else {
    Serial.println("❌ HTTP 請求失敗，錯誤碼: " + String(httpCode));
  }
  
  http.end();
}

void callDeviceStatusAPI(String deviceID) {
  Serial.println("\n========== 調用設備狀態API ==========");
  Serial.println("📤 發送請求: POST /device/status");
  Serial.println("🆔 deviceID: " + deviceID);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(api_base_url) + "/device/status";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("Accept", "application/json");
  http.addHeader("Accept-Encoding", "identity");
  http.addHeader("Connection", "close");
  http.setTimeout(120000);
  http.useHTTP10(true);
  const char* keys[] = { "Content-Length", "Transfer-Encoding" };
  http.collectHeaders(keys, 2);
  http.setReuse(false);

  String postData = "deviceID=" + deviceID;
  Serial.println("📤 發送 POST 數據: " + postData);
  int httpCode = http.POST(postData);
  Serial.println("📥 HTTP 響應碼: " + String(httpCode));
  if (httpCode != HTTP_CODE_OK) {
    Serial.println("❌ HTTP 錯誤: " + String(httpCode));
    http.end();
    return;
  }

  // 第一次解析：不用 JSON 解析器，流式掃描小欄位（忽略 binData 內容）
  WiFiClient* s = http.getStreamPtr();
  if (s == nullptr) {
    Serial.println("❌ 無法獲取流對象");
    http.end();
    return;
  }
  // 對齊到第一個 '{'
  unsigned long tStart = millis();
  while (millis() - tStart < 10000) {
    if (s->available()) {
      if (s->peek() == '{') break;
      s->read();
    } else if (!http.connected()) {
      break;
    } else {
      delay(1);
    }
  }
  bool success = false, hasSuccess = false;
  bool isActivated = false, hasIsActivated = false;
  bool needUpdate = false, hasNeedUpdate = false;
  int refreshInterval = 300; bool hasRefresh = false;
  int binSize = 0; bool hasBinSize = false;
  bool seenBinDataKey = false;
  String key = ""; key.reserve(32);
  bool inString = false, escape = false; bool readingKey = false;
  unsigned long tParse = millis();
  while (millis() - tParse < 60000) {
    if (!s->available()) {
      if (!http.connected()) break; else { delay(1); continue; }
    }
    char ch = s->read();
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch == '\\') { escape = true; continue; }
      if (ch == '"') { inString = false; readingKey = false; }
      else if (readingKey) { if (key.length() < 31) key += ch; }
      continue;
    }
    if (ch == '"') { inString = true; key = ""; readingKey = true; continue; }
    if (readingKey) continue; // 尚未關閉鍵字串
    if (ch == ':') {
      // 讀取值（忽略空白）
      char v; do { if (!s->available()) { if (!http.connected()) break; delay(1); } v = s->peek(); if (v==' '||v=='\n'||v=='\r'||v=='\t') s->read(); else break; } while (true);
      if (key == "success") {
        // true/false
        String tkn = ""; for (int i=0;i<5 && s->available();++i){ char c=s->peek(); if ((c>='a'&&c<='z')){ tkn+=c; s->read(); } else break; }
        hasSuccess = true; success = (tkn == "true");
      } else if (key == "isActivated") {
        String tkn = ""; for (int i=0;i<5 && s->available();++i){ char c=s->peek(); if ((c>='a'&&c<='z')){ tkn+=c; s->read(); } else break; }
        hasIsActivated = true; isActivated = (tkn == "true");
      } else if (key == "needUpdate") {
        String tkn = ""; for (int i=0;i<5 && s->available();++i){ char c=s->peek(); if ((c>='a'&&c<='z')){ tkn+=c; s->read(); } else break; }
        hasNeedUpdate = true; needUpdate = (tkn == "true");
      } else if (key == "refreshInterval" || key == "binSize") {
        // 數字
        long val = 0; bool neg = false; bool got = false;
        // 跳過空白
        while (s->available()) { char c=s->peek(); if (c==' '||c=='\n'||c=='\r'||c=='\t') s->read(); else break; }
        if (s->available() && s->peek()=='-'){ neg=true; s->read(); }
        while (s->available()) { char c=s->peek(); if (c>='0'&&c<='9'){ val = val*10 + (c-'0'); s->read(); got=true; } else break; }
        if (neg) val = -val;
        if (key == "refreshInterval") { refreshInterval = (int)val; hasRefresh = true; }
        else { binSize = (int)val; hasBinSize = true; }
      } else if (key == "binData") {
        seenBinDataKey = true; // 後續不需讀完整 Base64
      }
      key = "";
    }
    // 最快結束條件：拿到所有小欄位或看到 binData
    if ((hasSuccess && hasIsActivated && hasNeedUpdate && hasRefresh && hasBinSize) || seenBinDataKey) break;
  }
  http.end();
  if (!hasSuccess || !success) {
    Serial.println("❌ success:false 或缺少 success 字段");
    return;
  }
  bool hasBin = (needUpdate && binSize > 0) || seenBinDataKey;
  Serial.println("✅ 掃描成功: isActivated=" + String(isActivated) + ", needUpdate=" + String(needUpdate) + ", refreshInterval=" + String(refreshInterval) + ", binSize=" + String(binSize));

  // 若未啟動，清除 deviceID 並立即進入激活流程
  if (!isActivated) {
    String existingId = preferences.getString("deviceID", "");
    if (existingId.length() > 0) {
      preferences.remove("deviceID");
      Serial.println("🗑️ 已清除保存的 deviceID");
    }
    String uniqueIdNow = getChipId();
    Serial.println("🔁 isActivated=false，重新進入激活流程，unique_id=" + uniqueIdNow);
    callActivateAPI(uniqueIdNow);
    return;
  }

  // 若需要 bin，進行第二次請求：流式抓取 binData 並即時 Base64 解碼
  if (hasBin) {
    Serial.println("🔄 需要 binData，開始二次請求以流式抓取");
    WiFiClientSecure client2; client2.setInsecure();
    HTTPClient http2; String url2 = String(api_base_url) + "/device/status";
    http2.begin(client2, url2);
    http2.addHeader("Content-Type", "application/x-www-form-urlencoded");
    http2.setTimeout(120000);
    http2.useHTTP10(true);
    const char* keys2[] = { "Content-Length", "Transfer-Encoding" };
    http2.collectHeaders(keys2, 2);
    http2.setReuse(false);
    String post2 = "deviceID=" + deviceID;
    int code2 = http2.POST(post2);
    if (code2 != HTTP_CODE_OK) {
      Serial.println("❌ 二次請求失敗: " + String(code2));
      http2.end();
      return;
    }
    WiFiClient* s = http2.getStreamPtr();
    if (s == nullptr) {
      Serial.println("❌ 無法獲取二次流對象");
      http2.end();
      return;
    }
    // 尋找 "binData":"
    const char* needle = "\"binData\":\""; int needleLen = 11; // length of "binData":"
    int matched = 0;
    unsigned long t0 = millis();
    while (millis() - t0 < 120000 && matched < needleLen) {
      if (s->available()) {
        char c = s->read();
        if (c == needle[matched]) { matched++; } else { matched = (c == needle[0]) ? 1 : 0; }
      } else if (!http2.connected()) {
        break;
      } else {
        delay(1);
      }
    }
    if (matched < needleLen) {
      Serial.println("❌ 未找到 binData 欄位");
      http2.end();
      return;
    }
    // 逐步 Base64 解碼到緩衝
    uint8_t* binBuffer = (uint8_t*)malloc(binSize);
    if (!binBuffer) {
      Serial.println("❌ 內存不足，無法分配 bin 緩衝");
      http2.end();
      return;
    }
    size_t written = 0; char b4[4]; int b4i = 0; bool inString = true; bool escape = false;
    auto b64val = [](char ch) -> int {
      if (ch >= 'A' && ch <= 'Z') return ch - 'A';
      if (ch >= 'a' && ch <= 'z') return ch - 'a' + 26;
      if (ch >= '0' && ch <= '9') return ch - '0' + 52;
      if (ch == '+') return 62; if (ch == '/') return 63; if (ch == '=') return -2; return -1;
    };
    unsigned long t1 = millis();
    while (millis() - t1 < 120000 && inString) {
      if (s->available()) {
        char c = s->read();
        if (escape) { escape = false; continue; }
        if (c == '\\') { escape = true; continue; }
        if (c == '"') { inString = false; break; }
        int v = b64val(c);
        if (v < 0 && v != -2) continue; // 忽略非 Base64 字元
        b4[b4i++] = c;
        if (b4i == 4) {
          int v0 = b64val(b4[0]); int v1 = b64val(b4[1]); int v2 = b64val(b4[2]); int v3 = b64val(b4[3]);
          if (v0 < 0 || v1 < 0) break;
          uint8_t o0 = (v0 << 2) | ((v1 & 0x30) >> 4);
          if (written < (size_t)binSize) binBuffer[written++] = o0;
          if (v2 != -2) {
            uint8_t o1 = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
            if (written < (size_t)binSize) binBuffer[written++] = o1;
          }
          if (v3 != -2) {
            uint8_t o2 = ((v2 & 0x03) << 6) | v3;
            if (written < (size_t)binSize) binBuffer[written++] = o2;
          }
          b4i = 0;
        }
      } else if (!http2.connected()) {
        break;
      } else {
        delay(1);
      }
    }
    Serial.println("📦 bin 解碼完成，寫入位元組: " + String(written) + " / " + String(binSize));
    bool sizeOk = (written == (size_t)binSize);
    if (!sizeOk) Serial.println("⚠️ bin 實際長度與 binSize 不符");
    // 簡單格式驗證（1600的倍數）
    if (written % (CHUNK_SIZE * 2) != 0) {
      Serial.println("⚠️ binData 格式驗證: 總長度不是 1600 的倍數");
    } else {
      int chunks = written / (CHUNK_SIZE * 2);
      Serial.println("✅ binData 格式驗證通過，塊數: " + String(chunks));
    }
    // 輸出部分 binData（避免大量輸出）：前/中/後各 256 bytes（十六進位）
    auto printHex = [](const uint8_t* data, size_t len) {
      for (size_t i = 0; i < len; ++i) {
        if (i && (i % 16 == 0)) Serial.println("");
        char buf[4];
        snprintf(buf, sizeof(buf), "%02X", data[i]);
        Serial.print(buf);
        Serial.print(" ");
      }
      Serial.println("");
    };
    size_t segLen = written < 256 ? written : 256;
    if (segLen > 0) {
      Serial.println("📄 binData 前 256 bytes:");
      printHex(binBuffer, segLen);
    }
    if (written > 256) {
      Serial.println("📄 binData 後 256 bytes:");
      size_t tailStart = written >= 256 ? written - 256 : 0;
      size_t tailLen = written - tailStart;
      printHex(binBuffer + tailStart, tailLen);
    }
    if (written > 512) {
      Serial.println("📄 binData 中間 256 bytes:");
      size_t midStart = (written / 2 >= 128) ? (written / 2 - 128) : 0;
      if (midStart + 256 > written) {
        if (written > 256) midStart = written - 256; else midStart = 0;
      }
      printHex(binBuffer + midStart, (written - midStart >= 256) ? 256 : (written - midStart));
    }
    // 釋放與結束
    free(binBuffer);
    http2.end();
    
  }

  http.end();
}

bool processBinData(String base64Data) {
  Serial.println("\n========== 處理binData ==========");
  
  // Base64解碼 - 使用簡單實現
  String decodedString = base64_decode_simple(base64Data);
  int actualLength = decodedString.length();
  
  if (actualLength <= 0) {
    Serial.println("❌ Base64解碼失敗");
    return false;
  }
  
  Serial.println("✅ Base64解碼成功，長度: " + String(actualLength) + " bytes");
  
  // 驗證binData格式（每800字節black層 + 每800字節red層交替）
  if (actualLength % (CHUNK_SIZE * 2) != 0) {
    Serial.println("⚠️ binData格式驗證: 總長度不是 (800*2) 的倍數");
  } else {
    int expectedChunks = actualLength / (CHUNK_SIZE * 2);
    Serial.println("✅ binData格式驗證通過，包含 " + String(expectedChunks) + " 個數據塊");
  }
  
  // 注意：目前不與epaper交互，只驗證數據格式
  // 如果需要顯示，可以在這裡添加顯示邏輯
  
  return true;
}

void saveConfig(DeviceConfig config) {
  preferences.putBool("success", config.success);
  preferences.putBool("isActivated", config.isActivated);
  preferences.putBool("needUpdate", config.needUpdate);
  preferences.putInt("refreshInterval", config.refreshInterval);
  Serial.println("💾 配置已保存到持久化存儲");
}

// 載入 WiFi 憑證從 Preferences
void loadWiFiCredentials() {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, true);  // 只讀模式
  
  wifi_ssid = wifiPrefs.getString("ssid", default_ssid);
  wifi_password = wifiPrefs.getString("password", default_password);
  
  wifiPrefs.end();
  
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("✅ WiFi 憑證已從 Preferences 載入");
    Serial.println("   SSID: " + wifi_ssid);
  } else {
    Serial.println("⚠️ WiFi 憑證未設置，將使用預設值（如果有的話）");
    Serial.println("💡 請使用 setWiFiCredentials() 函數設置 WiFi 憑證");
  }
}

// 設置 WiFi 憑證到 Preferences（可通過串口或其他方式調用）
void setWiFiCredentials(String ssid, String password) {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, false);  // 讀寫模式
  
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("password", password);
  
  wifiPrefs.end();
  
  // 更新全局變數
  wifi_ssid = ssid;
  wifi_password = password;
  
  Serial.println("✅ WiFi 憑證已保存到 Preferences");
  Serial.println("   SSID: " + ssid);
}

void loadSavedConfig() {
  savedConfig.success = preferences.getBool("success", false);
  savedConfig.isActivated = preferences.getBool("isActivated", false);
  savedConfig.needUpdate = preferences.getBool("needUpdate", false);
  savedConfig.refreshInterval = preferences.getInt("refreshInterval", 300);
  Serial.println("📂 載入保存的配置:");
  Serial.println("   - success: " + String(savedConfig.success));
  Serial.println("   - isActivated: " + String(savedConfig.isActivated));
  Serial.println("   - needUpdate: " + String(savedConfig.needUpdate));
  Serial.println("   - refreshInterval: " + String(savedConfig.refreshInterval) + " 秒");
}

// 啟動 AP 模式並設置 Web 服務器
void startAPMode() {
  isAPMode = true;
  
  Serial.println("\n========== 啟動 AP 模式 ==========");
  Serial.println("📡 SSID: " + String(ap_ssid));
  Serial.println("🔑 密碼: " + String(ap_password));
  
  // 啟動 AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_password);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.println("✅ AP 模式啟動成功");
  Serial.println("📍 AP IP 地址: " + IP.toString());
  Serial.println("🌐 配置頁面: http://" + IP.toString());
  Serial.println("=====================================\n");
  
  // 設置 Web 服務器路由
  server.on("/", handleRoot);
  server.on("/config", HTTP_POST, handleConfig);
  server.on("/save", HTTP_POST, handleSave);
  
  server.begin();
  Serial.println("✅ Web 服務器已啟動");
  Serial.println("💡 請連接到 " + String(ap_ssid) + " 並訪問 http://" + IP.toString());
}

// 處理根路徑（顯示配置頁面）
void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32 WiFi 配置</title>";
  html += "<style>";
  html += "body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; background: #f5f5f5; }";
  html += "h1 { color: #333; text-align: center; }";
  html += ".container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }";
  html += "label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: bold; color: #555; }";
  html += "input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; font-size: 14px; }";
  html += "button { width: 100%; padding: 12px; margin-top: 20px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }";
  html += "button:hover { background: #0056b3; }";
  html += ".info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; color: #004085; }";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<h1>📡 ESP32 WiFi 配置</h1>";
  html += "<div class='info'>";
  html += "<strong>請輸入您的 WiFi 憑證：</strong><br>";
  html += "設備將在配置完成後自動重啟並連接 WiFi。";
  html += "</div>";
  html += "<form action='/save' method='POST'>";
  html += "<label for='ssid'>WiFi 名稱 (SSID):</label>";
  html += "<input type='text' id='ssid' name='ssid' required placeholder='輸入 WiFi 名稱'>";
  html += "<label for='password'>WiFi 密碼:</label>";
  html += "<input type='password' id='password' name='password' required placeholder='輸入 WiFi 密碼'>";
  html += "<button type='submit'>💾 保存並重啟</button>";
  html += "</form>";
  html += "</div></body></html>";
  
  server.send(200, "text/html; charset=UTF-8", html);
}

// 處理保存配置請求
void handleSave() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    String ssid = server.arg("ssid");
    String password = server.arg("password");
    
    ssid.trim();
    password.trim();
    
    if (ssid.length() > 0 && password.length() > 0) {
      // 保存 WiFi 憑證
      setWiFiCredentials(ssid, password);
      
      Serial.println("✅ WiFi 憑證已通過 Web 頁面保存");
      Serial.println("   SSID: " + ssid);
      
      // 返回成功頁面
      String html = "<!DOCTYPE html><html><head>";
      html += "<meta charset='UTF-8'>";
      html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
      html += "<meta http-equiv='refresh' content='5;url=/'>";
      html += "<title>配置成功</title>";
      html += "<style>";
      html += "body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; background: #f5f5f5; }";
      html += ".container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }";
      html += ".success { color: #28a745; font-size: 48px; margin-bottom: 20px; }";
      html += "h1 { color: #333; }";
      html += "p { color: #666; line-height: 1.6; }";
      html += "</style></head><body>";
      html += "<div class='container'>";
      html += "<div class='success'>✅</div>";
      html += "<h1>配置成功！</h1>";
      html += "<p>WiFi 憑證已保存。</p>";
      html += "<p>設備將在 5 秒後自動重啟並嘗試連接 WiFi。</p>";
      html += "<p>如果連接成功，設備將正常工作。</p>";
      html += "<p>如果連接失敗，設備將再次進入配置模式。</p>";
      html += "</div></body></html>";
      
      server.send(200, "text/html; charset=UTF-8", html);
      
      delay(2000);
      ESP.restart();  // 重啟設備以嘗試連接 WiFi
    } else {
      server.send(400, "text/plain", "SSID 和密碼不能為空");
    }
  } else {
    server.send(400, "text/plain", "缺少必要參數");
  }
}

// 處理配置請求（重定向到根）
void handleConfig() {
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

void checkActivationCodeExpiry() {
  Serial.println("\n========== 檢查激活碼是否過期 ==========");
  
  String savedExpireAt = preferences.getString("expire_at", "");
  if (savedExpireAt.length() == 0) {
    Serial.println("⚠️ 未找到過期時間");
    activationInfo.isValid = false;
    return;
  }
  
  Serial.println("⏰ 保存的過期時間: " + savedExpireAt);
  Serial.println("💡 提示: 激活碼有效期為5分鐘");
  
  // 簡單檢查：如果距離上次激活超過5分鐘，認為可能過期
  // 更精確的檢查需要解析ISO 8601時間格式
  unsigned long lastActivateTime = preferences.getULong("last_activate_time", 0);
  if (lastActivateTime > 0) {
    unsigned long elapsed = (millis() / 1000) - (lastActivateTime / 1000);
    if (elapsed > 300) {  // 超過5分鐘（300秒）
      Serial.println("⏰ 激活碼可能已過期（超過5分鐘）");
      activationInfo.isValid = false;
    } else {
      Serial.println("✅ 激活碼仍然有效（剩餘時間: " + String(300 - elapsed) + " 秒）");
      activationInfo.isValid = true;
    }
  }
}

void handleButtonWakeup() {
  startTime = millis();
  actionTaken = false;
  
  // 檢查按鈕2是否按下（強制查詢狀態）
  if (digitalRead(BUTTON_STATUS_PIN) == LOW) {
    Serial.println("🔘 檢測到按鈕2按下，將強制查詢設備狀態");
    actionTaken = true;
  }
}

void goToDeepSleep(int sleepSeconds, bool isActivated) {
  Serial.println("\n========== 準備進入深度睡眠 ==========");
  
  // 配置按鈕1喚醒（無論是否激活都支持按鈕喚醒）
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN_1, 0);
  Serial.println("🔘 已配置按鈕1喚醒");
  
  // 只有已激活狀態才配置定時器喚醒
  if (isActivated) {
  if (sleepSeconds <= 0) {
    sleepSeconds = 300;  // 默認5分鐘
  }
  
  Serial.println("⏰ 睡眠時間: " + String(sleepSeconds) + " 秒");
    Serial.println("✅ 設備已激活，配置定時器喚醒");
  
  // 配置定時器喚醒
  esp_sleep_enable_timer_wakeup(sleepSeconds * 1000000ULL);  // 轉換為微秒
  } else {
    Serial.println("⚠️ 設備未激活，僅配置按鈕喚醒（不配置定時器喚醒）");
    Serial.println("💡 請先完成設備激活，之後設備將自動定時喚醒");
  }
  
  Serial.println("😴 進入深度睡眠...");
  delay(1000);
  
  esp_deep_sleep_start();
}
