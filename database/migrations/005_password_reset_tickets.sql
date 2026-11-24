CREATE TABLE IF NOT EXISTS dat_lai_mat_khau_ticket (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  email VARCHAR(150) NOT NULL,
  ticket_hash CHAR(64) NOT NULL UNIQUE,
  het_han_luc DATETIME NOT NULL,
  da_dung TINYINT(1) NOT NULL DEFAULT 0,
  tao_luc DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  INDEX idx_reset_ticket_email (email, da_dung, het_han_luc),
  INDEX idx_reset_ticket_user (user_id, da_dung)
) ENGINE=InnoDB;
