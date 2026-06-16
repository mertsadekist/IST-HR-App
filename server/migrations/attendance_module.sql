-- ============================================================================
-- Attendance module (audit F-01 / DB-002). Idempotent.
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    work_date     DATE NOT NULL,
    check_in      DATETIME NULL,
    check_out     DATETIME NULL,
    work_hours    DECIMAL(5,2) NULL,
    status        ENUM('Present','Absent','Late','Half Day','On Leave','Holiday','Remote')
                    NOT NULL DEFAULT 'Present',
    notes         VARCHAR(500) NULL,
    created_by    INT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance_emp_date (employee_id, work_date),
    INDEX idx_attendance_company_date (company_id, work_date),
    INDEX idx_attendance_status (status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
