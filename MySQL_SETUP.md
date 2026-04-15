# MySQL 数据统计配置指南

## 第一步：安装 MySQL

1. 下载 MySQL：https://dev.mysql.com/downloads/mysql/
2. 安装时设置 root 密码为：123456（如果设置了其他密码，请在 backend/server.js 的 DB_CONFIG 中修改）
3. 确保 MySQL 服务已启动

## 第二步：创建数据库和表

### 方法一：使用 MySQL 命令行

打开命令提示符（CMD）或 PowerShell，执行：

```bash
mysql -u root -p
```

输入密码后，执行以下SQL语句：

```sql
source d:/my_mini_project/greeting_tool/backend/init.sql
```

### 方法二：使用 MySQL Workbench 或其他图形界面工具

1. 打开 MySQL Workbench
2. 连接到本地 MySQL 服务器
3. 点击 File → Open SQL Script
4. 选择 `backend/init.sql 文件
5. 点击闪电图标执行

## 第三步：配置数据库连接

如果你的 MySQL 密码不是 123456，请修改 `backend/server.js` 中的 DB_CONFIG：

```javascript
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '你的密码',  // 修改这里
  database: 'greeting_tool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
```

## 第四步：重启后端服务器

```bash
cd d:/my_mini_project/greeting_tool/backend
node server.js
```

如果看到 `✅ MySQL 数据库连接成功` 说明配置成功！

## 查看统计数据

访问：https://greetingtool-production.up.railway.app/api/stats

返回格式：

```json
{
  "total": {
    "jdExtract": 10,
    "greetingGenerate": 8,
    "copyResult": 5
  },
  "dailyStats": {
    "2026-04-12": {
      "jdExtract": 5,
      "greetingGenerate": 4
    }
  }
}
```
