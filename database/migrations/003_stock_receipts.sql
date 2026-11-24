SET @phieu_nhap_nha_cung_cap_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'phieu_nhap_kho'
    AND COLUMN_NAME = 'nha_cung_cap'
);
SET @phieu_nhap_nha_cung_cap_sql = IF(
  @phieu_nhap_nha_cung_cap_exists = 0,
  'ALTER TABLE phieu_nhap_kho ADD COLUMN nha_cung_cap VARCHAR(150) NULL AFTER ngay_nhap',
  'SET @phieu_nhap_nha_cung_cap_noop = 1'
);
PREPARE phieu_nhap_nha_cung_cap_stmt FROM @phieu_nhap_nha_cung_cap_sql;
EXECUTE phieu_nhap_nha_cung_cap_stmt;
DEALLOCATE PREPARE phieu_nhap_nha_cung_cap_stmt;

SET @phieu_nhap_trang_thai_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'phieu_nhap_kho'
    AND COLUMN_NAME = 'trang_thai'
);
SET @phieu_nhap_trang_thai_sql = IF(
  @phieu_nhap_trang_thai_exists = 0,
  'ALTER TABLE phieu_nhap_kho ADD COLUMN trang_thai ENUM(''HOAN_THANH'',''DA_HUY'') NOT NULL DEFAULT ''HOAN_THANH''',
  'SET @phieu_nhap_trang_thai_noop = 1'
);
PREPARE phieu_nhap_trang_thai_stmt FROM @phieu_nhap_trang_thai_sql;
EXECUTE phieu_nhap_trang_thai_stmt;
DEALLOCATE PREPARE phieu_nhap_trang_thai_stmt;

SET @chi_tiet_so_lo_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chi_tiet_phieu_nhap'
    AND COLUMN_NAME = 'so_lo'
);
SET @chi_tiet_so_lo_sql = IF(
  @chi_tiet_so_lo_exists = 0,
  'ALTER TABLE chi_tiet_phieu_nhap ADD COLUMN so_lo VARCHAR(100) NULL AFTER han_su_dung',
  'SET @chi_tiet_so_lo_noop = 1'
);
PREPARE chi_tiet_so_lo_stmt FROM @chi_tiet_so_lo_sql;
EXECUTE chi_tiet_so_lo_stmt;
DEALLOCATE PREPARE chi_tiet_so_lo_stmt;
