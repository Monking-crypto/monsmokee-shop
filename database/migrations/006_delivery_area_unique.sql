SET @delivery_area_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'khu_vuc_giao_hang'
    AND INDEX_NAME = 'uq_khu_vuc_giao_hang_dia_chinh'
);
SET @delivery_area_unique_sql = IF(
  @delivery_area_unique_exists = 0,
  'ALTER TABLE khu_vuc_giao_hang ADD UNIQUE KEY uq_khu_vuc_giao_hang_dia_chinh (tinh, quan_huyen, phuong_xa)',
  'SET @delivery_area_unique_noop = 1'
);
PREPARE delivery_area_unique_stmt FROM @delivery_area_unique_sql;
EXECUTE delivery_area_unique_stmt;
DEALLOCATE PREPARE delivery_area_unique_stmt;
