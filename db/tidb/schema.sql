-- Applied identically to each of the five TiDB Cloud clusters (A-E) by `npm run tidb:migrate`.
-- Documents are archived as native JSON, keyed by (collection, original Mongo _id).
CREATE TABLE IF NOT EXISTS archived_documents (
  collection  VARCHAR(64)  NOT NULL,
  id          VARCHAR(64)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  archived_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checksum    CHAR(64)     NOT NULL,  -- sha256 of the canonical (sorted-key) JSON, verified on read-back before any delete
  doc         JSON         NOT NULL,
  PRIMARY KEY (collection, id),
  KEY idx_collection_created (collection, created_at)
);
