-- PREPARADO, NO INSTALADO. Ejecutar como RAS_APP después de revisar README.md.
-- Crea procedimiento y módulo nuevos. No reemplaza objetos existentes.
-- El DDL hace COMMIT implícito: probar primero en esquema de ensayo.
-- No habilita AutoREST, no genera credenciales y no concede acceso anónimo.
DECLARE
  n NUMBER;
  roles owa.vc_arr;
  modules owa.vc_arr;
  patterns owa.vc_arr;
BEGIN
  IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'RAS_APP' THEN
    RAISE_APPLICATION_ERROR(-20002, 'Ejecutar como RAS_APP');
  END IF;
  SELECT COUNT(*) INTO n FROM user_objects WHERE object_name = 'RC_ADMIN_SAVE';
  IF n <> 0 THEN RAISE_APPLICATION_ERROR(-20003, 'RC_ADMIN_SAVE ya existe: revisar, no reemplazar'); END IF;
  SELECT COUNT(*) INTO n FROM user_ords_modules WHERE name = 'rc.admin' OR uri_prefix = 'rc-admin/';
  IF n <> 0 THEN RAISE_APPLICATION_ERROR(-20003, 'El modulo ya existe: revisar, no reemplazar'); END IF;
  SELECT COUNT(*) INTO n FROM user_ords_clients WHERE name = 'ras-worker-membership';
  IF n <> 1 THEN RAISE_APPLICATION_ERROR(-20003, 'Verificar el cliente OAuth existente'); END IF;

  EXECUTE IMMEDIATE q'~
CREATE PROCEDURE rc_admin_save(p_body IN CLOB) AUTHID DEFINER AS
  j JSON_OBJECT_T;
  a JSON_OBJECT_T;
  topics JSON_ARRAY_T;
  reply JSON_OBJECT_T := JSON_OBJECT_T();
  member_id_value NUMBER;
  role_value VARCHAR2(10);
  issuer_value VARCHAR2(255 CHAR);
  subject_value VARCHAR2(255 CHAR);
  id_value NUMBER;
  revision_value NUMBER;
  next_revision NUMBER;
  type_value VARCHAR2(16);
  state_value VARCHAR2(12);
  title_value VARCHAR2(240 CHAR);
  slug_value VARCHAR2(160 CHAR);
  body_value CLOB;
  attributes_value CLOB;
  price_value NUMBER;
  image_value VARCHAR2(2048 CHAR);
  topic_value VARCHAR2(200 CHAR);
  invalid_input EXCEPTION;
  PROCEDURE respond(status_value VARCHAR2) AS
  BEGIN
    reply.put('status', status_value);
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(reply.to_string());
  END;
BEGIN
  SAVEPOINT rc_admin_write;
  IF p_body IS NULL OR DBMS_LOB.GETLENGTH(p_body) > 32768 THEN RAISE invalid_input; END IF;
  j := JSON_OBJECT_T.parse(p_body);
  j.on_error(1);
  issuer_value := j.get_string('actor_issuer'); subject_value := j.get_string('actor_subject');
  -- Actor proviene exclusivamente del Worker, que valida JWT de Access.
  -- El OAuth de este servicio queda reservado al Worker: nunca al navegador.
  BEGIN
    SELECT member_id, role_code INTO member_id_value, role_value FROM rc_members
    WHERE identity_issuer = issuer_value
      AND identity_subject = subject_value AND enabled = 1
    FOR UPDATE;
  EXCEPTION WHEN NO_DATA_FOUND THEN respond('denied'); RETURN;
  END;
  IF role_value NOT IN ('owner','editor') THEN
    ROLLBACK TO rc_admin_write; respond('denied'); RETURN;
  END IF;
  type_value := j.get_string('type'); state_value := j.get_string('state');
  title_value := TRIM(j.get_string('title')); slug_value := j.get_string('slug');
  body_value := j.get_clob('body');
  IF type_value IS NULL OR type_value NOT IN ('product','workshop','page')
    OR state_value IS NULL OR state_value NOT IN ('draft','published','archived')
    OR title_value IS NULL OR slug_value IS NULL
    OR NOT REGEXP_LIKE(slug_value, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')
    OR DBMS_LOB.GETLENGTH(body_value) > 5000 THEN RAISE invalid_input; END IF;
  a := j.get_object('attributes'); a.on_error(1);
  price_value := a.get_number('price'); image_value := a.get_string('image');
  IF price_value IS NULL OR price_value < 0 OR price_value > 1000000000
    OR price_value <> TRUNC(price_value)
    OR LENGTH(a.get_string('category')) > 120
    OR LENGTH(a.get_string('description')) > 500 THEN RAISE invalid_input; END IF;
  IF image_value IS NOT NULL AND NOT REGEXP_LIKE(image_value, '^https://[^/@[:space:]]+([/:?#]|$)', 'c')
    AND NOT REGEXP_LIKE(image_value, '^/images/[a-f0-9]+\.(png|jpeg|jpg|webp|svg)$', 'c')
    THEN RAISE invalid_input; END IF;
  topics := a.get_array('topics'); topics.on_error(1);
  IF topics.get_size() > 12 THEN RAISE invalid_input; END IF;
  IF topics.get_size() > 0 THEN
    FOR i IN 0 .. topics.get_size()-1 LOOP
      topic_value := TRIM(topics.get_string(i));
      IF topic_value IS NULL THEN RAISE invalid_input; END IF;
    END LOOP;
  END IF;
  attributes_value := a.to_clob();
  IF j.get('id').is_null() THEN
    INSERT INTO rc_content(content_type, slug, title, body, attributes_json, publication_state)
    VALUES(type_value, slug_value, title_value, body_value, attributes_value, state_value)
    RETURNING content_id, revision INTO id_value, next_revision;
  ELSE
    id_value := j.get_number('id'); revision_value := j.get_number('revision');
    IF id_value IS NULL OR id_value < 1 OR id_value <> TRUNC(id_value)
      OR revision_value IS NULL OR revision_value < 1 OR revision_value <> TRUNC(revision_value)
      THEN RAISE invalid_input; END IF;
    UPDATE rc_content SET content_type = type_value, slug = slug_value, title = title_value,
      body = body_value, attributes_json = attributes_value, publication_state = state_value,
      revision = revision + 1, updated_at = SYSTIMESTAMP
    WHERE content_id = id_value AND revision = revision_value
    RETURNING revision INTO next_revision;
    IF SQL%ROWCOUNT <> 1 THEN
      ROLLBACK TO rc_admin_write; respond('conflict'); RETURN;
    END IF;
  END IF;
  INSERT INTO rc_audit(actor_member_id, action_code, resource_type, resource_id, outcome)
  VALUES(member_id_value, 'content:' || state_value, 'content', TO_CHAR(id_value), 'allowed');
  -- Construir respuesta antes de confirmar: errores de serialización revierten DML.
  reply.put('id', id_value); reply.put('revision', next_revision); reply.put('status', 'ok');
  COMMIT;
  respond('ok');
EXCEPTION
  WHEN DUP_VAL_ON_INDEX THEN ROLLBACK TO rc_admin_write; respond('duplicate');
  WHEN invalid_input THEN ROLLBACK TO rc_admin_write; respond('invalid');
  WHEN OTHERS THEN ROLLBACK TO rc_admin_write; respond('error');
END;
~';
  SELECT COUNT(*) INTO n FROM user_errors WHERE name = 'RC_ADMIN_SAVE' AND type = 'PROCEDURE';
  IF n <> 0 THEN RAISE_APPLICATION_ERROR(-20004, 'Revisar USER_ERRORS antes de continuar'); END IF;
  ORDS.CREATE_ROLE(p_role_name => 'rc.worker.content');
  ORDS.DEFINE_MODULE(p_module_name => 'rc.admin', p_base_path => 'rc-admin/',
    p_status => 'NOT_PUBLISHED', p_items_per_page => 100);
  ORDS.DEFINE_TEMPLATE(p_module_name => 'rc.admin', p_pattern => 'content');
  ORDS.DEFINE_HANDLER(p_module_name => 'rc.admin', p_pattern => 'content', p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed, p_items_per_page => 100, p_source => q'[
      SELECT content_id AS "id", content_type AS "type", title AS "title", slug AS "slug",
        body AS "body", publication_state AS "state", revision AS "revision", attributes_json AS "attributes"
      FROM rc_content WHERE EXISTS (SELECT 1 FROM rc_members
        WHERE identity_issuer = :actor_issuer AND identity_subject = :actor_subject
          AND enabled = 1 AND role_code IN ('owner','editor','viewer'))
      ORDER BY updated_at DESC, content_id DESC
    ]');
  ORDS.DEFINE_HANDLER(p_module_name => 'rc.admin', p_pattern => 'content', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source => 'BEGIN rc_admin_save(:body_text); END;');
  ORDS.DEFINE_TEMPLATE(p_module_name => 'rc.admin', p_pattern => 'members');
  ORDS.DEFINE_HANDLER(p_module_name => 'rc.admin', p_pattern => 'members', p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed, p_items_per_page => 100, p_source => q'[
      SELECT member_id AS "id", identity_subject AS "subject", role_code AS "role", enabled AS "enabled"
      FROM rc_members WHERE EXISTS (SELECT 1 FROM rc_members actor
        WHERE actor.identity_issuer = :actor_issuer AND actor.identity_subject = :actor_subject
          AND actor.enabled = 1 AND actor.role_code = 'owner')
      ORDER BY member_id
    ]');
  ORDS.DEFINE_TEMPLATE(p_module_name => 'rc.admin', p_pattern => 'audit');
  ORDS.DEFINE_HANDLER(p_module_name => 'rc.admin', p_pattern => 'audit', p_method => 'GET',
    p_source_type => ORDS.source_type_collection_feed, p_items_per_page => 100, p_source => q'[
      SELECT audit_id AS "id", action_code AS "action", resource_type AS "resource",
        resource_id AS "resource_id", outcome AS "outcome",
        TO_CHAR(occurred_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS "occurred_at"
      FROM rc_audit WHERE EXISTS (SELECT 1 FROM rc_members actor
        WHERE actor.identity_issuer = :actor_issuer AND actor.identity_subject = :actor_subject
          AND actor.enabled = 1 AND actor.role_code = 'owner')
      ORDER BY occurred_at DESC, audit_id DESC
    ]');
  roles(1) := 'rc.worker.content'; modules(1) := 'rc.admin'; patterns(1) := '/rc-admin/*';
  ORDS.DEFINE_PRIVILEGE(p_privilege_name => 'rc.content.manage', p_roles => roles,
    p_modules => modules, p_patterns => patterns, p_label => 'Worker administrative content');
  -- Ampliación concreta del cliente de servicio existente: no modifica sus secretos.
  ORDS_SECURITY.GRANT_CLIENT_ROLE(p_client_name => 'ras-worker-membership', p_role_name => 'rc.worker.content');
  ORDS.PUBLISH_MODULE(p_module_name => 'rc.admin', p_status => 'PUBLISHED');
  COMMIT;
EXCEPTION WHEN OTHERS THEN ROLLBACK; RAISE;
END;
/
SELECT object_name, status FROM user_objects WHERE object_name = 'RC_ADMIN_SAVE';
SELECT line, position, text FROM user_errors WHERE name = 'RC_ADMIN_SAVE' ORDER BY sequence;
SELECT name, uri_prefix, status FROM user_ords_modules WHERE name = 'rc.admin';
SELECT name FROM user_ords_privileges WHERE name = 'rc.content.manage';
