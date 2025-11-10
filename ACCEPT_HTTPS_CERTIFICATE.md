# 如何接受/信任 HTTPS 自签名证书

当后端使用自签名证书时，浏览器会阻止连接。以下是接受证书的方法。

## 方法一：直接在浏览器中接受（最简单）

### Chrome/Edge 浏览器

1. **访问后端 API 直接地址**：
   ```
   https://localhost:8080/api/auth/validate
   ```
   或
   ```
   https://localhost:8080
   ```

2. **看到安全警告页面**：
   - Chrome/Edge 会显示："您的連接不是私人連線"
   - 或 "NET::ERR_CERT_INVALID"

3. **点击高级选项**：
   - 找到 "進階" 或 "Advanced" 按钮

4. **继续访问**：
   - 点击 "繼續前往 localhost（不安全）" 或 "Proceed to localhost (unsafe)"
   - 在 Chrome 中可能是 "繼續前往" 链接

### Firefox 浏览器

1. **访问后端地址**：
   ```
   https://localhost:8080
   ```

2. **看到警告页面**：
   - Firefox 显示："警告：潛在的安全性風險"

3. **点击高级**：
   - 点击 "進階" 或 "Advanced"

4. **接受风险**：
   - 点击 "接受風險並繼續" 或 "Accept the Risk and Continue"

### Safari 浏览器（Mac）

1. **访问后端地址**：
   ```
   https://localhost:8080
   ```

2. **显示证书警告**：
   - 点击 "顯示詳細資料" 或 "Show Details"

3. **继续访问**：
   - 点击 "訪問此網站" 或 "visit this website"

## 方法二：将证书添加到系统信任库（推荐，一次设置永久有效）

### Windows

1. **导出证书**：
   ```bash
   keytool -exportcert -alias tomcat -keystore backend/epaperdoorplate/src/main/resources/keystore.p12 -storepass 123456 -file localhost.cer
   ```

2. **导入到 Windows 证书存储**：
   - 双击 `localhost.cer` 文件
   - 选择 "安裝憑證" 或 "Install Certificate"
   - 选择 "目前的使用者" 或 "Current User"
   - 选择 "將所有憑證放入以下的存放區" 或 "Place all certificates in the following store"
   - 点击 "瀏覽" 或 "Browse"，选择 "受信任的根憑證授權單位" 或 "Trusted Root Certification Authorities"
   - 点击 "確定" 或 "OK" 完成

### macOS

1. **导出证书**：
   ```bash
   keytool -exportcert -alias tomcat -keystore backend/epaperdoorplate/src/main/resources/keystore.p12 -storepass 123456 -file localhost.cer
   ```

2. **打开钥匙串访问**：
   - 双击 `localhost.cer` 文件
   - 或在终端运行：
   ```bash
   open localhost.cer
   ```

3. **添加到系统钥匙串**：
   - 在钥匙串访问中，找到证书
   - 双击打开证书详情
   - 展开 "信任" 或 "Trust"
   - 将 "使用此憑證時" 或 "When using this certificate" 设置为 "永遠信任" 或 "Always Trust"

### Linux

1. **导出证书**：
   ```bash
   keytool -exportcert -alias tomcat -keystore backend/epaperdoorplate/src/main/resources/keystore.p12 -storepass 123456 -file localhost.cer
   ```

2. **添加到系统 CA 存储**：
   ```bash
   sudo cp localhost.cer /usr/local/share/ca-certificates/localhost.crt
   sudo update-ca-certificates
   ```

## 方法三：验证证书是否正确配置

### 检查证书文件是否存在

```bash
ls -la backend/epaperdoorplate/src/main/resources/keystore.p12
```

### 验证证书信息

```bash
keytool -list -v -keystore backend/epaperdoorplate/src/main/resources/keystore.p12 -storepass 123456
```

应该看到：
- 证书类型：PKCS12
- 别名：tomcat
- 有效期等信息

### 测试 HTTPS 连接

使用 curl 测试（忽略证书验证）：
```bash
curl -k https://localhost:8080/api/auth/validate
```

## 如果证书有问题，重新生成

### 删除旧证书

```bash
rm backend/epaperdoorplate/src/main/resources/keystore.p12
```

### 生成新证书

```bash
cd backend/epaperdoorplate/src/main/resources
keytool -genkeypair -alias tomcat -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore keystore.p12 -validity 365 -storepass 123456
```

按提示输入信息：
- **名字与姓氏**：`localhost`（重要！）
- **组织单位**：可以填写公司名称或留空
- **组织**：可以填写组织名称或留空
- **城市**：可以留空
- **省份**：可以留空
- **国家代码**：可以留空或输入 `CN`

**重要**：名字与姓氏必须填写 `localhost`，否则浏览器会显示证书名称不匹配。

### 更新 application.yml

确保配置正确：
```yaml
server:
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: 123456  # 与生成证书时使用的密码一致
    key-store-type: PKCS12
    key-alias: tomcat
```

## 开发环境的快速解决方案

如果不想每次都处理证书问题，可以在开发环境临时禁用证书验证（仅用于开发，不要用于生产）：

### 前端临时方案（仅开发）

可以修改 `api.js` 添加开发环境标志，但这不推荐。更好的方式是：

1. **使用 HTTP（推荐用于开发）**：
   - 将默认URL改回 `http://localhost:8080`
   - 后端暂时禁用 SSL

2. **或接受证书一次**：
   - 在浏览器中访问一次 `https://localhost:8080`
   - 接受证书警告
   - 后续访问会自动信任

## 常见问题

### Q: 为什么浏览器一直提示证书错误？
A: 可能是因为证书的 CN（Common Name）不是 `localhost`，或者证书已过期。重新生成证书时确保 CN 为 `localhost`。

### Q: 接受了证书但前端还是连接失败？
A: 检查：
1. 后端是否成功启动（查看日志）
2. 证书密码是否正确
3. 证书文件路径是否正确
4. 浏览器控制台的具体错误信息

### Q: 生产环境应该怎么做？
A: 生产环境必须使用正式的 SSL 证书（如 Let's Encrypt），不要使用自签名证书。参考 `HTTPS_SETUP.md` 中的生产环境配置。








