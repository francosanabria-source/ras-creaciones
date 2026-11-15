-- Sólo lectura. Ejecutar conectado al esquema de aplicación de Ras.
-- No se leen filas comerciales, contraseñas ni credenciales.
SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS current_schema FROM dual;
SELECT product, version FROM product_component_version;
SELECT table_name FROM user_tables ORDER BY table_name;
SELECT table_name, column_name, data_type, data_length, nullable
  FROM user_tab_columns
 WHERE table_name IN ('RC_MEMBERS', 'RC_CATEGORIES', 'RC_CONTENT', 'RC_MEDIA', 'RC_AUDIT')
 ORDER BY table_name, column_id;
SELECT table_name, constraint_name, constraint_type, status
  FROM user_constraints
 WHERE table_name IN ('RC_MEMBERS', 'RC_CATEGORIES', 'RC_CONTENT', 'RC_MEDIA', 'RC_AUDIT')
 ORDER BY table_name, constraint_name;
