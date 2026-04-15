# 部署上线指南

## 一、准备工作

### 1. 服务器要求
- 操作系统：Linux (Ubuntu/CentOS) 或 Windows Server
- Node.js 18+
- MySQL 8.0+
- 内存：至少 1GB

### 2. 需要修改的文件

#### 前端 (boss_greeting_tool（1）.html)
搜索 `localhost:3000`，共 3 处，替换为你的服务器地址：
- 第 785 行
- 第 991 行
- 第 1143 行

示例：
```javascript
// 本地开发
const url = 'https://greetingtool-production.up.railway.app/api/chat/completions';

// 部署上线（改成你的地址）
const url = 'https://your-domain.com/api/chat/completions';
// 或
const url = 'http://123.45.67.89:3000/api/chat/completions';
```

#### 后端 (backend/server.js)
修改数据库配置（第 18-26 行）：
```javascript
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '你的MySQL密码',
  database: 'greeting_tool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
```

## 二、部署步骤

### 步骤 1：上传代码到服务器
```bash
# 方式一：使用 git
git clone 你的仓库地址

# 方式二：使用 scp 或 FTP 上传
scp -r d:\my_mini_project\greeting_tool user@server:/path/
```

### 步骤 2：安装依赖
```bash
cd /path/to/greeting_tool/backend
npm install
```

### 步骤 3：创建数据库
```bash
mysql -u root -p
```
执行：
```sql
CREATE DATABASE IF NOT EXISTS greeting_tool DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE greeting_tool;
CREATE TABLE IF NOT EXISTS stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(50) NOT NULL,
  user_id VARCHAR(64) DEFAULT NULL,
  event_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_name (event_name),
  INDEX idx_event_date (event_date),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 步骤 4：启动后端
```bash
cd /path/to/greeting_tool/backend
node server.js
```

推荐使用 PM2 保持后台运行：
```bash
npm install -g pm2
pm2 start server.js --name greeting-api
pm2 save
pm2 startup
```

### 步骤 5：托管前端
使用 Nginx 托管前端 HTML 文件：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/greeting_tool;
        index boss_greeting_tool（1）.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 三、安全建议

1. **不要暴露 API Key**：已移到后端 ✅
2. **使用 HTTPS**：配置 SSL 证书
3. **限制跨域**：修改后端 CORS 配置
4. **数据库安全**：使用强密码，限制远程访问

## 四、测试清单

- [ ] 前端页面可以正常访问
- [ ] 上传 JD 图片可以解析
- [ ] 生成打招呼功能正常
- [ ] 简历上传功能正常
- [ ] 复制功能正常
- [ ] 统计数据正常记录（访问 /api/stats）

## 五、常见问题

### Q: 端口被占用？
```bash
# Linux
lsof -i :3000
kill -9 PID

# Windows
netstat -ano | findstr :3000
taskkill /F /PID PID号
```

### Q: 数据库连接失败？
检查：
1. MySQL 服务是否启动
2. 用户名密码是否正确
3. 数据库是否已创建

### Q: 前端请求后端失败？
检查：
1. 后端是否启动
2. API 地址是否正确
3. 是否有跨域问题
