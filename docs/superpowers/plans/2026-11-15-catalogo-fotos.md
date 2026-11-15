# Catálogo Oracle y fotos — implementación

**Objetivo:** ejecutar la siguiente etapa del diseño aprobado `../specs/2026-11-14-ras-creaciones-admin-design.md`, solicitada expresamente por el usuario: catálogo público publicado y fotografías en Oracle, sin alterar el diseño. Romina pendiente. Sin Notion, pagos ni pedidos reales.

**Arquitectura:** el Worker público conserva sus assets React y consulta un binding interno a un entrypoint de sólo lectura del Worker API. Las credenciales Oracle permanecen exclusivamente en la API; no se copia OAuth al sitio público ni se abre Access administrativo. ORDS nuevo y protegido para contenido publicado, fotos públicas publicadas y fotos privadas. Una portada por contenido; primero guardar contenido y después adjuntar archivo. Archivos JPEG/PNG/WebP hasta 5 MiB y 16 millones de píxeles. No SVG subidos. Validar bytes, dimensiones, MIME y hash; no confiar en extensión. BLOB, revisión y auditoría en transacción.

## Tareas

- [ ] Escribir pruebas de frontera pública: sólo GET, DTO sin datos privados, errores sin catálogo ficticio, paginación y sólo estados publicados en SQL. Implementar `api/src/published.js`, `entry.js`, `public-worker.js` y adaptador Oracle.
- [ ] Escribir pruebas de carga: roles, origen, revisión, tamaño, archivo no imagen y formato discordante. Implementar `api/src/media.js`; guardar vía ORDS con actor verificado y foto binaria codificada en transporte.
- [ ] Preparar `oracle/setup/005-catalog-media.sql`: recursos nuevos protegidos, lectura sólo publicada; procedimiento de carga con actor/rol/revisión, BLOB y auditoría. El usuario ejecutará concesiones de permisos como en 003. No reemplazar objetos instalados.
- [ ] Pruebas UI y conexión React: fetch real, error/reintento, catálogo vacío, productos/seminarios dinámicos conservando clases y secciones actuales; portada y selección de archivo en editor. Mantener muestra sólo en pruebas/vista local explícita. Guardado de portada incrementa revisión; no descartar otros cambios del formulario.
- [ ] Compilar web/API, ejecutar suites, revisión independiente, validar paquetes con Wrangler. Instalar Oracle con usuario, desplegar API, verificar servicio interno y publicar web. Validar rechazo anónimo de ORDS, borradores/fotos privadas no públicos y confirmación del owner de carga/persistencia/publicación.

## Criterios y límites

Sin caché de catálogo/fotos para que despublicar retire acceso inmediatamente. El Worker público sólo puede invocar el entrypoint de catálogo, nunca operaciones administrativas. La consulta vacía se muestra vacía: no importar ni publicar la demo o el borrador de prueba. La foto se guarda explícitamente al cargar, independientemente de otros textos pendientes. Fotos anteriores se conservan en base y no se borran en esta etapa; no prometer almacenamiento ilimitado (cuota actual DATA 100 MB). La validación de dimensiones no equivale a antivirus ni decodificación completa.
