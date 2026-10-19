CREATE TABLE IF NOT EXISTS line_desktop_items (
 batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 item_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT NOT NULL,
 actor_id INT NOT NULL,
 payload_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 metadata_json LONGTEXT NOT NULL,
 receipt_json LONGTEXT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(batch_id,item_id,revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
