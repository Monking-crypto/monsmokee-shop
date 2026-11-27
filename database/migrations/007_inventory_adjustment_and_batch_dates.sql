SET @muc_ton_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'san_pham'
    AND COLUMN_NAME = 'muc_ton_toi_thieu'
);
SET @muc_ton_sql = IF(
  @muc_ton_exists = 0,
  'ALTER TABLE san_pham ADD COLUMN muc_ton_toi_thieu INT NOT NULL DEFAULT 10 AFTER so_luong_ton',
  'SET @muc_ton_noop = 1'
);
PREPARE muc_ton_stmt FROM @muc_ton_sql;
EXECUTE muc_ton_stmt;
DEALLOCATE PREPARE muc_ton_stmt;

SET @chi_tiet_ngay_san_xuat_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chi_tiet_phieu_nhap'
    AND COLUMN_NAME = 'ngay_san_xuat'
);
SET @chi_tiet_ngay_san_xuat_sql = IF(
  @chi_tiet_ngay_san_xuat_exists = 0,
  'ALTER TABLE chi_tiet_phieu_nhap ADD COLUMN ngay_san_xuat DATE NULL',
  'SET @chi_tiet_ngay_san_xuat_noop = 1'
);
PREPARE chi_tiet_ngay_san_xuat_stmt FROM @chi_tiet_ngay_san_xuat_sql;
EXECUTE chi_tiet_ngay_san_xuat_stmt;
DEALLOCATE PREPARE chi_tiet_ngay_san_xuat_stmt;

SET @chi_tiet_han_su_dung_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chi_tiet_phieu_nhap'
    AND COLUMN_NAME = 'han_su_dung'
);
SET @chi_tiet_han_su_dung_sql = IF(
  @chi_tiet_han_su_dung_exists = 0,
  'ALTER TABLE chi_tiet_phieu_nhap ADD COLUMN han_su_dung DATE NULL',
  'SET @chi_tiet_han_su_dung_noop = 1'
);
PREPARE chi_tiet_han_su_dung_stmt FROM @chi_tiet_han_su_dung_sql;
EXECUTE chi_tiet_han_su_dung_stmt;
DEALLOCATE PREPARE chi_tiet_han_su_dung_stmt;

SET @lo_ngay_san_xuat_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lo_hang'
    AND COLUMN_NAME = 'ngay_san_xuat'
);
SET @lo_ngay_san_xuat_sql = IF(
  @lo_ngay_san_xuat_exists = 0,
  'ALTER TABLE lo_hang ADD COLUMN ngay_san_xuat DATE NULL',
  'ALTER TABLE lo_hang MODIFY COLUMN ngay_san_xuat DATE NULL'
);
PREPARE lo_ngay_san_xuat_stmt FROM @lo_ngay_san_xuat_sql;
EXECUTE lo_ngay_san_xuat_stmt;
DEALLOCATE PREPARE lo_ngay_san_xuat_stmt;

SET @lo_han_su_dung_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lo_hang'
    AND COLUMN_NAME = 'han_su_dung'
);
SET @lo_han_su_dung_sql = IF(
  @lo_han_su_dung_exists = 0,
  'ALTER TABLE lo_hang ADD COLUMN han_su_dung DATE NULL',
  'ALTER TABLE lo_hang MODIFY COLUMN han_su_dung DATE NULL'
);
PREPARE lo_han_su_dung_stmt FROM @lo_han_su_dung_sql;
EXECUTE lo_han_su_dung_stmt;
DEALLOCATE PREPARE lo_han_su_dung_stmt;
