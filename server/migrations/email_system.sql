-- Email System Migration
-- Tables: email_config (SMTP settings), email_log (sent email history)

-- 1. Email Configuration (SMTP settings per company)
CREATE TABLE IF NOT EXISTS email_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_secure TINYINT(1) DEFAULT 0,
  smtp_user VARCHAR(255) NULL,
  smtp_password_encrypted TEXT NULL,
  smtp_password_iv VARCHAR(100) NULL,
  smtp_password_tag VARCHAR(100) NULL,
  from_name VARCHAR(255) NULL,
  from_email VARCHAR(255) NULL,
  reply_to VARCHAR(255) NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_company_email (company_id)
);

-- 2. Email Log / History
CREATE TABLE IF NOT EXISTS email_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255) NULL,
  from_email VARCHAR(255) NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NULL,
  template_type VARCHAR(50) NULL,
  related_module VARCHAR(50) NULL,
  related_id INT NULL,
  status ENUM('Sent','Failed','Queued') DEFAULT 'Queued',
  error_message TEXT NULL,
  sent_by INT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_log_company ON email_log(company_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_module ON email_log(related_module);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at);
