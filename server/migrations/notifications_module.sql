-- ============================================================================
-- In-app notifications (audit F-08 / UI-003). Idempotent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT NULL,
    user_id     INT NOT NULL,
    type        VARCHAR(60) NOT NULL DEFAULT 'info',
    title       VARCHAR(200) NOT NULL,
    body        VARCHAR(800) NULL,
    link        VARCHAR(300) NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (user_id, is_read, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
