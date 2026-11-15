-- Sólo lectura. Las seis filas de objetos deben tener STATUS = VALID.
SELECT object_name, object_type, status
  FROM user_objects
 WHERE object_name IN ('RC_MEMBERS', 'RC_CATEGORIES', 'RC_CONTENT',
                       'RC_MEDIA', 'RC_AUDIT', 'RC_MEDIA_LENGTH_GUARD')
 ORDER BY object_type, object_name;
-- Debe devolver cero filas.
SELECT name, line, position, text FROM user_errors
 WHERE name = 'RC_MEDIA_LENGTH_GUARD';
-- Debe devolver cero filas.
SELECT table_name, constraint_name, status FROM user_constraints
 WHERE table_name IN ('RC_MEMBERS', 'RC_CATEGORIES', 'RC_CONTENT', 'RC_MEDIA', 'RC_AUDIT')
   AND status <> 'ENABLED';
