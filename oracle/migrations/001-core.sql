-- Aplicada en RAS_APP y verificada. NO REEJECUTAR sobre los mismos objetos.
-- Oracle hace COMMIT implícito del DDL: no ejecutar sobre objetos existentes.
-- No habilita REST automático ni concede acceso anónimo.

CREATE TABLE rc_members (
  member_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identity_issuer VARCHAR2(255 CHAR) NOT NULL,
  identity_subject VARCHAR2(255 CHAR) NOT NULL,
  role_code VARCHAR2(10 CHAR) NOT NULL,
  enabled NUMBER(1) DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT rc_members_identity_uq UNIQUE (identity_issuer, identity_subject),
  CONSTRAINT rc_members_role_ck CHECK (role_code IN ('owner', 'editor', 'viewer')),
  CONSTRAINT rc_members_enabled_ck CHECK (enabled IN (0, 1))
);

CREATE TABLE rc_categories (
  category_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug VARCHAR2(120 CHAR) NOT NULL UNIQUE,
  name VARCHAR2(160 CHAR) NOT NULL,
  sort_order NUMBER DEFAULT 0 NOT NULL
);

CREATE TABLE rc_content (
  content_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_type VARCHAR2(16 CHAR) NOT NULL,
  category_id NUMBER REFERENCES rc_categories(category_id),
  slug VARCHAR2(160 CHAR) NOT NULL UNIQUE,
  title VARCHAR2(240 CHAR) NOT NULL,
  body CLOB,
  attributes_json CLOB DEFAULT '{}' NOT NULL,
  publication_state VARCHAR2(12 CHAR) DEFAULT 'draft' NOT NULL,
  revision NUMBER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT rc_content_type_ck CHECK (content_type IN ('product', 'workshop', 'page')),
  CONSTRAINT rc_content_state_ck CHECK (publication_state IN ('draft', 'published', 'archived')),
  CONSTRAINT rc_content_json_ck CHECK (attributes_json IS JSON),
  CONSTRAINT rc_content_revision_ck CHECK (revision >= 1)
);
CREATE INDEX rc_content_category_ix ON rc_content(category_id);

CREATE TABLE rc_media (
  media_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id NUMBER NOT NULL REFERENCES rc_content(content_id),
  mime_type VARCHAR2(40 CHAR) NOT NULL,
  alt_text VARCHAR2(500 CHAR) NOT NULL,
  byte_length NUMBER NOT NULL,
  sha256_hex VARCHAR2(64 CHAR) NOT NULL,
  image_data BLOB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT rc_media_type_ck CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT rc_media_size_ck CHECK (byte_length BETWEEN 1 AND 5242880)
);
CREATE INDEX rc_media_content_ix ON rc_media(content_id);

CREATE OR REPLACE TRIGGER rc_media_length_guard
BEFORE INSERT OR UPDATE ON rc_media FOR EACH ROW
BEGIN
  IF DBMS_LOB.GETLENGTH(:NEW.image_data) <> :NEW.byte_length THEN
    RAISE_APPLICATION_ERROR(-20001, 'Image length mismatch');
  END IF;
END;
/

CREATE TABLE rc_audit (
  audit_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_member_id NUMBER NOT NULL REFERENCES rc_members(member_id),
  action_code VARCHAR2(80 CHAR) NOT NULL,
  resource_type VARCHAR2(40 CHAR) NOT NULL,
  resource_id VARCHAR2(80 CHAR),
  outcome VARCHAR2(16 CHAR) NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT rc_audit_outcome_ck CHECK (outcome IN ('allowed', 'denied', 'failed'))
);
CREATE INDEX rc_audit_actor_ix ON rc_audit(actor_member_id);
