# MongoDB Atlas SSL 连接问题修复指南

## 问题描述

错误信息：
```
javax.net.ssl.SSLException: Received fatal alert: internal_error
```

这通常是因为 MongoDB Atlas 连接字符串配置不正确导致的 SSL 握手失败。

## 解决方案

### 1. 检查 MongoDB Atlas 连接字符串格式

MongoDB Atlas 支持两种连接字符串格式：

#### 选项 A：使用 `mongodb+srv://`（推荐）

```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

**优点：**
- 自动使用 SSL/TLS
- 自动发现所有副本集节点
- 更简洁

**在 Railway 环境变量中设置：**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

#### 选项 B：使用 `mongodb://`（需要手动添加 SSL 参数）

```
mongodb://username:password@cluster-shard-00-00.xxxxx.mongodb.net:27017,cluster-shard-00-01.xxxxx.mongodb.net:27017,cluster-shard-00-02.xxxxx.mongodb.net:27017/database?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

**重要参数：**
- `ssl=true` - 启用 SSL
- `replicaSet=atlas-xxxxx-shard-0` - 副本集名称
- `authSource=admin` - 认证数据库

### 2. 从 MongoDB Atlas 获取正确的连接字符串

1. 登录 MongoDB Atlas：https://cloud.mongodb.com
2. 选择你的集群
3. 点击 "Connect"
4. 选择 "Connect your application"
5. 选择驱动：**Java**，版本：**4.1 or later**
6. 复制连接字符串

**示例：**
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 3. 在 Railway 中设置环境变量

1. 进入 Railway 项目
2. 选择你的服务
3. 点击 "Variables" 标签
4. 添加或更新 `MONGODB_URI`：

```
MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/your-database-name?retryWrites=true&w=majority
```

**重要提示：**
- 将 `<username>` 替换为你的 MongoDB 用户名
- 将 `<password>` 替换为你的 MongoDB 密码（**需要 URL 编码**）
- 将 `your-database-name` 替换为你的数据库名称
- 如果密码包含特殊字符，需要进行 URL 编码：
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`
  - `&` → `%26`
  - `+` → `%2B`
  - `=` → `%3D`
  - `?` → `%3F`

### 4. 验证网络访问

确保 MongoDB Atlas 网络访问白名单包含：
- `0.0.0.0/0`（允许所有 IP，用于测试）
- 或 Railway 的 IP 地址范围

### 5. 检查 Java 版本

Railway 使用 Java 21，应该支持 MongoDB SSL。如果仍有问题，可以尝试：

1. 在 `pom.xml` 中明确指定 MongoDB 驱动版本
2. 或者添加 SSL 相关依赖

### 6. 测试连接

部署后，检查日志：
- 如果看到 "Connected to MongoDB"，说明连接成功
- 如果仍然看到 SSL 错误，检查连接字符串格式

## 常见错误

### 错误 1：密码包含特殊字符未编码

**错误示例：**
```
MONGODB_URI=mongodb+srv://user:pass@word@cluster.mongodb.net/db
```

**正确示例：**
```
MONGODB_URI=mongodb+srv://user:pass%40word@cluster.mongodb.net/db
```

### 错误 2：使用 `mongodb://` 但缺少 `ssl=true`

**错误示例：**
```
MONGODB_URI=mongodb://user:pass@cluster.mongodb.net:27017/db
```

**正确示例：**
```
MONGODB_URI=mongodb://user:pass@cluster.mongodb.net:27017/db?ssl=true&retryWrites=true&w=majority
```

### 错误 3：数据库名称未指定

确保连接字符串中包含数据库名称：
```
mongodb+srv://user:pass@cluster.mongodb.net/epaperdoorplate?retryWrites=true&w=majority
```

## 快速检查清单

- [ ] 使用 `mongodb+srv://` 格式（推荐）
- [ ] 密码已进行 URL 编码
- [ ] 连接字符串包含数据库名称
- [ ] MongoDB Atlas 网络访问白名单已配置
- [ ] Railway 环境变量 `MONGODB_URI` 已正确设置
- [ ] 重新部署后检查日志

## 如果问题仍然存在

1. **检查 MongoDB Atlas 集群状态**
   - 确保集群正在运行
   - 检查是否有维护窗口

2. **尝试使用 MongoDB Compass 测试连接**
   - 使用相同的连接字符串
   - 如果 Compass 可以连接，说明连接字符串正确

3. **检查 Railway 日志**
   - 查看完整的错误堆栈
   - 确认环境变量是否正确加载

4. **联系支持**
   - 如果以上步骤都无法解决，可能需要检查 MongoDB Atlas 账户设置或联系 MongoDB 支持

