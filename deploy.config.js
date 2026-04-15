// 部署配置文件
// 部署前请修改以下配置

const config = {
  // 后端服务地址（部署时修改为实际地址）
  // 例如：http://your-server-ip:3000 或 https://your-domain.com
  API_BASE_URL: 'https://greetingtool-production.up.railway.app',
  
  // 数据库配置（后端 server.js 中也需要修改）
  DB_CONFIG: {
    host: 'localhost',
    user: 'root',
    password: '20050907sujuan.',
    database: 'greeting_tool'
  }
};

// 部署步骤：
// 1. 修改 API_BASE_URL 为你的服务器地址
// 2. 在前端 HTML 中搜索 localhost:3000 并替换为 API_BASE_URL
// 3. 修改后端 server.js 中的 DB_CONFIG
// 4. 确保 MySQL 服务已启动，数据库和表已创建
// 5. 运行后端：cd backend && node server.js
// 6. 用 nginx 或其他方式托管前端 HTML 文件
