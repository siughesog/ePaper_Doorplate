#define ENABLE_GxEPD2_GFX 0

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <ESPping.h>
#include <WebServer.h>
#include <SPI.h>
#include <GxEPD2_3C.h>
#include "GxEPD2_display_selection.h"
#include "GxEPD2_display_selection_added.h"
#include "GxEPD2_display_selection_new_style.h"

// RP2040 SPI 配置（保留）
#if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
#if defined(__MBED__)
arduino::MbedSPI SPIn(4, 7, 6);
#else
SPIClassRP2040 SPIn(spi1, 12, 13, 10, 11);
#endif
#endif

// ESP32 HSPI（如有）
#if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
SPIClass hspi(HSPI);
#endif

#define CHUNK_SIZE 800
#define BUTTON_PIN_1 34
#define BUTTON_PIN_2 35

// WiFi / API
const char* default_ssid = "";
const char* default_password = "";
const char* api_base_url = "https://epaperdoorplate-production.up.railway.app";
const unsigned long api_timeout = 10000;

// AP mode
const char* ap_ssid = "ESP32-WiFi-Config";
const char* ap_password = "12345678";
WebServer server(80);
bool isAPMode = false;

// Preferences
Preferences preferences;
const char* prefs_namespace = "device_config";
const char* wifi_namespace = "wifi_config";

// WiFi credentials (loaded)
String wifi_ssid = "";
String wifi_password = "";

// globals
unsigned long startTime = millis();
const unsigned long button_timeout = 5000;

struct DeviceConfig {
  bool success;
  bool isActivated;
  bool needUpdate;
  int refreshInterval;
  bool hasBinData;
  int binSize;
};
DeviceConfig savedConfig = {false, false, false, 300, false, 0};

struct ActivationInfo {
  String activation_code;
  String expire_at;
  bool isValid;
};
ActivationInfo activationInfo = {"", "", false};

// forward declare
void startAPMode();
void handleRoot();
void handleSave();
void handleConfig();
void setWiFiCredentials(String ssid, String password);
void loadWiFiCredentials();
void loadSavedConfig();
void saveConfig(DeviceConfig config);
String getChipId();
void callActivateAPI(String uniqueId);
void callDeviceStatusAPI(String deviceID);
void goToDeepSleep(int sleepSeconds, bool isActivated);
int base64DecodeStreaming(const String& base64Str, int expectedSize);
int base64DecodeStreamingFromResponse(const String& response, int startIdx, int endIdx, int expectedSize);
int base64DecodeStreamingFromHTTPStream(WiFiClient* stream, HTTPClient& http, int expectedSize);

// --- display object ---
// NOTE: keep the display object defined in your included display_selection headers.
// The following assumes you already have 'display' defined by those headers (as in your original).
// If not, ensure the display object exists as in your short program.

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("========== ESP32 啟動 ==========");

  pinMode(BUTTON_PIN_1, INPUT_PULLUP);
  pinMode(BUTTON_PIN_2, INPUT_PULLUP);

  preferences.begin(prefs_namespace, false);
  loadWiFiCredentials();
  loadSavedConfig();

  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) Serial.println("🌞 從按鈕喚醒");
  else if (wakeup_reason == ESP_SLEEP_WAKEUP_TIMER) Serial.println("⏰ 從定時器喚醒");
  else Serial.println("🔌 首次啟動或重置");

  bool wifiConnected = false;
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("📶 嘗試連接 WiFi: " + wifi_ssid);
    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      Serial.println("\n✅ WiFi 連線成功: " + WiFi.localIP().toString());
    } else {
      Serial.println("\n❌ WiFi 連線失敗");
    }
  } else {
    Serial.println("⚠️ WiFi 憑證未設置");
  }

  if (!wifiConnected) {
    startAPMode();
    return;
  }

  // display 初始化 —— 保留你原本流程（RP2040 / HSPI 支援）
  #if defined(ARDUINO_ARCH_RP2040) && (defined(ARDUINO_RASPBERRY_PI_PICO) || defined(ARDUINO_RASPBERRY_PI_PICO_W))
    display.epd2.selectSPI(SPIn, SPISettings(4000000, MSBFIRST, SPI_MODE0));
    pinMode(15, INPUT_PULLUP);
    while (!digitalRead(15)) delay(100);
    pinMode(16, OUTPUT); digitalWrite(16, HIGH);
  #endif
  #if defined(ESP32) && defined(USE_HSPI_FOR_EPD)
    hspi.begin(18, 19, 23, 5);
    display.epd2.selectSPI(hspi, SPISettings(4000000, MSBFIRST, SPI_MODE0));
  #elif (defined(ARDUINO_ARCH_ESP32) && defined(ARDUINO_LOLIN_S2_MINI))
    SPI.begin(18, -1, 16, 33);
  #endif

  display.init(115200, true, 2, false); // waveshare style reset
  delay(1000);
  display.fillScreen(GxEPD_WHITE);
  delay(1000);

  String deviceID = preferences.getString("deviceID", "");
  if (deviceID.length() > 0) {
    Serial.println("📡 偵測到已保存的 deviceID，呼叫狀態 API");
    callDeviceStatusAPI(deviceID);
  } else {
    Serial.println("🔐 無 deviceID，呼叫 activate API");
    callActivateAPI(getChipId());
  }

  String finalDeviceID = preferences.getString("deviceID", "");
  bool hasDeviceIDFromBackend = (finalDeviceID.length() > 0);
  if (hasDeviceIDFromBackend) Serial.println("✅ 有 deviceID: " + finalDeviceID);
  else Serial.println("⚠️ 未從後端獲取到 deviceID");

  // 只有成功拿到 deviceID 才配置定時喚醒
  goToDeepSleep(savedConfig.refreshInterval, hasDeviceIDFromBackend);
}

void loop() {
  if (isAPMode) {
    server.handleClient();
    delay(10);
  }
}

// -------------------- helper functions --------------------

String getChipId() {
  uint64_t chipid = ESP.getEfuseMac();
  char chipIdStr[20];
  snprintf(chipIdStr, sizeof(chipIdStr), "%04X%08X", (uint16_t)(chipid >> 32), (uint32_t)chipid);
  return String(chipIdStr);
}

void loadWiFiCredentials() {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, true);
  wifi_ssid = wifiPrefs.getString("ssid", default_ssid);
  wifi_password = wifiPrefs.getString("password", default_password);
  wifiPrefs.end();
  if (wifi_ssid.length() > 0 && wifi_password.length() > 0) {
    Serial.println("✅ WiFi 憑證已從 Preferences 載入");
    Serial.println("   SSID: " + wifi_ssid);
  } else {
    Serial.println("⚠️ WiFi 憑證未設置");
  }
}

void setWiFiCredentials(String ssid, String password) {
  Preferences wifiPrefs;
  wifiPrefs.begin(wifi_namespace, false);
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("password", password);
  wifiPrefs.end();
  wifi_ssid = ssid; wifi_password = password;
  Serial.println("✅ WiFi 憑證已保存到 Preferences");
}

void loadSavedConfig() {
  savedConfig.success = preferences.getBool("success", false);
  savedConfig.isActivated = preferences.getBool("isActivated", false);
  savedConfig.needUpdate = preferences.getBool("needUpdate", false);
  savedConfig.refreshInterval = preferences.getInt("refreshInterval", 300);
  Serial.println("📂 載入保存的配置: isActivated=" + String(savedConfig.isActivated) + ", refreshInterval=" + String(savedConfig.refreshInterval));
}

void saveConfig(DeviceConfig config) {
  preferences.putBool("success", config.success);
  preferences.putBool("isActivated", config.isActivated);
  preferences.putBool("needUpdate", config.needUpdate);
  preferences.putInt("refreshInterval", config.refreshInterval);
  Serial.println("💾 配置已保存到持久化存儲");
}

// -------------------- AP mode (完整 HTML) --------------------

void startAPMode() {
  isAPMode = true;
  Serial.println("\n========== 啟動 AP 模式 ==========");
  Serial.println("📡 SSID: " + String(ap_ssid));
  Serial.println("🔑 密碼: " + String(ap_password));

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_password);

  IPAddress IP = WiFi.softAPIP();
  Serial.println("✅ AP 模式啟動成功");
  Serial.println("📍 AP IP 地址: " + IP.toString());
  Serial.println("🌐 配置頁面: http://" + IP.toString());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/config", HTTP_GET, handleConfig);

  server.begin();
  Serial.println("✅ Web 服務器已啟動");

  while (true) {
    server.handleClient();
    delay(10);
  }
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32 WiFi 配置</title>";
  html += "<style>";
  html += "body{font-family:Arial, sans-serif; background:#f5f5f5; padding:20px;}";
  html += ".container{max-width:600px;margin:30px auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}";
  html += "h1{text-align:center;color:#333}";
  html += "label{display:block;margin-top:12px;color:#444;font-weight:600}";
  html += "input{width:100%;padding:10px;margin-top:6px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box}";
  html += "button{width:100%;padding:12px;margin-top:18px;background:#007bff;color:#fff;border:none;border-radius:6px;font-size:16px}";
  html += ".note{background:#e9f7ff;padding:10px;border-radius:6px;margin-bottom:12px;color:#036}";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<h1>📡 ESP32 WiFi 配置</h1>";
  html += "<div class='note'><strong>請輸入 WiFi 憑證</strong><br>設備在配置完成後會自動重啟並嘗試連接 WiFi。</div>";
  html += "<form action='/save' method='POST'>";
  html += "<label for='ssid'>WiFi 名稱 (SSID)</label>";
  html += "<input type='text' id='ssid' name='ssid' placeholder='例如: MyWiFi' required>";
  html += "<label for='password'>WiFi 密碼</label>";
  html += "<input type='password' id='password' name='password' placeholder='請輸入密碼' required>";
  html += "<button type='submit'>💾 保存並重啟</button>";
  html += "</form>";
  html += "<hr>";
  html += "<p style='font-size:13px;color:#666'>若你想要手動設定其它參數，請透過序列埠或修改韌體後再上傳。</p>";
  html += "</div></body></html>";
  server.send(200, "text/html; charset=UTF-8", html);
}

void handleSave() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    String ssid = server.arg("ssid");
    String password = server.arg("password");
    ssid.trim(); password.trim();
    if (ssid.length() > 0 && password.length() > 0) {
      setWiFiCredentials(ssid, password);
      String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta http-equiv='refresh' content='5;url=/'><style>body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px}.c{max-width:600px;margin:50px auto;background:#fff;padding:20px;border-radius:8px;text-align:center}</style></head><body><div class='c'><h1>✅ 配置成功</h1><p>設備將在 5 秒後重啟並嘗試連接 WiFi。</p></div></body></html>";
      server.send(200, "text/html; charset=UTF-8", html);
      delay(2000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "SSID 和密碼不能為空");
    }
  } else {
    server.send(400, "text/plain", "缺少參數");
  }
}

void handleConfig() {
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

// -------------------- Activate & Status (整合短版顯示流程) --------------------

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
  http.setTimeout(60000);
  http.useHTTP10(true);
  const char* headerKeys1[] = { "Content-Length", "Transfer-Encoding" };
  http.collectHeaders(headerKeys1, 2);
  http.setReuse(false);

  String postData = "unique_id=" + uniqueId;
  int httpCode = http.POST(postData);

  if (httpCode == HTTP_CODE_OK) {
    Serial.println("📥 HTTP 200，讀取響應...");
    String response = http.getString();
    size_t estimatedCapacity = response.length() * 2;
    DynamicJsonDocument doc(min(estimatedCapacity, (size_t)200000));
    DeserializationError error = deserializeJson(doc, response);
    if (error) {
      Serial.println("❌ JSON 解析錯誤: " + String(error.c_str()));
      http.end();
      return;
    }

    bool success = doc["success"] | false;
    if (!success) {
      String message = doc["message"] | "";
      Serial.println("❌ activate failed: " + message);
      activationInfo.isValid = false;
      http.end();
      return;
    }

    bool alreadyActivated = doc["alreadyActivated"] | false;
    if (alreadyActivated) {
      String deviceID = doc["deviceID"] | "";
      if (deviceID.length() > 0) {
        preferences.putString("deviceID", deviceID);
        Serial.println("💾 已保存 deviceID: " + deviceID);
      }

      DeviceConfig newConfig;
      newConfig.success = true;
      newConfig.isActivated = doc["isActivated"] | false;
      newConfig.needUpdate = doc["needUpdate"] | false;
      newConfig.refreshInterval = doc["refreshInterval"] | 300;
      newConfig.hasBinData = doc.containsKey("binData");
      newConfig.binSize = doc["binSize"] | 0;
      saveConfig(newConfig);

      // 若 activate 裡就帶 binData（通常短且可一次處理），做簡單處理
      if (newConfig.hasBinData) {
        String binData = doc["binData"] | "";
        if (binData.length() > 0) {
          Serial.println("🔄 activate 含 binData，嘗試簡單解碼後顯示 (小 payload)");
          // 針對短 payload：一次 decode -> 分塊 writeImagePart（此情況少見）
          int srcLen = binData.length();
          int maxOut = srcLen * 3 / 4 + 4;
          uint8_t* outBuf = (uint8_t*)malloc(maxOut);
          if (outBuf) {
            // 簡單 base64 decode（非最嚴謹但對小量可用）
            int qi = 0; char quartet[4];
            int outIdx = 0;
            for (int i = 0; i < srcLen; ++i) {
              char c = binData[i];
              if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
                quartet[qi++] = c;
                if (qi == 4) {
                  int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
                  int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
                  int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
                  int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
                  if (v0 >= 0 && v1 >= 0) {
                    outBuf[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
                    if (v2 != -2) {
                      outBuf[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
                    }
                    if (v3 != -2) {
                      outBuf[outIdx++] = ((v2 & 0x03) << 6) | v3;
                    }
                  }
                  qi = 0;
                }
              }
            }
            // 現在 outBuf[0..outIdx-1] 包含二進位，短版行為：分段讀 CHUNK_SIZE、CHUNK_SIZE (b then r) 並 writeImagePart
            int offset = 0;
            int round = 0;
            while (offset + CHUNK_SIZE * 2 <= outIdx) {
              display.writeImagePart(
                outBuf + offset, outBuf + offset + CHUNK_SIZE,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              offset += CHUNK_SIZE * 2;
              round++;
              delay(5);
            }
            free(outBuf);
            display.refresh();
            delay(12000);
            display.powerOff();
            Serial.println("✅ activate 的 binData 顯示完成");
          } else {
            Serial.println("❌ 分配 outBuf 失敗");
          }
        }
      }
    } else {
      // 未激活 -> 保存激活資訊
      activationInfo.activation_code = doc["activation_code"] | "";
      activationInfo.expire_at = doc["expire_at"] | "";
      activationInfo.isValid = true;
      preferences.putString("activation_code", activationInfo.activation_code);
      preferences.putString("expire_at", activationInfo.expire_at);
      preferences.putULong("last_activate_time", millis() / 1000);
      Serial.println("🔐 未激活，儲存激活碼：" + activationInfo.activation_code);
    }
  } else {
    Serial.println("❌ activate HTTP 錯誤碼: " + String(httpCode));
  }
  http.end();
}

int b64val(char ch) {
  if (ch >= 'A' && ch <= 'Z') return ch - 'A';
  if (ch >= 'a' && ch <= 'z') return ch - 'a' + 26;
  if (ch >= '0' && ch <= '9') return ch - '0' + 52;
  if (ch == '+') return 62;
  if (ch == '/') return 63;
  if (ch == '=') return -2;
  return -1;
}

// 流式 Base64 解碼函數：從 response 字符串的指定範圍直接解碼，避免複製大字符串
// 返回解碼後的總數據長度
int base64DecodeStreamingFromResponse(const String& response, int startIdx, int endIdx, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  Serial.println("   📊 從 response[" + String(startIdx) + "] 到 response[" + String(endIdx) + "]");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int srcLen = endIdx - startIdx;
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  
  for (int i = 0; i < srcLen; ++i) {
    char c = response.charAt(startIdx + i);
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          outIdx++;
          
          if (v2 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
            outIdx++;
          }
          
          if (v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
            outIdx++;
          }
          
          // 當緩衝區滿了（達到 2 * CHUNK_SIZE），寫入顯示
          if (bufferIdx >= CHUNK_SIZE * 2) {
            display.writeImagePart(
              bBuf, rBuf,
              0, 0, 800, 8,
              0, round * 8, 800, 8,
              true, false, false
            );
            round++;
            Serial.printf("📤 已寫入第 %d 塊 (總共 %d bytes)\n", round, outIdx);
            bufferIdx = 0;
            delay(50);
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
    }
  }
  
  // 處理剩餘的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 確保紅色緩衝區正確
    int blackBytes = min(bufferIdx, CHUNK_SIZE);
    int redBytes = max(0, bufferIdx - CHUNK_SIZE);
    
    if (redBytes < CHUNK_SIZE) {
      memset(rBuf + redBytes, 0, CHUNK_SIZE - redBytes);
    }
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// 流式 Base64 解碼函數：邊解碼邊寫入顯示，避免大內存分配
// 返回解碼後的總數據長度
int base64DecodeStreaming(const String& base64Str, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int srcLen = base64Str.length();
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  
  for (int i = 0; i < srcLen; ++i) {
    char c = base64Str[i];
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          outIdx++;
          
          if (v2 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
            outIdx++;
          }
          
          if (v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
            buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
            outIdx++;
          }
          
          // 當緩衝區滿了（達到 2 * CHUNK_SIZE），寫入顯示
          if (bufferIdx >= CHUNK_SIZE * 2) {
            display.writeImagePart(
              bBuf, rBuf,
              0, 0, 800, 8,
              0, round * 8, 800, 8,
              true, false, false
            );
            round++;
            Serial.printf("📤 已寫入第 %d 塊 (總共 %d bytes)\n", round, outIdx);
            bufferIdx = 0;
            delay(50);
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
    }
  }
  
  // 處理剩餘的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 確保紅色緩衝區正確
    int blackBytes = min(bufferIdx, CHUNK_SIZE);
    int redBytes = max(0, bufferIdx - CHUNK_SIZE);
    
    if (redBytes < CHUNK_SIZE) {
      memset(rBuf + redBytes, 0, CHUNK_SIZE - redBytes);
    }
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// Base64 解碼函數：將 Base64 字符串解碼為二進位數據
// 返回解碼後的數據長度，如果失敗返回 -1
int base64Decode(const String& base64Str, uint8_t* output, int maxOutputLen) {
  int srcLen = base64Str.length();
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  
  for (int i = 0; i < srcLen && outIdx < maxOutputLen; ++i) {
    char c = base64Str[i];
    // 跳過空白字符
    if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
    
    // 檢查是否為有效的 Base64 字符
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
      quartet[qi++] = c;
      if (qi == 4) {
        int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
        int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
        int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
        int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
        
        if (v0 >= 0 && v1 >= 0) {
          if (outIdx >= maxOutputLen) break;
          output[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
          
          if (v2 != -2) {
            if (outIdx >= maxOutputLen) break;
            output[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
          }
          
          if (v3 != -2) {
            if (outIdx >= maxOutputLen) break;
            output[outIdx++] = ((v2 & 0x03) << 6) | v3;
          }
        }
        qi = 0;
      }
    }
  }
  
  // 處理剩餘的字符
  if (qi > 0 && outIdx < maxOutputLen) {
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    
    if (v0 >= 0 && v1 >= 0) {
      output[outIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
      if (v2 >= 0 && outIdx < maxOutputLen) {
        output[outIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
      }
    }
  }
  
  return outIdx;
}

// 流式 Base64 解碼：從 HTTP 流直接讀取並解碼，邊讀邊寫入顯示
// 返回解碼後的總數據長度
int base64DecodeStreamingFromHTTPStream(WiFiClient* stream, HTTPClient& http, int expectedSize) {
  Serial.println("   🔄 流式解碼：使用固定緩衝區 " + String(CHUNK_SIZE * 2) + " bytes");
  Serial.println("   📊 從 HTTP 流直接讀取 Base64 並解碼");
  
  // 使用固定大小的緩衝區（黑色 + 紅色數據）
  uint8_t* buffer = (uint8_t*)malloc(CHUNK_SIZE * 2);
  if (!buffer) {
    Serial.println("❌ 無法分配緩衝區內存");
    return -1;
  }
  
  uint8_t* bBuf = buffer;
  uint8_t* rBuf = buffer + CHUNK_SIZE;
  
  int outIdx = 0;
  int qi = 0;
  char quartet[4];
  int round = 0;
  int bufferIdx = 0;
  unsigned long lastDataTime = millis();
  unsigned long startTime = millis();
  int base64CharsRead = 0;
  bool foundEndQuote = false;
  
  // 計算預期的 Base64 字符數（96000 bytes ≈ 128000 Base64 字符）
  int expectedBase64Chars = (expectedSize * 4 + 2) / 3;
  Serial.println("   📊 預期 Base64 字符數: ~" + String(expectedBase64Chars));
  
  // 從流中讀取 Base64 字符並實時解碼
  // 持續讀取直到：1) 連接關閉且無數據 2) 達到預期大小 3) 真正超時
  bool shouldContinue = true;
  int consecutiveEmptyReads = 0;
  const int MAX_EMPTY_READS = 100; // 連續 100 次空讀取（約 1 秒）才認為完成
  
  while (shouldContinue) {
    if (stream->available() > 0) {
      char c = stream->read();
      lastDataTime = millis();
      consecutiveEmptyReads = 0; // 重置空讀取計數
      
      // 跳過空白字符（但不計入 base64CharsRead）
      if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
      
      // 檢查是否為有效的 Base64 字符
      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
        base64CharsRead++; // 只對有效的 Base64 字符計數
        
        // 每讀取 10000 Base64 字符顯示一次進度
        if (base64CharsRead % 10000 == 0) {
          Serial.printf("   📊 已讀取: %d / ~%d Base64 字符，已解碼: %d / %d bytes (%.1f%%)\n", 
                        base64CharsRead, expectedBase64Chars, outIdx, expectedSize, 
                        (float)outIdx * 100.0 / expectedSize);
        }
        
        quartet[qi++] = c;
        if (qi == 4) {
          int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
          int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
          int v2 = (quartet[2] == '=') ? -2 : b64val(quartet[2]);
          int v3 = (quartet[3] == '=') ? -2 : b64val(quartet[3]);
          
          if (v0 >= 0 && v1 >= 0) {
            // 第一個字節：總是輸出
            buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
            outIdx++;
            
            // 檢查 buffer 是否滿了，如果滿了先寫入顯示
            if (bufferIdx >= CHUNK_SIZE * 2) {
              // 輸出 buffer 內容到 Serial（十六進制格式，全部連在一起）
              Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
              for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                if (buffer[i] < 0x10) Serial.print("0");
                Serial.print(buffer[i], HEX);
              }
              Serial.println();
              
              display.writeImagePart(
                bBuf, rBuf,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              round++;
              Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                           round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
              bufferIdx = 0;
              delay(50);
            }
            
            // 第二個字節：如果 v2 有效
            if (v2 != -2) {
              buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
              outIdx++;
              
              // 再次檢查 buffer 是否滿了
              if (bufferIdx >= CHUNK_SIZE * 2) {
                // 輸出 buffer 內容到 Serial
                Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
                for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                  if (buffer[i] < 0x10) Serial.print("0");
                  Serial.print(buffer[i], HEX);
                }
                Serial.println();
                
                display.writeImagePart(
                  bBuf, rBuf,
                  0, 0, 800, 8,
                  0, round * 8, 800, 8,
                  true, false, false
                );
                round++;
                Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                             round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
                bufferIdx = 0;
                delay(50);
              }
            }
            
            // 第三個字節：如果 v3 有效
            if (v3 != -2) {
              buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
              outIdx++;
              
              // 再次檢查 buffer 是否滿了
              if (bufferIdx >= CHUNK_SIZE * 2) {
                // 輸出 buffer 內容到 Serial
                Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
                for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                  if (buffer[i] < 0x10) Serial.print("0");
                  Serial.print(buffer[i], HEX);
                }
                Serial.println();
                
                display.writeImagePart(
                  bBuf, rBuf,
                  0, 0, 800, 8,
                  0, round * 8, 800, 8,
                  true, false, false
                );
                round++;
                Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                             round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
                bufferIdx = 0;
                delay(50);
              }
            }
          }
          qi = 0;
        }
      } else {
        // 遇到非 Base64 字符（如引號、逗號、}等）
        // 如果 quartet 中有字符，先處理它們，然後再跳過非 Base64 字符
        if (qi > 0) {
          // 處理當前不完整的 quartet
          int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
          int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
          int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
          int v3 = (qi > 3 && quartet[3] != '=') ? b64val(quartet[3]) : -2;
          
          if (v0 >= 0 && v1 >= 0) {
            if (bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
              outIdx++;
            }
            
            if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
              outIdx++;
            }
            
            if (v3 >= 0 && v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
              buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
              outIdx++;
            }
            
            // 如果緩衝區滿了，寫入顯示
            if (bufferIdx >= CHUNK_SIZE * 2) {
              // 輸出 buffer 內容到 Serial
              Serial.print("📦 Buffer[" + String(round) + "] (hex, 非Base64處理): ");
              for (int i = 0; i < CHUNK_SIZE * 2; i++) {
                if (buffer[i] < 0x10) Serial.print("0");
                Serial.print(buffer[i], HEX);
              }
              Serial.println();
              
              display.writeImagePart(
                bBuf, rBuf,
                0, 0, 800, 8,
                0, round * 8, 800, 8,
                true, false, false
              );
              round++;
              Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                           round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
              bufferIdx = 0;
              delay(50);
            }
          }
          qi = 0; // 重置 quartet
        }
        // 跳過非 Base64 字符，繼續讀取（可能是 JSON 結束標記）
      }
    } else {
      // 沒有可用數據，等待一下
      delay(10);
      consecutiveEmptyReads++;
      
      unsigned long elapsed = millis() - lastDataTime;
      
      // 檢查是否應該繼續
      // 1. 如果已經解碼了足夠的數據（≥98%），且連接已關閉，且等待了足夠時間
      // 注意：不要提前退出，讓循環自然結束以處理 buffer 中的剩餘數據
      if (outIdx >= expectedSize * 0.98 && !http.connected() && consecutiveEmptyReads >= 50) {
        // 不立即退出，繼續等待直到真正完成或超時
        // 這樣可以確保 buffer 中的數據被處理
      }
      
      // 2. 如果連接已關閉，且連續多次沒有數據，認為完成
      if (!http.connected() && consecutiveEmptyReads >= MAX_EMPTY_READS) {
        Serial.println("⏱️ 連接已關閉且無數據，Base64 數據接收完成");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d / %d bytes (%.1f%%)\n", 
                     base64CharsRead, outIdx, expectedSize, 
                     (float)outIdx * 100.0 / expectedSize);
        Serial.printf("   📊 buffer 中還有 %d bytes 未寫入，將在循環結束後處理\n", bufferIdx);
        shouldContinue = false;
        break;
      }
      
      // 3. 如果連接還開著但超過 30 秒沒有新數據，認為超時（大幅增加超時時間）
      if (http.connected() && elapsed > 30000) {
        Serial.println("⏱️ 接收超時（30秒無數據），認為 Base64 數據已完整");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d / %d bytes (%.1f%%)\n", 
                     base64CharsRead, outIdx, expectedSize, 
                     (float)outIdx * 100.0 / expectedSize);
        shouldContinue = false;
        break;
      }
      
      // 4. 如果已經達到或超過預期大小，認為完成
      if (outIdx >= expectedSize) {
        Serial.println("✅ 已達到預期大小，Base64 數據接收完成");
        Serial.printf("   📊 總共讀取: %d Base64 字符，解碼: %d bytes\n", 
                     base64CharsRead, outIdx);
        shouldContinue = false;
        break;
      }
    }
  }
  
  Serial.printf("   ✅ Base64 讀取完成: %d 字符，解碼: %d bytes，耗時: %lu ms\n", 
                base64CharsRead, outIdx, millis() - startTime);
  Serial.printf("   📊 循環結束時: bufferIdx=%d, qi=%d\n", bufferIdx, qi);
  
  // 計算預期解碼大小
  int expectedDecoded = (base64CharsRead * 3) / 4;
  Serial.printf("   📊 預期解碼大小: %d bytes (從 %d Base64 字符)\n", expectedDecoded, base64CharsRead);
  Serial.printf("   📊 實際解碼大小: %d bytes，差異: %d bytes\n", outIdx, expectedDecoded - outIdx);
  
  // 處理剩餘的字符（最後不完整的 quartet）
  if (qi > 0) {
    Serial.printf("   🔍 處理剩餘 %d 個 Base64 字符\n", qi);
    int v0 = (quartet[0] == '=') ? -2 : b64val(quartet[0]);
    int v1 = (quartet[1] == '=') ? -2 : b64val(quartet[1]);
    int v2 = (qi > 2 && quartet[2] != '=') ? b64val(quartet[2]) : -2;
    int v3 = (qi > 3 && quartet[3] != '=') ? b64val(quartet[3]) : -2;
    
    int beforeOutIdx = outIdx;
    if (v0 >= 0 && v1 >= 0) {
      // 第一個字節：總是輸出（如果有至少2個字符）
      if (bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = (v0 << 2) | ((v1 & 0x30) >> 4);
        outIdx++;
      }
      
      // 第二個字節：如果有3個字符
      if (v2 >= 0 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v1 & 0x0F) << 4) | ((v2 & 0x3C) >> 2);
        outIdx++;
      }
      
      // 第三個字節：如果有4個字符且第4個不是填充
      if (v3 >= 0 && v3 != -2 && bufferIdx < CHUNK_SIZE * 2) {
        buffer[bufferIdx++] = ((v2 & 0x03) << 6) | v3;
        outIdx++;
      }
    }
    Serial.printf("   ✅ 剩餘字符解碼完成，新增 %d bytes，總計: %d bytes\n", 
                 outIdx - beforeOutIdx, outIdx);
  }
  
  // 處理剩餘的數據（包括完整的塊）
  // 如果 buffer 中有完整的塊（bufferIdx >= CHUNK_SIZE * 2），先寫入
  while (bufferIdx >= CHUNK_SIZE * 2) {
    // 輸出 buffer 內容到 Serial
    Serial.print("📦 Buffer[" + String(round) + "] (hex): ");
    for (int i = 0; i < CHUNK_SIZE * 2; i++) {
      if (buffer[i] < 0x10) Serial.print("0");
      Serial.print(buffer[i], HEX);
    }
    Serial.println();
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入第 %d 塊 (總共 %d / %d bytes, %.1f%%)\n", 
                 round, outIdx, expectedSize, (float)outIdx * 100.0 / expectedSize);
    
    // 移動剩餘數據到 buffer 開頭
    if (bufferIdx > CHUNK_SIZE * 2) {
      memmove(buffer, buffer + CHUNK_SIZE * 2, bufferIdx - CHUNK_SIZE * 2);
      bufferIdx -= CHUNK_SIZE * 2;
    } else {
      bufferIdx = 0;
    }
    delay(50);
  }
  
  // 處理最後不足一個完整塊的數據
  if (bufferIdx > 0) {
    // 填充不足的部分
    if (bufferIdx < CHUNK_SIZE * 2) {
      memset(buffer + bufferIdx, 0, CHUNK_SIZE * 2 - bufferIdx);
    }
    
    // 輸出最後一塊 buffer 內容到 Serial
    Serial.print("📦 Buffer[" + String(round) + "] (最後一塊, hex): ");
    for (int i = 0; i < CHUNK_SIZE * 2; i++) {
      if (buffer[i] < 0x10) Serial.print("0");
      Serial.print(buffer[i], HEX);
    }
    Serial.println();
    
    display.writeImagePart(
      bBuf, rBuf,
      0, 0, 800, 8,
      0, round * 8, 800, 8,
      true, false, false
    );
    round++;
    Serial.printf("📤 已寫入最後一塊 (總共 %d bytes)\n", outIdx);
  }
  
  free(buffer);
  
  Serial.println("📦 流式解碼寫入完成，開始 refresh...");
  display.refresh();
  delay(12000);
  display.powerOff();
  Serial.println("✅ ePaper 顯示完成");
  
  return outIdx;
}

// callDeviceStatusAPI: 真正的流式處理 - 邊讀邊處理，不存儲完整響應
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
  http.setReuse(false);

  String postData = "deviceID=" + deviceID;
  int httpCode = http.POST(postData);
  Serial.println("📥 HTTP 響應碼: " + String(httpCode));
  if (httpCode != HTTP_CODE_OK) {
    Serial.println("❌ HTTP 錯誤: " + String(httpCode));
    http.end();
    return;
  }

  // 真正的流式處理：邊讀邊解析，不存儲完整響應
  Serial.println("📥 開始流式處理 HTTP 響應...");
  
  WiFiClient* stream = http.getStreamPtr();
  if (!stream) {
    Serial.println("❌ 無法獲取流對象");
    http.end();
    return;
  }

  // 等待數據開始傳輸
  unsigned long timeout = millis();
  while (stream->available() == 0 && (millis() - timeout) < 10000) {
    delay(10);
  }
  
  if (stream->available() == 0) {
    Serial.println("❌ 無數據可用");
    http.end();
    return;
  }
  
  // 流式解析 JSON 小字段（只讀取到 binData 之前）
  Serial.println("📋 開始流式解析 JSON...");
  
  bool success = false;
  bool isActivated = false;
  bool needUpdate = false;
  int refreshInterval = 300;
  int binSize = 0;
  int binDataStartPos = -1;
  
  // 使用小緩衝區讀取 JSON 前綴（到 binData 之前）
  String jsonPrefix = "";
  jsonPrefix.reserve(200); // 只預留小空間用於 JSON 前綴
  
  const char* binDataMarker = "\"binData\":\"";
  int markerLen = strlen(binDataMarker);
  int markerMatch = 0;
  bool foundBinData = false;
  
  // 流式讀取直到找到 binData 標記
  unsigned long lastDataTime = millis();
  while ((http.connected() || stream->available() > 0) && !foundBinData) {
    if (stream->available()) {
      char c = stream->read();
      lastDataTime = millis();
      
      // 檢查是否匹配 binData 標記
      if (c == binDataMarker[markerMatch]) {
        markerMatch++;
        if (markerMatch == markerLen) {
          // 找到 binData 標記！
          binDataStartPos = jsonPrefix.length() + markerLen - 10; // 調整位置
          foundBinData = true;
          Serial.println("✅ 找到 binData 標記，位置: " + String(jsonPrefix.length()));
      break;
        }
    } else {
        // 重置匹配
        if (markerMatch > 0) {
          // 將之前匹配的部分添加到 jsonPrefix
          for (int i = 0; i < markerMatch; i++) {
            if (jsonPrefix.length() < 200) {
              jsonPrefix += binDataMarker[i];
            }
          }
          markerMatch = 0;
        }
        
        // 添加到前綴（只保存前 200 字符用於解析小字段）
        if (jsonPrefix.length() < 200) {
          jsonPrefix += c;
        }
      }
    } else {
      delay(10);
      if (!http.connected() && (millis() - lastDataTime) > 2000) {
        break;
      }
    }
  }
  
  // 從 jsonPrefix 中提取小字段
  if (jsonPrefix.indexOf("\"success\":true") >= 0) {
    success = true;
  }
  if (jsonPrefix.indexOf("\"isActivated\":true") >= 0) {
    isActivated = true;
  }
  if (jsonPrefix.indexOf("\"needUpdate\":true") >= 0) {
    needUpdate = true;
  }
  
  // 提取 refreshInterval
  int refreshIdx = jsonPrefix.indexOf("\"refreshInterval\":");
  if (refreshIdx >= 0) {
    int startIdx = refreshIdx + 18;
    int endIdx = jsonPrefix.indexOf(",", startIdx);
    if (endIdx < 0) endIdx = jsonPrefix.indexOf("}", startIdx);
    if (endIdx > startIdx) {
      refreshInterval = jsonPrefix.substring(startIdx, endIdx).toInt();
    }
  }
  
  // 提取 binSize
  int binSizeIdx = jsonPrefix.indexOf("\"binSize\":");
  if (binSizeIdx >= 0) {
    int startIdx = binSizeIdx + 10;
    int endIdx = jsonPrefix.indexOf(",", startIdx);
    if (endIdx < 0) endIdx = jsonPrefix.indexOf("}", startIdx);
    if (endIdx > startIdx) {
      binSize = jsonPrefix.substring(startIdx, endIdx).toInt();
    }
  }
  
  Serial.println("✅ 流式解析 JSON 前綴成功:");
  Serial.println("   - success: " + String(success));
  Serial.println("   - isActivated: " + String(isActivated));
  Serial.println("   - needUpdate: " + String(needUpdate));
  Serial.println("   - refreshInterval: " + String(refreshInterval));
  Serial.println("   - binSize: " + String(binSize));
  Serial.println("   - foundBinData: " + String(foundBinData));
  
  // 清理 jsonPrefix 以釋放內存
  jsonPrefix = "";
  
  // 處理解析結果
  if (!success) {
    Serial.println("❌ success:false");
    http.end();
    return;
  }

  if (!isActivated) {
    String existingId = preferences.getString("deviceID", "");
    if (existingId.length() > 0) {
      preferences.remove("deviceID");
      Serial.println("🗑️ 已清除保存的 deviceID");
    }
    String uniqueIdNow = getChipId();
    Serial.println("🔁 isActivated=false，重新進入激活流程，unique_id=" + uniqueIdNow);
    http.end();
    callActivateAPI(uniqueIdNow);
    return;
  }

  // 如果有 binData，直接從流中流式解碼
  if (foundBinData && needUpdate) {
    Serial.println("📊 binData 信息:");
    Serial.println("   - 預期 binSize: " + String(binSize) + " bytes");
    Serial.println("   📊 可用內存: " + String(ESP.getFreeHeap()) + " bytes");
    
    Serial.println("🔄 開始從 HTTP 流直接流式解碼 Base64...");
    
    // 直接從 HTTP 流讀取 Base64 並解碼
    int decodedLen = base64DecodeStreamingFromHTTPStream(stream, http, binSize);
    
    // 讀取並丟棄剩餘數據（直到連接關閉）
    while (stream->available() > 0 || http.connected()) {
      if (stream->available()) {
        stream->read(); // 丟棄剩餘數據
      } else {
        delay(10);
        if (!http.connected() && (millis() - lastDataTime) > 2000) {
          break;
        }
      }
    }
    
    http.end();
    
    if (decodedLen > 0) {
      Serial.println("✅ 流式解碼完成，總大小: " + String(decodedLen) + " bytes");
        } else {
      Serial.println("❌ 流式解碼失敗");
    }
    
    // 更新配置
    savedConfig.isActivated = true;
    savedConfig.needUpdate = needUpdate;
    savedConfig.refreshInterval = refreshInterval;
    savedConfig.hasBinData = true;
    savedConfig.binSize = binSize;
    saveConfig(savedConfig);
      return;
        } else {
    // 沒有 binData，讀取並丟棄剩餘響應
    while (stream->available() > 0 || http.connected()) {
      if (stream->available()) {
        stream->read();
        } else {
        delay(10);
      }
    }
    http.end();
    
    Serial.println("ℹ️ 無需更新或無 binData");
  }

  // 更新 savedConfig 與持久化
  savedConfig.isActivated = true;
  savedConfig.needUpdate = needUpdate;
  savedConfig.refreshInterval = refreshInterval;
  savedConfig.hasBinData = false;
  savedConfig.binSize = binSize;
  saveConfig(savedConfig);
  return;
}

// goToDeepSleep（同你原本）
void goToDeepSleep(int sleepSeconds, bool isActivated) {
  Serial.println("\n========== 準備進入深度睡眠 ==========");
  esp_sleep_enable_ext0_wakeup((gpio_num_t)BUTTON_PIN_1, 0);
  Serial.println("🔘 已配置按鈕1喚醒");
  if (isActivated) {
    if (sleepSeconds <= 0) sleepSeconds = 300;
    Serial.println("⏰ 睡眠時間: " + String(sleepSeconds) + " 秒");
    esp_sleep_enable_timer_wakeup((uint64_t)sleepSeconds * 1000000ULL);
  } else {
    Serial.println("⚠️ 設備未激活，僅配置按鈕喚醒");
  }
  Serial.println("😴 進入深度睡眠...");
  delay(1000);
  esp_deep_sleep_start();
}
