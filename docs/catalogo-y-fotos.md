# Catálogo real y fotos

Etapa solicitada el 15 de noviembre de 2026. Implementación local y publicación en curso; consultar `configuracion-servicios.md` para el estado remoto confirmado. Romina sigue pendiente.

## Funcionamiento

El navegador público consulta `/api/catalog` y `/media/:id` en el sitio público. Su Worker llama al entrypoint interno `CatalogService` de la API, que sólo admite catálogo publicado y portadas públicas. Access continúa cubriendo toda la URL administrativa; no se agregan excepciones ni se copian secretos al Worker público. Oracle exige OAuth incluso para el servicio que entrega contenido publicado al Worker.

Sólo `publication_state=published` llega al sitio. Borradores/archivados quedan fuera; la portada se publica sólo si su contenido está publicado y sigue siendo su portada actual. Sin caché de catálogo ni fotos para retirar acceso al despublicar. No importar ni publicar la demo automáticamente. Las secciones de marca siguen usando sus activos originales. El carrito y las consultas siguen sin procesar compras, pagos o envíos reales.

## Cargar una portada

1. Crear y guardar el contenido, o editar uno existente.
2. En el editor, seleccionar una foto JPEG/PNG/WebP de hasta 5 MiB y 16 millones de píxeles; dimensiones máximas 8192 por lado. Fotos animadas no admitidas. Agregar una descripción accesible.
3. Revisar la vista previa y pulsar **Subir portada**. La carga guarda inmediatamente el BLOB en RC_MEDIA, cambia la portada del contenido, aumenta su revisión y registra `media:upload` en la misma transacción.
4. Los otros campos que estén modificados en el formulario todavía requieren Guardar borrador/Publicar. No se descartan al subir una foto. Si el contenido estaba publicado, la portada nueva es pública inmediatamente. Los borradores se previsualizan mediante la ruta administrativa protegida.
5. Publicar el contenido para mostrarlo en el catálogo real. Despublicarlo o archivarlo retira también su foto pública.

El Worker comprueba formato real, cabeceras/dimensiones, estructura de contenedor, límites y SHA-256. No usa el nombre del archivo como ruta. No admite SVG/HTML subidos. La inspección estructural no es una decodificación completa de los píxeles; fotos corruptas pueden ser rechazadas por el navegador. La selección muestra vista previa para comprobar su aspecto.

Las fotos anteriores quedan en Oracle y no se eliminan automáticamente. La cuota DATA conocida es 100 MB compartidos con tablas/auditoría, por lo que no es almacenamiento ilimitado. Preferir fotos preparadas para web. No se cambia cuota, facturación ni acceso de usuarios en esta etapa.

## Instalación y pruebas

Nuevo script `oracle/setup/005-catalog-media.sql`: procedimiento RC_MEDIA_SAVE, módulos protegidos rc.published y rc.media y roles concedidos al cliente existente. Debe ejecutarlo el usuario como RAS_APP; ante fallo parcial inspeccionar antes de repetir. Comprobar VALID, USER_ERRORS vacío y ambos módulos PUBLISHED. Los endpoints anónimos deben denegar acceso.

Compilar web y API; desplegar primero la API con `src/entry.js` y luego la web con `web/wrangler.public.json`. El binding CATALOG apunta exclusivamente a `ras-creaciones-api#CatalogService`. La foto se asocia por id/revisión; no permite al cliente elegir su identidad o rol.

Verificar en vivo: catálogo vacío correcto, borrador ausente, foto de borrador no pública, guardado de foto/revisión/auditoría, publicación visible, reemplazo de portada que retira la anterior, archivado que retira producto/foto. Mantener pendiente lo que no se haya probado realmente. El borrador de conexión anterior no debe publicarse como contenido real sin indicación.

Referencias de integración: [entrypoints de Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/), [tipos JSON de Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/21/adjsn/overview-of-pl-sql-object-types-for-json.html).
