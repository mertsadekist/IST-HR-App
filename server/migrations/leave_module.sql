-- ============================================================================
-- Leave Management module (audit F-02 / DB-002). Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_types (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NULL,                       -- NULL = global default available to all companies
    name          VARCHAR(100) NOT NULL,
    default_days  DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_paid       BOOLEAN NOT NULL DEFAULT TRUE,
    color         VARCHAR(20) NULL,
    status        ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leave_types_company (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leave_balances (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    leave_type_id INT NOT NULL,
    year          INT NOT NULL,
    entitled      DECIMAL(6,2) NOT NULL DEFAULT 0,
    used          DECIMAL(6,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_balance (employee_id, leave_type_id, year),
    INDEX idx_balance_company (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leave_requests (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    leave_type_id INT NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    days          DECIMAL(6,2) NOT NULL,
    reason        TEXT NULL,
    status        ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
    decided_by    INT NULL,
    decided_at    TIMESTAMP NULL,
    decision_note TEXT NULL,
    created_by    INT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leave_req_company_status (company_id, status),
    INDEX idx_leave_req_employee (employee_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Global default leave types (only inserted if no global types exist yet)
INSERT INTO leave_types (company_id, name, default_days, is_paid, color)
SELECT * FROM (
    SELECT NULL AS company_id, 'Annual Leave' AS name, 30 AS default_days, TRUE AS is_paid, '#2563eb' AS color
    UNION ALL SELECT NULL, 'Sick Leave', 15, TRUE, '#dc2626'
    UNION ALL SELECT NULL, 'Unpaid Leave', 0, FALSE, '#6b7280'
) seed
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE company_id IS NULL);
