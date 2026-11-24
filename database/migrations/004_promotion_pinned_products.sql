SET @khuyen_mai_san_pham_manual_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'khuyen_mai_san_pham'
    AND COLUMN_NAME = 'la_chon_thu_cong'
);
SET @khuyen_mai_san_pham_manual_sql = IF(
  @khuyen_mai_san_pham_manual_exists = 0,
  'ALTER TABLE khuyen_mai_san_pham ADD COLUMN la_chon_thu_cong TINYINT(1) NOT NULL DEFAULT 1 AFTER san_pham_id',
  'SET @khuyen_mai_san_pham_manual_noop = 1'
);
PREPARE khuyen_mai_san_pham_manual_stmt FROM @khuyen_mai_san_pham_manual_sql;
EXECUTE khuyen_mai_san_pham_manual_stmt;
DEALLOCATE PREPARE khuyen_mai_san_pham_manual_stmt;

UPDATE khuyen_mai k
SET che_do_chon_sp = CASE
  WHEN EXISTS (
    SELECT 1
    FROM khuyen_mai_san_pham kp
    WHERE kp.khuyen_mai_id = k.id
      AND kp.la_chon_thu_cong = 1
  ) THEN 'THU_CONG'
  ELSE 'NGAU_NHIEN'
END;
