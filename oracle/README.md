# Oracle — preparación para Ras Creaciones

## Estado vigente — 15 de noviembre de 2026

Las cinco tablas RC y el trigger están instalados. El owner habilitado, el registro de bootstrap, `rc.authorization`, `rc.membership.lookup` y el cliente de servicio fueron configurados por el usuario. Su captura de `/session` confirma el rol owner y sus capacidades. Romina sigue pendiente de primer ingreso. Las notas posteriores conservan el relevamiento previo y no reemplazan este estado.

El nuevo archivo `setup/003-admin-content.sql` está preparado, **no ejecutado**. Crea `RC_ADMIN_SAVE` y `rc.admin` bajo `rc-admin/`, protegidos por `rc.content.manage` y el rol `rc.worker.content`. Concede ese rol únicamente al cliente existente `ras-worker-membership`. Esta ampliación permite al Worker consultar contenido/equipo/auditoría y modificar contenido, siempre revalidando el actor en Oracle. No permite gestionar miembros ni escribir directamente desde el navegador.

El procedimiento bloquea la membresía del actor durante el cambio, comprueba rol y habilitación, actualiza sólo si coincide `revision` y registra la auditoría antes del mismo COMMIT. Una revisión vencida devuelve `conflict`; un slug repetido devuelve `duplicate`. La creación no carga automáticamente el catálogo de muestra.

### Aceptación del nuevo servicio, pendiente en Oracle

Primero probar en esquema de ensayo adaptando conscientemente su nombre; el script exige RAS_APP en producción. Verificar las firmas instaladas de ORDS y las cinco tablas. El script no reemplaza objetos y el DDL confirma cambios implícitamente: ante un fallo inspeccionar objetos y módulo creados antes de repetir cualquier operación.

1. Ejecutar el script y comprobar procedimiento VALID, cero filas en USER_ERRORS, módulo publicado y privilegio asociado. No imprimir ni regenerar secretos.
2. Sin OAuth, los tres recursos deben responder 401/403 sin datos. Con OAuth y actor real verificado, la colección debe devolver `{items,hasMore}`. `attributes` puede venir serializado como texto JSON y el adaptador lo interpreta.
3. Crear borrador, editarlo con su revisión y publicar como owner/editor. La revisión aumenta; cada operación confirmada añade exactamente una fila a RC_AUDIT. Repetir la revisión anterior debe devolver conflicto sin cambiar contenido ni añadir auditoría de éxito.
4. Probar slug duplicado y datos inválidos: ningún cambio parcial. Probar actor inexistente, deshabilitado y viewer: sin escritura. Consultas de miembros/auditoría sólo deben devolver filas al owner.
5. Verificar paginación de 100 registros y cuerpos extensos. Las pruebas locales del adaptador usan dobles de red y no acreditan compilación ni serialización reales de ORDS.
6. Mantener `ENABLE_CONTENT_WRITES=false` hasta completar estas pruebas y la instalación del panel protegido. La carga de archivos a RC_MEDIA y la lectura pública del catálogo real todavía no están implementadas.

Referencias para las nuevas definiciones: [ORDS](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.3/orddg/ORDS-reference.html) y [ORDS_SECURITY, concesión de rol al cliente](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.2/orddg/ords_security-pl-sql-package-reference.html).

## Relevamiento y preparación inicial (histórico)

Estado: migración `migrations/001-core.sql` aplicada en RAS_APP. Antes de aplicarla, la consulta a `user_tables` devolvió sólo `DBTOOLS$EXECUTION_HISTORY`. Después, la consulta a `user_objects` confirmó `VALID` para las cinco tablas RC y el trigger `RC_MEDIA_LENGTH_GUARD`. No se crearon membresías ni endpoints REST ni se habilitaron cargas desde la web.

`preflight.sql` sirve para volver a inspeccionar el entorno sin modificar datos. La carpeta `migrations/` conserva el DDL aplicado: no reejecutarlo. No usar credenciales ADMIN en el Worker. Los privilegios y la protección de ORDS siguen pendientes de revisión.

## Modelo propuesto

- `RC_MEMBERS`: identidad estable emisor + sujeto, rol y habilitación.
- `RC_CATEGORIES`: categorías ordenables.
- `RC_CONTENT`: productos, seminarios y páginas con estado de publicación, revisión y atributos JSON. El contrato y las validaciones de esos atributos se definirán con el esquema real y las pantallas; no hay ventas ni pedidos.
- `RC_MEDIA`: imágenes en BLOB dentro de Autonomous, asociadas a contenido, con tipo, tamaño, texto alternativo y hash. Propuesta inicial: JPEG, PNG y WebP hasta 5 MiB por imagen. No aceptar SVG/HTML.
- `RC_AUDIT`: actor, acción, recurso, resultado y fecha; no almacenar JWT, secretos ni el contenido de imágenes.

El límite binario también se verifica mediante trigger. La futura carga deberá comprobar bytes, firma del formato, dimensiones, tamaño descomprimido y hash, no sólo confiar en el MIME enviado por el navegador. El DDL no implementa esas validaciones de aplicación. Servir imágenes publicadas sólo cuando su contenido asociado esté publicado; las imágenes de borradores requieren autorización. No habilitar AutoREST sobre estas tablas.

## Aplicación y verificación pendientes

Oracle confirma DDL implícitamente: preparar copia/esquema de prueba y registrar cada sentencia aplicada; el script no es idempotente y no se debe reejecutar a ciegas. No elimina ni altera tablas existentes. Verificar compilación del trigger y restricciones tras aplicarlo.

La gestión de miembros debe impedir deshabilitar o degradar al último owner y evitar autoconceder roles. Cada cambio de contenido debe comprobar `revision` para detectar ediciones concurrentes y escribir auditoría en la misma transacción. No se han creado todavía los procedimientos ni endpoints ORDS necesarios para estas operaciones.

Antes de habilitar escrituras, comprobar transacciones, rollback de DML, claves foráneas, imagen vacía/sobredimensionada, longitud discordante, borradores no públicos, concurrencia y supervivencia del último owner. Validar también acceso de mínimo privilegio y protección de ORDS desde fuera del Worker.

Fuentes: [CREATE TABLE de Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TABLE.html) y [columnas LOB](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/creating-a-table-with-LOB-columns.html). Contrastar con la versión devuelta por `preflight.sql`.
