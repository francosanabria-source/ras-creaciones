-- Sólo lectura. Ejecutar como RAS_APP después de 003-admin-content.sql.
-- No muestra secretos ni genera credenciales.
SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS usuario_actual FROM dual;
SELECT object_name, status FROM user_objects WHERE object_name = 'RC_ADMIN_SAVE';
SELECT line, position, text FROM user_errors WHERE name = 'RC_ADMIN_SAVE' ORDER BY sequence;
SELECT name, uri_prefix, status FROM user_ords_modules WHERE name = 'rc.admin';
SELECT name FROM user_ords_privileges WHERE name = 'rc.content.manage';
SELECT role_code, enabled, COUNT(*) AS miembros FROM rc_members GROUP BY role_code, enabled;
-- Después de guardar un borrador desde el panel: verificar revisión y auditoría.
SELECT content_id, title, publication_state, revision, updated_at
FROM rc_content ORDER BY updated_at DESC FETCH FIRST 10 ROWS ONLY;
SELECT audit_id, action_code, resource_type, resource_id, outcome, occurred_at
FROM rc_audit ORDER BY occurred_at DESC FETCH FIRST 10 ROWS ONLY;
