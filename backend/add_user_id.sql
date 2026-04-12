-- 添加 user_id 字段
USE greeting_tool;
ALTER TABLE stats ADD COLUMN user_id VARCHAR(64) DEFAULT NULL AFTER event_name;
CREATE INDEX idx_user_id ON stats(user_id);
