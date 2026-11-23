SET @danh_muc_trang_thai_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'danh_muc'
    AND COLUMN_NAME = 'trang_thai'
);
SET @danh_muc_trang_thai_sql = IF(
  @danh_muc_trang_thai_exists = 0,
  'ALTER TABLE danh_muc ADD COLUMN trang_thai TINYINT(1) NOT NULL DEFAULT 1',
  'SET @danh_muc_trang_thai_noop = 1'
);
PREPARE danh_muc_trang_thai_stmt FROM @danh_muc_trang_thai_sql;
EXECUTE danh_muc_trang_thai_stmt;
DEALLOCATE PREPARE danh_muc_trang_thai_stmt;
