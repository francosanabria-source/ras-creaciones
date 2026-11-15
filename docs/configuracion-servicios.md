# Configuración de servicios de Ras Creaciones

## Catálogo público y fotos — activación en curso

El usuario confirmó que publicó el producto y que aparece en la web pública. Previamente confirmó la carga de una foto, su persistencia en el panel y la exclusión del producto mientras era borrador. No confirmó explícitamente la visualización de la foto en la web pública ni la inaccesibilidad directa de la foto del borrador. Solicitó dejar la revisión de categorías y seminarios para más adelante; actualmente la marca no tiene seminarios. Romina sigue pendiente.

El usuario confirmó que subió una foto a un producto, que siguió visible en el panel tras recargar y que el producto no aparece en la web pública mientras está en borrador. Esto verifica carga y persistencia desde el panel y exclusión del borrador del catálogo. Queda pendiente comprobar directamente la URL pública de la foto del borrador y verificar producto/foto tras publicar contenido real. No publicar el producto de prueba sin indicación. Romina pendiente.

Actualización: el usuario confirmó ejecución correcta de 005. Los tres servicios ORDS de lectura son anónimamente 401. API desplegada versión `777af443-6ecf-4021-a5ef-d3da78a6d492` y web pública versión `e877d742-3e2c-4013-baf2-0cf9e5c902ab`. El endpoint público `/api/catalog` devolvió 200 con colección vacía: la conexión real funciona y el borrador de prueba no aparece. Falta verificar carga real de foto, su persistencia, privacidad de borrador y publicación con el owner. Romina pendiente.

Solicitud posterior del usuario: conectar catálogo público a Oracle manteniendo diseño y habilitar carga/guardado de fotos. Romina explícitamente pendiente. Implementado en local catálogo real React con errores/vacío, entrypoint interno CatalogService de sólo lectura, carga de portada protegida (JPEG/PNG/WebP, 5 MiB, 16M píxeles, revisión/hash/actor/auditoría) y nuevo SQL 005. No copiar credenciales al sitio público ni abrir Access.

46 pruebas API y 13 UI pasan; builds correctos; auditoría npm API sin vulnerabilidades. Revisión independiente sin observaciones críticas/importantes. La validación de fotos comprueba estructura y dimensiones, sin decodificar píxeles completos; se verificó también un WebP real de los activos existentes. Configuraciones de API y público pasan Wrangler dry-run.

API desplegada con panel de fotos y named entrypoint: versión `4fc36bc2-5287-4fa9-9dfe-c0afa4bc9e99`. Todavía no se publicó la web pública nueva. Se solicitó al usuario ejecutar `oracle/setup/005-catalog-media.sql` como RAS_APP; esperando confirmación VALID/sin errores/PUBLISHED. El sondeo previo a la confirmación devolvió 404 para rc-published/content, rc-published/media/1 y rc-media/image/1; no se toma como prueba de autorización ni de instalación. No repetir 005 ante un fallo parcial.

Siguiente: confirmar SQL, verificar rechazo anónimo real, desplegar Worker público con CATALOG enlazado sólo a CatalogService, probar catálogo sin borradores y flujo real de fotos/publicación desde owner. Ver `catalogo-y-fotos.md`. No publicar automáticamente el borrador anterior de conexión ni los datos de muestra. No afirmar guardado de fotos remoto hasta la prueba real del usuario.

## Activación real en curso — 15 de noviembre de 2026

Estado más reciente confirmado por el usuario: `/admin/` muestra Owner y carga el catálogo real. Con `ENABLE_CONTENT_WRITES=true`, versión `e8a86b62-8617-494b-8a6b-a3e5724ae5a0`, realizó la prueba solicitada del borrador «Prueba de conexión», slug `prueba-conexion-owner-20261115`, precio 1000. Confirmó que se guardó, permanece al recargar, permite abrirlo con Editar y aparece en Actividad. Esta confirmación del usuario acredita el recorrido real de owner, guardado persistente y auditoría; no se inspeccionó directamente la fila SQL en esta verificación. No borrar ni publicar el borrador de prueba sin una indicación posterior. La plantilla conserva false por defecto para instalaciones nuevas. Romina y la prueba real de editor siguen pendientes.

Actualización de Oracle: el usuario confirmó instalación correcta de 003. La sesión visible de Database Actions en RAS_APP mostró `RC_ADMIN_SAVE VALID` y `rc.admin /rc-admin/ PUBLISHED`. Se verificaron por HTTPS los tres endpoints sin OAuth: content, members y audit devolvieron 401. La inspección del navegador se detuvo después porque la herramienta no pudo verificar la URL actual; no se intentó evadir ese bloqueo. Se pidió al usuario abrir `/admin/` con su sesión y confirmar Owner/carga antes de activar el guardado. `ENABLE_CONTENT_WRITES` continúa false hasta esa comprobación.

El usuario autorizó conectar el panel a Oracle y probar guardados reales. Autorizó Wrangler desde su navegador; `whoami` confirmó la cuenta esperada. Se inspeccionaron sólo los nombres de los dos secretos Oracle, sin leer valores. El panel y el Worker fueron desplegados juntos con ASSETS, ejecución previa del Worker, HTML sin redirección canónica y `preview_urls=false`. Versión vigente: `bf0217f5-d238-4739-bf59-73ba7de771d7`; anterior a esta activación: `748d1377-3c31-407f-893b-3b7d9cabad46`.

Las peticiones anónimas a `/session`, `/admin/`, `/admin/content` y al JS administrativo devolvieron 302 al login del equipo Access. `ENABLE_CONTENT_WRITES` permanece `false`. Todavía NO se comprobó el nuevo guardado remoto ni el panel con una sesión owner tras este despliegue.

Se solicitó al usuario ejecutar `oracle/setup/003-admin-content.sql` como RAS_APP, porque incluye una concesión de permisos que debe ejecutar manualmente. Esperando resultado: procedimiento VALID, USER_ERRORS sin filas y módulo PUBLISHED. No repetir el script ante fallo parcial. `004-verify-admin.sql` contiene verificaciones de sólo lectura. Después de la confirmación: comprobar lectura autenticada, activar guardados, crear un borrador de prueba con el owner y verificar persistencia y auditoría. La tienda pública no se desplegó.

## Estado vigente — panel React local, 15 de noviembre de 2026

El proyecto completo está en `C:\Users\Administrador\Desktop\tienda-ras-creaciones`, fuera de Tiendas. No guardar este proyecto en Notion. El usuario confirmó con captura que la API desplegada devuelve owner y todas sus capacidades; sustituye las notas históricas de verificación pendiente que siguen debajo.

Se implementaron la tienda React + Bootstrap preservando el original, panel owner/editor, vistas de equipo/auditoría para owner y API administrativa. El nuevo servicio Oracle está preparado en `oracle/setup/003-admin-content.sql`, todavía sin ejecutar. No se desplegó esta ampliación ni se subió a GitHub. Guardados reales, carga BLOB y lectura pública del catálogo Oracle no están activos; Romina sigue pendiente de ingreso/vinculación. Equipo se consulta, sin cambios de roles desde el panel.

Verificación local: 39 pruebas API y 9 de interfaz pasan; compilaciones pública, administrativa y API correctas; auditoría npm de web sin vulnerabilidades reportadas. Revisión independiente realizada y corregida: tamaño de colecciones, selectores CSS de diálogos y respuestas antiguas al navegar. La verificación visual mediante Chrome fue bloqueada por la herramienta al no poder confirmar la URL activa; pendiente. La guía vigente de apertura y activación está en README de la raíz.

## Historial previo

## Actualización — 15 de noviembre de 2026

- Diagnóstico posterior al despliegue: el usuario compartió un registro `oracle-oauth/network-error` asociado a favicon.ico. El código usaba `redirect: error`, que Workers rechaza antes de enviar la petición. Fuente primaria: https://developers.cloudflare.com/workers/runtime-apis/request/. Se reprodujo localmente con un doble de la frontera Fetch de Workers y se corrigió a `manual`; las respuestas 3xx siguen siendo rechazadas por la validación HTTP. 30 pruebas locales pasan. Bundle corregido preparado; la confirmación remota de `/session` sigue pendiente.

- El usuario ejecutó `002-membership-service.sql` y compartió salida correcta: módulo `rc.authorization`, prefijo `/rc-auth/`, estado PUBLISHED y privilegio `rc.membership.lookup` existente. Posteriormente se consultó el recurso de membresía sin credenciales: HTTP 401, sin datos de rol/habilitación. Falta verificar el acceso con el cliente OAuth autorizado.

- El usuario configuró Access para la API y comprobó su ingreso. El dominio de equipo y la audiencia fueron aportados por el usuario; se conservan en `api/wrangler.local.json`, ignorado por Git.
- Tras corregir la cuota DATA de RAS_APP a 100 MB desde ADMIN, el usuario ejecutó el bootstrap y compartió el resultado: una membresía owner habilitada y su registro de auditoría. Esa captura es la evidencia de la vinculación; no se leyó posteriormente la fila por API.
- Romina sigue pendiente de primer ingreso e identidad verificada. No se inventó ni insertó su sujeto.
- Se implementó el adaptador OAuth/ORDS y la ruta de sesión del Worker. 26 pruebas locales pasan y el módulo compilado se generó correctamente. La configuración y la compilación no implican despliegue.
- `oracle/setup/002-membership-service.sql` prepara un NUEVO endpoint de consulta protegido, aún pendiente de ejecutar. El archivo local de creación de cliente OAuth tampoco se ejecutó; no existen credenciales nuevas conocidas por el agente. La versión de ORDS y los privilegios disponibles deben confirmarse al aplicar.
- Pendientes remotos: aplicar servicio protegido, verificar rechazo anónimo, crear cliente OAuth de sólo lectura, guardar sus secretos directamente en Cloudflare, desplegar Worker y verificar `/session` real. El Worker publicado continúa con el diagnóstico original mientras no se despliegue.

El apartado siguiente conserva el relevamiento inicial; esta actualización reemplaza sus estados históricos cuando difieren.

## Estado verificado

- El usuario aprobó el diseño y autorizó configurar Cloudflare y Oracle para datos e imágenes.
- Existe `ras-creaciones` como sitio público en `ras-creaciones.tienda26.workers.dev`.
- Existe `ras-creaciones-api` como Worker de prueba en `ras-creaciones-api.tienda26.workers.dev`. Se verificó su presencia en el panel, no su código ni el contrato de conexión.
- El panel de Cloudflare indica que es necesario configurar Zero Trust antes de exigir Access a Workers.
- Se revisó el código desplegado del Worker (versión visible `391bfe2a`) y se comprobó su conexión de lectura mediante Oracle REST Data Services (ORDS), usando el recurso existente `/ords/ras_app/prueba/estado` en la región São Paulo.
- La consulta pública `GET https://ras-creaciones-api.tienda26.workers.dev/` devolvió HTTP 200 con `{"conexion":true,"resultado":"Conexion correcta"}`. La vista previa del panel devolvió el mismo resultado.
- El Worker hace una petición HTTPS a ORDS con `Accept: application/json`, analiza el JSON y considera exitosa la prueba cuando `datos.items?.[0]?.resultado` es exactamente `Conexion correcta`. Ante respuesta no exitosa de ORDS o excepción devuelve HTTP 502. Por tanto, el resultado observado no es una respuesta de éxito constante del Worker.
- En el código inspeccionado no se envía autenticación hacia ORDS ni se comprueban identidad, rol, método o ruta entrantes. Es un puente de diagnóstico; la prueba no acredita permisos de escritura, almacenamiento de imágenes ni estructura del catálogo. Antes de incorporar esos recursos se deben aplicar los controles del diseño aprobado y revisar la protección de ORDS para evitar acceso directo que omita el Worker.
- Se inspeccionó el esquema RAS_APP: inicialmente sólo figuraba `DBTOOLS$EXECUTION_HISTORY`. Se aplicó la migración `oracle/migrations/001-core.sql`: cinco tablas RC, tres índices explícitos y un trigger. Las cinco tablas y el trigger se verificaron VALID. No se cargaron datos de negocio ni identidades; no se probaron aún validaciones DML ni se modificó el Worker remoto.
- Los dos correos y sus roles fueron confirmados por el usuario. Se guardan en `api/access-members.local.json`, excluido de Git. Falta vincularlos con identidades comprobadas de Access.
- Los controles locales de identidad y roles pasan 14 pruebas; siguen sin despliegue y sin adaptadores Oracle conectados. El servicio publicado conserva su diagnóstico original.

## Acceso acordado

- Franco: `owner`.
- Responsable de la marca: `editor`, que incluye lectura.
- `viewer`: reservado para lectura interna, sin persona asignada inicialmente.
- Los visitantes públicos no tienen roles administrativos.
- Pendiente: confirmar ambos correos. El correo visible de la cuenta Cloudflare no se presume identidad del owner de la aplicación.

## Configuración a ejecutar sobre los recursos existentes

1. Completar el alta de Zero Trust mediante la cuenta del usuario y verificar su dominio de equipo.
2. Configurar una aplicación Access específica para administración y API administrativa con los correos confirmados. Conservar el catálogo público accesible. No activar indiscriminadamente protección sobre todo el Worker público.
3. Validar en el Worker la identidad de Access y la autorización de cada operación. La política de correo de Access permite entrar; el rol de la aplicación define las acciones permitidas.
4. Inspeccionar el Worker de prueba y comprobar su contrato real con Oracle antes de modificarlo.
5. Inspeccionar el esquema Oracle de Ras y preparar una migración revisable de membresías, contenido y auditoría, ajustada al modelo existente.
6. Verificar almacenamiento de imágenes en Oracle. Si el destino es la propia Autonomous Database, preparar un modelo de binarios BLOB y metadatos, con límites de tamaño/tipo, acceso controlado y publicación sólo de imágenes de contenido publicado. Si ya existe Object Storage de Oracle, evaluar su reutilización antes de crear un almacenamiento adicional. Esta elección queda pendiente de la inspección.
7. Probar identidad inválida, miembro deshabilitado, viewer intentando escribir, editor intentando cambiar roles y acceso público a borradores o imágenes privadas.

## Datos necesarios para continuar

- Correo de Franco como owner y correo del editor.
- Sesión de la consola Oracle abierta en la base específica de Ras; no enviar contraseñas, tokens ni wallets por chat.
- Alta inicial de Zero Trust realizada por el usuario. Las herramientas de control de Windows no permiten automatizar cambios en ajustes de seguridad.

Los recursos reales, variables, contratos y migraciones se documentarán después de verificarlos; este documento no establece rutas nuevas de API ni tablas existentes.
