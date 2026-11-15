# Plan de implementación: acceso y preparación Oracle

**Objetivo:** preparar controles comprobables sin modificar aún el servicio de diagnóstico publicado.

**Diseño:** `../specs/2026-11-14-ras-creaciones-admin-design.md`, aprobado. Implementación local por el agente actual.

## Entregables y verificación

- [x] Crear `api/` independiente del HTML público, con pruebas Node y `jose` para validar JWT de Access (firma RS256, emisor, audiencia, vencimiento, identidad).
- [x] Implementar `api/src/access.js`: verificar identidad antes de resolver membresía por emisor + sujeto; roles owner/editor/viewer; denegar usuario ausente, deshabilitado o rol desconocido.
- [x] Implementar `api/src/worker.js`: proteger el diagnóstico por capacidad de lectura; rechazar métodos distintos de GET y rutas desconocidas. Sin endpoints de escritura en esta entrega. Mantener integración Oracle detrás de funciones inyectadas y fallar cerrado si no están conectadas.
- [x] Probar tokens falsificados/vencidos, audiencia/emisor incorrectos, identidades y roles, indisponibilidad de membresías, ausencia de configuración y rechazo de métodos/rutas. 14 pruebas locales pasan.
- [x] Preparar `oracle/preflight.sql` y la migración para miembros, categorías, contenido, imágenes BLOB y auditoría. Tras inspeccionar RAS_APP, se aplicó el DDL autorizado y se conservó en `oracle/migrations/001-core.sql`; cinco tablas y trigger verificados VALID.
- [x] Documentar configuración, fuentes y pasos remotos pendientes en `api/README.md` y `oracle/README.md`.

## Límites

No copiar secretos ni datos de cuentas a pruebas. No crear endpoints ORDS por suposición. No desplegar el nuevo Worker hasta configurar Access, conectar el repositorio de membresías real y comprobar Oracle. La migración DDL requiere inspección del esquema existente; Oracle confirma DDL implícitamente y no se considera reversible mediante ROLLBACK.
