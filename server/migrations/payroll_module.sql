-- ============================================================================
-- Payroll module (audit F-03 / DB-002). Idempotent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll_runs (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    company_id       INT NOT NULL,
    period           VARCHAR(7) NOT NULL,                 -- 'YYYY-MM'
    status           ENUM('Draft','Approved','Paid','Cancelled') NOT NULL DEFAULT 'Draft',
    employee_count   INT NOT NULL DEFAULT 0,
    total_gross      DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_net        DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_by       INT NULL,
    approved_by      INT NULL,
    approved_at      TIMESTAMP NULL,
    paid_at          TIMESTAMP NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_run_company_period (company_id, period),
    INDEX idx_run_company_status (company_id, status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_items (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    run_id             INT NOT NULL,
    company_id         INT NOT NULL,
    employee_id        INT NOT NULL,
    basic_salary       DECIMAL(12,2) NOT NULL DEFAULT 0,
    allowances         DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross              DECIMAL(12,2) NOT NULL DEFAULT 0,
    unpaid_leave_days  DECIMAL(6,2) NOT NULL DEFAULT 0,
    absence_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
    deductions         DECIMAL(12,2) NOT NULL DEFAULT 0,
    net                DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes              VARCHAR(500) NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item_run (run_id),
    INDEX idx_item_employee (employee_id),
    INDEX idx_item_company (company_id),
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
