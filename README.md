# Ras Creaciones

Proyecto local en `C:\Users\Administrador\Desktop\tienda-ras-creaciones`. No guardar información de este proyecto en Notion. El panel y su nuevo servicio Oracle están instalados. El usuario confirmó acceso Owner, lectura, guardado real de un borrador, persistencia al recargar y registro en Actividad. No se publicó la tienda React ni se subió código a GitHub. Estado detallado en `docs/configuracion-servicios.md`.

## Estado actual — 15 de noviembre de 2026

- `web/`: tienda pública migrada a React + Bootstrap, con los estilos, imágenes y secciones originales. Conserva catálogo de muestra, búsqueda, filtros, favoritos, carrito local y consultas ilustrativas. No procesa ventas, pagos ni pedidos.
- Panel: resumen, productos, seminarios y páginas; formularios para crear, guardar borradores, publicar y archivar. Owner y editor tienen acceso de edición; sólo owner ve equipo y actividad. Viewer es lectura interna, no un cliente comprador.
- El panel de producción consume `/session` y `/admin/*` en su mismo origen, con permisos comprobados en el Worker y membresía en Oracle. La vista previa local utiliza datos de muestra explícitos.
- La sesión owner en la API actual fue confirmada por captura del usuario. Romina tiene pendiente su primer ingreso y vinculación de identidad en Oracle.
- El nuevo servicio administrativo Oracle está preparado en `oracle/setup/003-admin-content.sql`, todavía sin instalar ni probar en la base. Las nuevas escrituras permanecen deshabilitadas por defecto.
- La tienda React todavía usa el catálogo de muestra: publicar contenido en Oracle no lo muestra automáticamente en la web pública. La consulta pública del catálogo real, las cargas de imágenes BLOB y los cambios de roles desde el panel quedan para una siguiente etapa.

`index.html` conserva la demo original sin modificaciones. La extracción reproducible vive en `web/scripts/extract-legacy.mjs`; genera secciones, estilos, catálogo e imágenes locales sin cambiar el original.

## Vista previa local

Con Node 22.12 o posterior, desde PowerShell:

```powershell
Set-Location C:\Users\Administrador\Desktop\tienda-ras-creaciones\web
npm ci
npm run dev
```

Abrir la dirección local que indique Vite:

- `/`: tienda React.
- `/admin/?preview=owner`: panel de ejemplo como owner.
- `/admin/?preview=editor`: panel de ejemplo como editor.
- `/admin/?preview=viewer`: lectura interna de ejemplo.

La vista previa no llama ni modifica Oracle y sus cambios se pierden al recargar. Sólo existe en desarrollo y su adaptador se excluye de los archivos de producción. `/admin/` sin ese parámetro necesita una sesión real y las rutas de la API; Vite por sí solo no reemplaza Cloudflare Access.

## Verificación y compilación

```powershell
Set-Location C:\Users\Administrador\Desktop\tienda-ras-creaciones\web
npm test
npm run build
Set-Location ..\api
npm ci
npm test
npm run build
```

Se generan `web/dist` (tienda pública), `web/dist-admin` (panel protegido) y `api/dist/worker.mjs` (API). Las pruebas usan red simulada; no certifican el nuevo servicio remoto. Se verificaron 9 pruebas de interfaz y 39 de API, compilaciones correctas y auditoría npm de web sin vulnerabilidades reportadas. La revisión visual en Chrome quedó pendiente por un bloqueo de la herramienta de control del navegador.

## Activación futura, todavía pendiente

1. Revisar y ejecutar el nuevo script `oracle/setup/003-admin-content.sql` como RAS_APP, primero en un entorno de ensayo. Verificar `USER_ERRORS` vacío y procedimiento VALID. El script crea recursos nuevos y amplía el cliente OAuth existente con `rc.worker.content`; no genera secretos. No reejecutar si se creó parcialmente.
2. Probar que `rc-admin/content`, `members` y `audit` rechacen acceso anónimo. Verificar lectura autenticada, escritura owner/editor, rechazo viewer, conflicto de revisión y auditoría junto al cambio. Ver el procedimiento de aceptación en `oracle/README.md`.
3. Publicar los assets administrativos junto al Worker usando `api/wrangler.local.json`. Conservar `ASSETS`, `run_worker_first: true`, Access para todo el tráfico y los secretos existentes. Copiar solamente el JS al editor remoto ya no alcanza para instalar el panel.
4. Verificar sesión, panel, assets y lectura con `ENABLE_CONTENT_WRITES=false`; después de las pruebas habilitarlo explícitamente como `true`. Es una variable de configuración, no un secreto. `ORACLE_CLIENT_ID` y `ORACLE_CLIENT_SECRET` sí son secretos exclusivos de servidor.
5. Publicar la tienda pública desde `web/dist`, usando `web/wrangler.public.json`, después de revisar visualmente la migración. Nunca publicar la raíz completa del repositorio: contiene material de trabajo y SQL.

No se ejecutó ninguna de estas operaciones remotas durante esta implementación. No se incluyen contraseñas ni credenciales en los archivos de la web o en Git.
