-- 创建数据库
CREATE DATABASE IF NOT EXISTS greeting_tool DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE greeting_tool;

-- 创建统计记录表
CREATE TABLE IF NOT EXISTS stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(50) NOT NULL COMMENT '事件名称',
  event_date DATE NOT NULL COMMENT '事件日期',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_event_name (event_name),
  INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='统计记录表';

-- 查看表结构
DESCRIBE stats;
