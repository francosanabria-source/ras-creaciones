-- NUEVO servicio ORDS. Pendiente de ejecutar como RAS_APP.
-- Protegido por rol antes de publicarse. No genera secretos ni habilita AutoREST.
DECLARE
  l_count NUMBER;
  l_roles owa.vc_arr;
  l_modules owa.vc_arr;
  l_patterns owa.vc_arr;
BEGIN
  IF SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'RAS_APP' THEN
    RAISE_APPLICATION_ERROR(-20002, 'Ejecutar en RAS_APP');
  END IF;
  SELECT COUNT(*) INTO l_count FROM user_ords_modules
   WHERE name = 'rc.authorization' OR uri_prefix = 'rc-auth/';
  IF l_count <> 0 THEN
    RAISE_APPLICATION_ERROR(-20003, 'El modulo ya existe: revisar antes de reemplazar');
  END IF;
  ORDS.CREATE_ROLE(p_role_name => 'rc.worker.membership.read');
  ORDS.DEFINE_MODULE(p_module_name => 'rc.authorization',
    p_base_path => 'rc-auth/', p_status => 'NOT_PUBLISHED', p_items_per_page => 2);
  ORDS.DEFINE_TEMPLATE(p_module_name => 'rc.authorization', p_pattern => 'members/:subject');
  ORDS.DEFINE_HANDLER(p_module_name => 'rc.authorization', p_pattern => 'members/:subject',
    p_method => 'GET', p_source_type => ORDS.source_type_collection_feed,
    p_items_per_page => 2,
    p_source => q'[
      SELECT role_code AS "role", enabled AS "enabled"
        FROM rc_members
       WHERE identity_issuer = :issuer AND identity_subject = :subject
    ]');
  l_roles(1) := 'rc.worker.membership.read';
  l_modules(1) := 'rc.authorization';
  l_patterns(1) := '/rc-auth/*';
  ORDS.DEFINE_PRIVILEGE(p_privilege_name => 'rc.membership.lookup',
    p_roles => l_roles, p_modules => l_modules, p_patterns => l_patterns,
    p_label => 'Worker membership lookup');
  ORDS.PUBLISH_MODULE(p_module_name => 'rc.authorization', p_status => 'PUBLISHED');
  COMMIT;
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  RAISE;
END;
/
SELECT name, uri_prefix, status FROM user_ords_modules WHERE name = 'rc.authorization';
SELECT name FROM user_ords_privileges WHERE name = 'rc.membership.lookup';
