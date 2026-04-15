# 免费部署指南 - Vercel + Railway

## 方案概述

| 部分 | 平台 | 费用 |
|------|------|------|
| 前端 | Vercel | 🆓 完全免费 |
| 后端 | Railway | 🆓 免费额度足够 |
| 数据库 | Railway MySQL | 🆓 免费额度 |

---

## 一、准备工作

### 1. 注册账号
- Vercel: https://vercel.com/signup
- Railway: https://railway.app

### 2. 创建 GitHub 仓库
把你的代码上传到 GitHub。

---

## 二、修改前端 API 地址

在 `boss_greeting_tool（1）.html` 中搜索 `localhost:3000`，共 3 处：

```javascript
// 本地
const url = 'https://greetingtool-production.up.railway.app/api/chat/completions';

// 部署后（等 Railway 分配完域名再改）
const url = 'https://your-railway-app.up.railway.app/api/chat/completions';
```

---

## 三、部署前端到 Vercel

### 步骤：
1. 访问 https://vercel.com/dashboard
2. 点击 "New Project"
3. 导入你的 GitHub 仓库
4. 配置：
   - Framework: Other
   - Root Directory: 留空
   - Output Directory: 留空
5. 点击 "Deploy"
6. 部署完成后会得到一个域名：`https://xxx.vercel.app`

---

## 四、部署后端和数据库到 Railway

### 1. 创建项目
1. 访问 https://railway.app/dashboard
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 导入你的仓库

### 2. 添加 MySQL 数据库
1. 在项目中点击 "+ New"
2. 选择 "MySQL"
3. 等待数据库启动完成

### 3. 配置环境变量
在 Railway 项目的 "Variables" 中添加：

| 变量名 | 值 |
|--------|-----|
| `VOLCENGINE_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` |
| `API_KEY` | `你的API_KEY` |
| `MODEL` | `你的MODEL_ID` |
| `DB_HOST` | (从 Railway MySQL 的 Connect 页面复制) |
| `DB_USER` | (从 Railway MySQL 的 Connect 页面复制) |
| `DB_PASSWORD` | (从 Railway MySQL 的 Connect 页面复制) |
| `DB_NAME` | `railway` |

### 4. 配置部署设置
在 Railway 项目的 "Settings" 中：
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

### 5. 初始化数据库
部署完成后，在 Railway 的 "Shell" 中连接 MySQL，执行：
```sql
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

### 6. 分配域名
在 Railway 项目的 "Settings" 中点击 "Generate Domain"，得到类似 `https://xxx.up.railway.app` 的地址。

---

## 五、更新前端 API 地址

现在用 Railway 的域名替换前端中的 `localhost:3000`：
```javascript
const url = 'https://你的railway域名.up.railway.app/api/chat/completions';
```

重新部署到 Vercel。

---

## 六、完成！

现在你可以通过 Vercel 的域名访问你的应用了！

---

## 免费额度说明

| 平台 | 免费额度 |
|------|----------|
| Vercel | 无限部署、无限流量、100GB 带宽/月 |
| Railway | $5/月 额度，包含数据库 |

对于学生个人项目，这些额度完全够用！
