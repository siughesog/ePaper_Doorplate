# POST /device/status API 測試命令

## 基本測試命令

### 1. 測試正常裝置
```bash
curl -X POST "http://localhost:8080/device/status" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "deviceID=ESP32_001"
```

### 2. 測試無效裝置
```bash
curl -X POST "http://localhost:8080/device/status" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "deviceID=INVALID_DEVICE"
```

### 3. 測試未啟用裝置
```bash
curl -X POST "http://localhost:8080/device/status" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "deviceID=UNACTIVATED_001"
```

## 預期回應格式

### 成功回應 (裝置已啟用)
```json
{
  "success": true,
  "isActivated": true,
  "needUpdate": true,
  "refreshInterval": 300,
  "binData": "base64_encoded_binary_data...",
  "binSize": 192000
}
```

### 成功回應 (裝置未啟用)
```json
{
  "success": true,
  "isActivated": false,
  "action": "return_to_activation"
}
```

### 錯誤回應 (裝置不存在)
```json
{
  "success": false,
  "message": "device not found"
}
```

## Python 測試腳本

### 簡單測試
```python
import requests

def test_device_status(device_id):
    url = "http://localhost:8080/device/status"
    response = requests.post(url, params={"deviceID": device_id})
    
    if response.status_code == 200:
        data = response.json()
        print(f"裝置 {device_id}: {data}")
    else:
        print(f"錯誤: {response.status_code}")

# 測試
test_device_status("ESP32_001")
```

## ESP32 程式碼整合範例

```cpp
// ESP32 中的 HTTP 請求範例
void checkDeviceStatus() {
    HTTPClient http;
    http.begin("http://10.236.124.201:8080/device/status");
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    int httpCode = http.POST("deviceID=ESP32_001");
    
    if (httpCode == 200) {
        String response = http.getString();
        Serial.println("回應: " + response);
        
        // 解析 JSON 回應
        // 檢查 needUpdate 和 binData
    }
    
    http.end();
}
```

