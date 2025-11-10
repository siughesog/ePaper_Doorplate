# 📋 配置指南：环境变量 vs 配置文件

本文档说明项目中配置的优先级和使用方式。

---

## 🔄 配置优先级（从高到低）

Spring Boot 的配置优先级：

1. **环境变量**（最高优先级）✅
2. **application.yml**（提供默认值）
3. **application.properties**（提供默认值，但会被 YML 覆盖）
4. **代码中的默认值**

---

## 📝 当前配置方式

### **混合模式：环境变量 + YML 默认值**

项目使用 **`${ENV_VAR:default}`** 语法，这意味着：

- ✅ **优先使用环境变量**：如果设置了环境变量，会覆盖 YML 中的值
- ✅ **YML 提供默认值**：如果环境变量未设置，使用 YML 中的默认值
- ✅ **灵活切换**：开发环境用默认值，生产环境用环境变量

---

## 📂 配置文件说明

### 1. **application.yml**（主要配置文件）

**位置：** `backend/epaperdoorplate/src/main/resources/application.yml`

**作用：**
- 定义所有配置项的结构
- 提供开发环境的默认值
- 使用 `${ENV_VAR:default}` 语法支持环境变量覆盖

**示例：**
```yaml
jwt:
  secret: ${JWT_SECRET:mySecretKey123456789012345678901234567890}
  # ↑ 优先从环境变量 JWT_SECRET 读取
  # ↑ 如果未设置，使用默认值 mySecretKey...
```

### 2. **application.properties**（旧配置文件）

**位置：** `backend/epaperdoorplate/src/main/resources/application.properties`

**作用：**
- 包含一些旧的硬编码配置
- **注意：** 如果 `application.yml` 存在，YML 的优先级更高
- 建议：逐步迁移到 YML，或删除此文件

**当前内容：**
```properties
server.port=8080
server.address=0.0.0.0
spring.data.mongodb.uri=mongodb://localhost:27017/test_for_Epaper_http_request
file.upload-dir=uploads
upload.folder=uploads
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB
```

**⚠️ 问题：**
- `application.properties` 中的 `spring.data.mongodb.uri` 是硬编码的
- 但 `application.yml` 中的配置会覆盖它（因为 YML 优先级更高）

---

## 🔧 配置项清单

### **使用环境变量的配置（推荐）**

以下配置项**优先使用环境变量**，如果未设置则使用 YML 中的默认值：

| 配置项 | 环境变量 | YML 路径 | 默认值 | 说明 |
|--------|---------|---------|--------|------|
| MongoDB URI | `MONGODB_URI` | `spring.data.mongodb.uri` | `mongodb://localhost:27017/epaperdoorplate` | 数据库连接 |
| JWT Secret | `JWT_SECRET` | `jwt.secret` | `mySecretKey...` | JWT 密钥（生产环境必须更改） |
| JWT 过期时间 | `JWT_EXPIRATION` | `jwt.expiration` | `86400000` | 24小时 |
| 服务器端口 | `SERVER_PORT` | `server.port` | `8080` | 服务端口 |
| SSL 启用 | `SERVER_SSL_ENABLED` | `server.ssl.enabled` | `false` | HTTPS 开关 |
| SSL Keystore | `SERVER_SSL_KEYSTORE` | `server.ssl.key-store` | `classpath:keystore.p12` | 证书文件 |
| Keystore 密码 | `KEYSTORE_PASSWORD` | `server.ssl.key-store-password` | `123456` | 证书密码 |
| SSL Key Alias | `SERVER_SSL_KEY_ALIAS` | `server.ssl.key-alias` | `tomcat` | 证书别名 |
| 存储类型 | `STORAGE_TYPE` | `storage.type` | `local` | `local` 或 `s3` |
| S3 Bucket | `STORAGE_S3_BUCKET` | `storage.s3.bucket` | 空 | S3 存储桶 |
| S3 Region | `STORAGE_S3_REGION` | `storage.s3.region` | `us-east-1` | S3 区域 |
| S3 Access Key | `STORAGE_S3_ACCESS_KEY` | `storage.s3.access-key` | 空 | AWS 访问密钥 |
| S3 Secret Key | `STORAGE_S3_SECRET_KEY` | `storage.s3.secret-key` | 空 | AWS 密钥 |
| CORS 允许来源 | `ALLOWED_ORIGINS` | `@Value("${ALLOWED_ORIGINS:}")` | 空 | CORS 域名列表 |
| 允许 Localhost | `ALLOW_LOCALHOST` | `@Value("${ALLOW_LOCALHOST:true}")` | `true` | 开发环境允许 localhost |
| Spring Security 用户名 | `SPRING_SECURITY_USER_NAME` | `spring.security.user.name` | `admin` | 默认用户 |
| Spring Security 密码 | `SPRING_SECURITY_USER_PASSWORD` | `spring.security.user.password` | `admin123` | 默认密码 |

### **仅使用配置文件的配置**

以下配置项**只从配置文件读取**，不支持环境变量：

| 配置项 | 文件 | 路径 | 值 | 说明 |
|--------|------|------|-----|------|
| 上传文件夹 | `application.properties` | `upload.folder` | `uploads` | 本地存储目录 |
| 文件上传大小限制 | `application.properties` | `spring.servlet.multipart.max-file-size` | `10MB` | 单文件最大大小 |
| 请求大小限制 | `application.properties` | `spring.servlet.multipart.max-request-size` | `10MB` | 请求最大大小 |
| 静态资源路径 | `application.properties` | `spring.web.resources.static-locations` | `file:./uploads/` | 静态文件路径 |

---

## 🎯 使用场景

### **场景 1：本地开发（使用默认值）**

**不需要设置环境变量**，直接使用 YML 中的默认值：

```bash
# 直接启动，使用 application.yml 中的默认值
mvn spring-boot:run
```

**使用的配置：**
- MongoDB: `mongodb://localhost:27017/epaperdoorplate`
- JWT Secret: `mySecretKey123456789012345678901234567890`
- 存储类型: `local`
- 端口: `8080`
- SSL: `false`
- Localhost: `true`（允许）

### **场景 2：云端部署（使用环境变量）**

**在部署平台设置环境变量**，覆盖默认值：

```env
# Railway/Render 环境变量设置
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
JWT_SECRET=your-very-long-random-secret-key-64-chars-minimum
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket
STORAGE_S3_ACCESS_KEY=your-key
STORAGE_S3_SECRET_KEY=your-secret
ALLOWED_ORIGINS=https://yourdomain.com
ALLOW_LOCALHOST=false
SERVER_SSL_ENABLED=false
```

**使用的配置：**
- 环境变量覆盖了 YML 中的默认值
- 生产环境的安全配置生效

### **场景 3：混合配置（部分环境变量）**

**只设置部分环境变量**，其他使用默认值：

```env
# 只设置必要的环境变量
MONGODB_URI=mongodb://localhost:27017/my-db
JWT_SECRET=my-custom-secret
# 其他配置使用 YML 默认值
```

---

## 🔍 如何检查当前使用的配置

### **方法 1：查看启动日志**

Spring Boot 启动时会显示使用的配置：

```
✅ CORS 已配置，允許的來源: [http://localhost:3000]
🔧 開發模式：已允許 localhost 訪問
```

### **方法 2：添加配置日志**

在代码中添加日志输出当前配置：

```java
@Value("${jwt.secret}")
private String jwtSecret;

@PostConstruct
public void logConfig() {
    System.out.println("JWT Secret: " + (jwtSecret.length() > 10 ? jwtSecret.substring(0, 10) + "..." : jwtSecret));
}
```

### **方法 3：使用 Spring Boot Actuator**

添加 Actuator 依赖，访问 `/actuator/configprops` 查看所有配置。

---

## ⚠️ 注意事项

### **1. application.properties vs application.yml**

- **YML 优先级更高**：如果两个文件都存在，YML 会覆盖 Properties
- **建议**：统一使用 YML，删除或迁移 Properties 中的配置

### **2. 环境变量命名**

- **Spring Boot 自动转换**：`SERVER_PORT` → `server.port`
- **下划线转点号**：`STORAGE_S3_BUCKET` → `storage.s3.bucket`
- **大写转小写**：自动处理

### **3. 默认值安全**

- ⚠️ **生产环境必须设置环境变量**，不要使用默认值
- ⚠️ **JWT_SECRET** 默认值不安全，必须更改
- ⚠️ **数据库密码** 默认值不安全，必须更改

### **4. 配置文件提交到 Git**

- ✅ **application.yml** 可以提交（包含默认值）
- ❌ **不要提交包含真实密码的配置文件**
- ✅ **使用 `.gitignore` 排除敏感配置**

---

## 📋 推荐配置方式

### **开发环境**

1. **使用 YML 默认值**（无需设置环境变量）
2. **或创建 `.env` 文件**（本地开发，不提交到 Git）

```env
# .env（本地开发，不提交到 Git）
MONGODB_URI=mongodb://localhost:27017/my-dev-db
JWT_SECRET=dev-secret-key
ALLOW_LOCALHOST=true
```

### **生产环境**

1. **在部署平台设置环境变量**（Railway/Render/Vercel）
2. **不要使用默认值**
3. **所有敏感信息使用环境变量**

```env
# 部署平台环境变量（生产环境）
MONGODB_URI=mongodb+srv://...
JWT_SECRET=production-secret-64-chars-minimum
STORAGE_TYPE=s3
STORAGE_S3_BUCKET=your-bucket
STORAGE_S3_ACCESS_KEY=your-key
STORAGE_S3_SECRET_KEY=your-secret
ALLOWED_ORIGINS=https://yourdomain.com
ALLOW_LOCALHOST=false
```

---

## 🔧 迁移建议

### **当前状态**

- ✅ `application.yml` 已配置环境变量支持
- ⚠️ `application.properties` 仍有硬编码值（但被 YML 覆盖）
- ✅ Java 代码使用 `@Value` 注解读取配置

### **建议操作**

1. **保持现状**（推荐）：
   - 继续使用 YML + 环境变量的方式
   - `application.properties` 可以保留（不影响，因为 YML 优先级更高）

2. **清理 Properties**（可选）：
   - 将 `application.properties` 中的配置迁移到 YML
   - 删除 `application.properties` 文件

3. **统一配置**（最佳实践）：
   - 所有配置都支持环境变量
   - YML 只提供开发环境的默认值
   - 生产环境全部使用环境变量

---

## 📚 总结

**配置方式：**
- ✅ **环境变量**（生产环境，最高优先级）
- ✅ **application.yml**（开发环境默认值）
- ⚠️ **application.properties**（旧配置，被 YML 覆盖）

**推荐做法：**
- 开发环境：使用 YML 默认值
- 生产环境：使用环境变量覆盖
- 敏感信息：必须使用环境变量

**当前项目状态：**
- ✅ 已支持环境变量配置
- ✅ YML 提供默认值
- ✅ 可以灵活切换开发/生产环境

