-- NUEVO: catálogo publicado y fotos. Pendiente de instalar como RAS_APP.
-- No reemplaza recursos existentes ni genera secretos. DDL confirma implícitamente.
-- Concede dos roles al cliente de servicio existente. Ejecutar manualmente.
DECLARE
  n NUMBER;
  roles owa.vc_arr;
  modules owa.vc_arr;
  patterns owa.vc_arr;
BEGIN
  IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'RAS_APP' THEN RAISE_APPLICATION_ERROR(-20002,'Ejecutar como RAS_APP'); END IF;
  SELECT COUNT(*) INTO n FROM user_objects WHERE object_name='RC_MEDIA_SAVE';
  IF n<>0 THEN RAISE_APPLICATION_ERROR(-20003,'RC_MEDIA_SAVE ya existe: revisar antes de continuar'); END IF;
  SELECT COUNT(*) INTO n FROM user_ords_modules WHERE name IN ('rc.published','rc.media') OR uri_prefix IN ('rc-published/','rc-media/');
  IF n<>0 THEN RAISE_APPLICATION_ERROR(-20003,'Modulo existente: no reemplazar'); END IF;
  SELECT COUNT(*) INTO n FROM user_ords_clients WHERE name='ras-worker-membership';
  IF n<>1 THEN RAISE_APPLICATION_ERROR(-20003,'Verificar cliente OAuth existente'); END IF;
  EXECUTE IMMEDIATE q'~
CREATE PROCEDURE rc_media_save(p_body IN CLOB) AUTHID DEFINER AS
  j JSON_OBJECT_T;
  a JSON_OBJECT_T;
  reply JSON_OBJECT_T := JSON_OBJECT_T();
  issuer_value VARCHAR2(255 CHAR);
  subject_value VARCHAR2(255 CHAR);
  member_value NUMBER;
  role_value VARCHAR2(10);
  content_value NUMBER;
  revision_value NUMBER;
  actual_revision NUMBER;
  media_value NUMBER;
  mime_value VARCHAR2(40);
  alt_value VARCHAR2(500 CHAR);
  length_value NUMBER;
  hash_value VARCHAR2(64);
  origin_value VARCHAR2(255);
  encoded CLOB;
  attributes_value CLOB;
  image_value BLOB;
  piece RAW(32767);
  position_value NUMBER := 1;
  header_value VARCHAR2(32);
  committed_value BOOLEAN := FALSE;
  invalid_input EXCEPTION;
  PROCEDURE respond(status_value VARCHAR2) AS
  BEGIN
    reply.put('status',status_value);owa_util.mime_header('application/json',FALSE);owa_util.http_header_close;htp.prn(reply.to_string());
  END;
BEGIN
  SAVEPOINT rc_media_write;
  IF p_body IS NULL OR DBMS_LOB.GETLENGTH(p_body)>7100000 THEN RAISE invalid_input; END IF;
  j:=JSON_OBJECT_T.parse(p_body);j.on_error(1);
  issuer_value:=j.get_string('actor_issuer');subject_value:=j.get_string('actor_subject');
  BEGIN
    SELECT member_id,role_code INTO member_value,role_value FROM rc_members
      WHERE identity_issuer=issuer_value AND identity_subject=subject_value AND enabled=1 FOR UPDATE;
  EXCEPTION WHEN NO_DATA_FOUND THEN respond('denied');RETURN;
  END;
  IF role_value NOT IN ('owner','editor') THEN ROLLBACK TO rc_media_write;respond('denied');RETURN; END IF;
  content_value:=j.get_number('content_id');revision_value:=j.get_number('revision');
  mime_value:=j.get_string('mime_type');alt_value:=TRIM(j.get_string('alt_text'));
  length_value:=j.get_number('byte_length');hash_value:=j.get_string('sha256_hex');origin_value:=j.get_string('image_origin');
  IF content_value IS NULL OR content_value<1 OR content_value<>TRUNC(content_value)
    OR revision_value IS NULL OR revision_value<1 OR revision_value<>TRUNC(revision_value)
    OR mime_value IS NULL OR mime_value NOT IN ('image/png','image/jpeg','image/webp')
    OR alt_value IS NULL OR length_value IS NULL OR length_value<1 OR length_value>5242880
    OR length_value<>TRUNC(length_value) OR hash_value IS NULL OR NOT REGEXP_LIKE(hash_value,'^[a-f0-9]{64}$','c')
    OR origin_value IS NULL OR origin_value<>'https://ras-creaciones.tienda26.workers.dev' THEN RAISE invalid_input; END IF;
  BEGIN
    SELECT revision,attributes_json INTO actual_revision,attributes_value FROM rc_content WHERE content_id=content_value FOR UPDATE;
  EXCEPTION WHEN NO_DATA_FOUND THEN ROLLBACK TO rc_media_write;respond('conflict');RETURN;
  END;
  IF actual_revision<>revision_value THEN ROLLBACK TO rc_media_write;respond('conflict');RETURN; END IF;
  encoded:=j.get_clob('data_base64');
  IF encoded IS NULL OR DBMS_LOB.GETLENGTH(encoded)>6990508 OR MOD(DBMS_LOB.GETLENGTH(encoded),4)<>0 THEN RAISE invalid_input; END IF;
  DBMS_LOB.CREATETEMPORARY(image_value,TRUE);
  WHILE position_value<=DBMS_LOB.GETLENGTH(encoded) LOOP
    piece:=UTL_ENCODE.BASE64_DECODE(UTL_RAW.CAST_TO_RAW(DBMS_LOB.SUBSTR(encoded,32764,position_value)));
    DBMS_LOB.WRITEAPPEND(image_value,UTL_RAW.LENGTH(piece),piece);position_value:=position_value+32764;
  END LOOP;
  IF DBMS_LOB.GETLENGTH(image_value)<>length_value THEN RAISE invalid_input; END IF;
  header_value:=RAWTOHEX(DBMS_LOB.SUBSTR(image_value,12,1));
  IF (mime_value='image/png' AND SUBSTR(header_value,1,16)<>'89504E470D0A1A0A')
    OR (mime_value='image/jpeg' AND SUBSTR(header_value,1,6)<>'FFD8FF')
    OR (mime_value='image/webp' AND (SUBSTR(header_value,1,8)<>'52494646' OR SUBSTR(header_value,17,8)<>'57454250')) THEN RAISE invalid_input; END IF;
  INSERT INTO rc_media(content_id,mime_type,alt_text,byte_length,sha256_hex,image_data)
    VALUES(content_value,mime_value,alt_value,length_value,hash_value,image_value) RETURNING media_id INTO media_value;
  a:=JSON_OBJECT_T.parse(attributes_value);a.put('image',origin_value||'/media/'||TO_CHAR(media_value));attributes_value:=a.to_clob();
  UPDATE rc_content SET attributes_json=attributes_value,revision=revision+1,updated_at=SYSTIMESTAMP WHERE content_id=content_value;
  INSERT INTO rc_audit(actor_member_id,action_code,resource_type,resource_id,outcome)
    VALUES(member_value,'media:upload','content',TO_CHAR(content_value),'allowed');
  reply.put('media_id',media_value);reply.put('revision',actual_revision+1);
  DBMS_LOB.FREETEMPORARY(image_value);
  COMMIT;committed_value:=TRUE;respond('ok');
EXCEPTION WHEN OTHERS THEN
  IF NOT committed_value THEN ROLLBACK TO rc_media_write; END IF;
  IF DBMS_LOB.ISTEMPORARY(image_value)=1 THEN DBMS_LOB.FREETEMPORARY(image_value); END IF;
  respond('error');
END;
~';
  SELECT COUNT(*) INTO n FROM user_errors WHERE name='RC_MEDIA_SAVE' AND type='PROCEDURE';
  IF n<>0 THEN RAISE_APPLICATION_ERROR(-20004,'Revisar USER_ERRORS antes de continuar'); END IF;
  ORDS.CREATE_ROLE(p_role_name=>'rc.worker.published');
  ORDS.DEFINE_MODULE(p_module_name=>'rc.published',p_base_path=>'rc-published/',p_status=>'NOT_PUBLISHED',p_items_per_page=>100);
  ORDS.DEFINE_TEMPLATE(p_module_name=>'rc.published',p_pattern=>'content');
  ORDS.DEFINE_HANDLER(p_module_name=>'rc.published',p_pattern=>'content',p_method=>'GET',p_source_type=>ORDS.source_type_collection_feed,p_items_per_page=>100,p_source=>q'[
    SELECT c.content_id AS "id",c.content_type AS "type",c.title AS "title",c.slug AS "slug",c.body AS "body",
      c.publication_state AS "state",c.attributes_json AS "attributes",
      (SELECT m.alt_text FROM rc_media m WHERE m.content_id=c.content_id
        AND JSON_VALUE(c.attributes_json,'$.image')='https://ras-creaciones.tienda26.workers.dev/media/'||TO_CHAR(m.media_id)
        FETCH FIRST 1 ROW ONLY) AS "image_alt"
    FROM rc_content c WHERE c.publication_state='published' ORDER BY c.content_id
  ]');
  ORDS.DEFINE_TEMPLATE(p_module_name=>'rc.published',p_pattern=>'media/:id');
  ORDS.DEFINE_HANDLER(p_module_name=>'rc.published',p_pattern=>'media/:id',p_method=>'GET',p_source_type=>ORDS.source_type_media,p_source=>q'[
    SELECT m.mime_type,m.image_data FROM rc_media m JOIN rc_content c ON c.content_id=m.content_id
    WHERE m.media_id=:id AND c.publication_state='published'
      AND JSON_VALUE(c.attributes_json,'$.image')='https://ras-creaciones.tienda26.workers.dev/media/'||TO_CHAR(m.media_id)
  ]');
  roles(1):='rc.worker.published';modules(1):='rc.published';patterns(1):='/rc-published/*';
  ORDS.DEFINE_PRIVILEGE(p_privilege_name=>'rc.published.read',p_roles=>roles,p_modules=>modules,p_patterns=>patterns,p_label=>'Worker published catalog only');
  ORDS_SECURITY.GRANT_CLIENT_ROLE(p_client_name=>'ras-worker-membership',p_role_name=>'rc.worker.published');
  ORDS.PUBLISH_MODULE(p_module_name=>'rc.published',p_status=>'PUBLISHED');
  roles.DELETE;modules.DELETE;patterns.DELETE;
  ORDS.CREATE_ROLE(p_role_name=>'rc.worker.media');
  ORDS.DEFINE_MODULE(p_module_name=>'rc.media',p_base_path=>'rc-media/',p_status=>'NOT_PUBLISHED',p_items_per_page=>100);
  ORDS.DEFINE_TEMPLATE(p_module_name=>'rc.media',p_pattern=>'upload');
  ORDS.DEFINE_HANDLER(p_module_name=>'rc.media',p_pattern=>'upload',p_method=>'POST',p_source_type=>ORDS.source_type_plsql,p_source=>'BEGIN rc_media_save(:body_text); END;');
  ORDS.DEFINE_TEMPLATE(p_module_name=>'rc.media',p_pattern=>'image/:id');
  ORDS.DEFINE_HANDLER(p_module_name=>'rc.media',p_pattern=>'image/:id',p_method=>'GET',p_source_type=>ORDS.source_type_media,p_source=>q'[
    SELECT m.mime_type,m.image_data FROM rc_media m WHERE m.media_id=:id AND EXISTS
      (SELECT 1 FROM rc_members a WHERE a.identity_issuer=:actor_issuer AND a.identity_subject=:actor_subject
        AND a.enabled=1 AND a.role_code IN ('owner','editor','viewer'))
  ]');
  roles(1):='rc.worker.media';modules(1):='rc.media';patterns(1):='/rc-media/*';
  ORDS.DEFINE_PRIVILEGE(p_privilege_name=>'rc.media.manage',p_roles=>roles,p_modules=>modules,p_patterns=>patterns,p_label=>'Worker authorized media');
  ORDS_SECURITY.GRANT_CLIENT_ROLE(p_client_name=>'ras-worker-membership',p_role_name=>'rc.worker.media');
  ORDS.PUBLISH_MODULE(p_module_name=>'rc.media',p_status=>'PUBLISHED');
  COMMIT;
EXCEPTION WHEN OTHERS THEN ROLLBACK;RAISE;
END;
/
SELECT object_name,status FROM user_objects WHERE object_name='RC_MEDIA_SAVE';
SELECT line,position,text FROM user_errors WHERE name='RC_MEDIA_SAVE' ORDER BY sequence;
SELECT name,uri_prefix,status FROM user_ords_modules WHERE name IN ('rc.media','rc.published');
SELECT name FROM user_ords_privileges WHERE name IN ('rc.media.manage','rc.published.read');
