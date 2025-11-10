# ESP32 HTTPS 配置說明

## 已完成的修改

代码已更新为使用 HTTPS：

1. **添加了 `WiFiClientSecure`**：支持 SSL/TLS 连接
2. **所有 URL 改为 HTTPS**：
   - `https://10.236.124.201:8080/bitmap1`
   - `https://192.168.100.12:8080/bitmap2`
3. **使用 `client.setInsecure()`**：跳过证书验证（用于自签名证书）

## 重要注意事项

### 1. 自签名证书的问题

⚠️ **使用 IP 地址 + 自签名证书的限制**：
- 后端证书是为 `localhost` 生成的
- 使用 IP 地址（如 `10.236.124.201`）时，证书验证会失败
- 因此使用 `setInsecure()` 跳过验证

### 2. 生产环境的建议

**选项 A：使用域名（推荐）**
```cpp
// 使用域名而不是 IP
char* url_getBitmap = "https://your-domain.com:8080/bitmap1";

// 验证证书（生产环境）
// client.setCACert(root_ca);  // 使用真实的 CA 证书
```

**选项 B：使用 IP 地址（开发环境）**
```cpp
// 使用 IP，跳过证书验证
const char* api_base_url = "https://10.236.124.201:8080";
client.setInsecure();  // 跳过验证
```

**选项 C：使用 Railway 生产环境（当前配置）**
```cpp
// 使用 Railway 域名，使用标准 HTTPS 证书
const char* api_base_url = "https://epaperdoorplate-production.up.railway.app";
// 可以移除 setInsecure() 以验证证书（推荐）
// 或保留 setInsecure() 以兼容所有情况
```

### 3. 证书验证方法

#### 方法一：跳过验证（当前使用，开发环境）

```cpp
WiFiClientSecure client;
client.setInsecure();  // 跳过所有证书验证
```

#### 方法二：使用真实证书（生产环境）

1. **获取服务器证书**：
   ```bash
   openssl s_client -showcerts -connect your-server.com:8080 </dev/null
   ```

2. **在代码中使用**：
   ```cpp
   const char* root_ca = \
     "-----BEGIN CERTIFICATE-----\n" \
     "..." \
     "-----END CERTIFICATE-----\n";
   
   WiFiClientSecure client;
   client.setCACert(root_ca);
   ```

#### 方法三：使用指纹验证（中等安全）

```cpp
const char* fingerprint = "AB:CD:EF:12:34:56:...";  // 证书指纹
WiFiClientSecure client;
client.setFingerprint(fingerprint);
```

## 代码修改详情

### 修改前（HTTP）
```cpp
#include <HTTPClient.h>
// ...
HTTPClient http;
http.begin(url_getBitmap);  // HTTP
```

### 修改后（HTTPS）
```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
// ...
WiFiClientSecure client;
client.setInsecure();  // 跳过证书验证
HTTPClient http;
http.begin(client, url_getBitmap);  // HTTPS
```

## 常见问题

### Q: 为什么使用 `setInsecure()`？
A: 因为后端使用自签名证书，且证书是针对 `localhost` 的，使用 IP 地址会导致证书验证失败。`setInsecure()` 允许连接但不验证证书。

### Q: 如何提高安全性？
A: 
1. 为后端生成包含 IP 地址或域名的证书
2. 在 ESP32 中验证证书指纹
3. 或使用正式的 SSL 证书

### Q: 连接失败怎么办？
A: 检查：
1. 后端 HTTPS 是否已启用
2. 防火墙是否允许端口 8080
3. ESP32 是否能访问服务器 IP
4. 证书是否正确配置

## 获取证书指纹（可选，用于验证）

```cpp
// 在 setup() 中添加，用于调试
WiFiClientSecure client;
if (!client.connect("10.236.124.201", 8080)) {
  Serial.println("Connection failed");
} else {
  Serial.println("Certificate fingerprint:");
  Serial.println(client.getPeerCertificate().fingerprint());
}
```

## 测试

1. 上传代码到 ESP32
2. 打开串口监视器（115200 baud）
3. 检查连接日志
4. 确认 HTTPS 请求成功

## 相关文件

- `GxEPD2_Example.ino` - 主程序
- `HTTPS_SETUP.md` - 后端 HTTPS 配置说明



