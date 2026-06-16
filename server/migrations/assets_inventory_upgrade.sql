-- Assets Module Upgrade Migration
-- Adds: asset_inventory, asset_assignment_history tables
-- Modifies: asset_assignments (add credential + inventory columns)

-- 1. Asset Inventory — Individual physical items with unique serial numbers
CREATE TABLE IF NOT EXISTS asset_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  platform_id INT NULL,
  asset_code VARCHAR(50) NULL,
  serial_number VARCHAR(255) NULL,
  barcode_data VARCHAR(255) NULL,
  brand VARCHAR(100) NULL,
  model VARCHAR(200) NULL,
  specifications TEXT NULL,
  purchase_date DATE NULL,
  purchase_cost DECIMAL(12,2) NULL,
  warranty_expiry DATE NULL,
  depreciation_rate DECIMAL(5,2) DEFAULT 10.00,
  current_value DECIMAL(12,2) NULL,
  image_url VARCHAR(500) NULL,
  location VARCHAR(255) NULL,
  status ENUM('Available','Assigned','In Repair','Retired','Lost','Disposed') DEFAULT 'Available',
  condition_status ENUM('New','Good','Fair','Poor','Damaged') DEFAULT 'New',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
  UNIQUE KEY unique_asset_code (asset_code)
);

-- 2. Asset Assignment History — Track who had what and when
CREATE TABLE IF NOT EXISTS asset_assignment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NULL,
  assignment_id INT NULL,
  employee_id INT NOT NULL,
  assigned_by INT NULL,
  action ENUM('Assigned','Returned','Transferred','Lost','Repaired') NOT NULL,
  action_date DATE NOT NULL,
  condition_at_action VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES asset_inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Add inventory_id link to asset_assignments (optional link to physical inventory item)
-- Check if column exists first
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'inventory_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN inventory_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Add credential columns to asset_assignments
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'account_username');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN account_username VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'encrypted_password');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN encrypted_password TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'password_iv');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN password_iv VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'password_tag');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN password_tag VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'account_url');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN account_url VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Add handover receipt columns if missing
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'handover_receipt_file');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN handover_receipt_file VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_assignments' AND COLUMN_NAME = 'handover_receipt_uploaded_at');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE asset_assignments ADD COLUMN handover_receipt_uploaded_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Add employee_id and department_id to users if missing
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'employee_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE users ADD COLUMN employee_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'department_id');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE users ADD COLUMN department_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_company ON asset_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON asset_inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_asset_code ON asset_inventory(asset_code);
CREATE INDEX IF NOT EXISTS idx_assignment_history_inventory ON asset_assignment_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_employee ON asset_assignment_history(employee_id);
