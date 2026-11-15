# Controles de ras-creaciones-api — preparación local

## Estado vigente — 15 de noviembre de 2026

El usuario confirmó en producción `/session` con owner y sus cinco capacidades. El diagnóstico y la consulta de membresías funcionan según sus capturas. Los apartados de instalación siguientes son históricos: no volver a crear el servicio de membresías ni sus secretos.

La implementación **nueva, local y sin desplegar** añade el panel en `/admin/` y cuatro rutas: `GET /admin/content`, `POST /admin/content`, `GET /admin/members`, `GET /admin/audit`. Requieren JWT válido, membresía Oracle habilitada y capacidad específica. Sólo owner puede consultar miembros/auditoría; owner/editor pueden cambiar contenido. Viewer sólo lee. Ninguna ruta permite cambiar roles.

El guardado requiere `ENABLE_CONTENT_WRITES=true`, origen exacto, JSON de hasta 32 KiB y datos válidos. Transmite el actor del JWT, nunca uno enviado por el cliente. Conflictos y slugs repetidos devuelven 409. Oracle vuelve a comprobar la membresía y confirma contenido/auditoría juntos mediante el nuevo servicio pendiente `../oracle/setup/003-admin-content.sql`.

`wrangler.example.json` es una plantilla sin credenciales; `wrangler.local.json` contiene la configuración local no secreta. El binding ASSETS apunta a `../web/dist-admin` con `run_worker_first: true` para autenticar también HTML, JS e imágenes. Mantener Access para todo el tráfico. Compilar antes ambas aplicaciones con `npm run build` en web y después en api. Para instalar el panel se necesitan tanto assets como Worker; pegar sólo el bundle ya no lo instala.

No se hizo despliegue de esta ampliación ni se instaló el nuevo script. Las escrituras están deshabilitadas por defecto. Ver README de la raíz para la secuencia vigente. 39 pruebas locales de API pasan; faltan las pruebas reales del nuevo contrato ORDS y del panel publicado.

La configuración administrativa usa `html_handling: none`: el Worker solicita `/index.html` al binding sin una redirección canónica hacia `/`, que es la ruta de diagnóstico. Esta conducta del binding está documentada en [HTML handling de Cloudflare](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).

## Preparación e instalación anterior (histórico)

Estado: integración Oracle implementada y compilada localmente; NO desplegada. El diagnóstico remoto existente sigue sin cambios. Las pruebas usan firmas JWT reales y dobles de red para Oracle; no acreditan aún la conexión remota de membresías.

## Pruebas

Con Node 22 o posterior: `npm ci --ignore-scripts` y `npm test` dentro de `api/`.

Se usa `jose` para validar firmas JWT RS256, emisor, audiencia, expiración y sujeto. La URL de certificados proviene exclusivamente del dominio de equipo configurado, nunca de un token recibido. Los certificados se mantienen en caché por el verificador y permiten rotación de claves.

## Configuración pendiente

- `ACCESS_ISSUER`: origen HTTPS exacto del equipo Cloudflare Access, sin barra final.
- `ACCESS_AUD`: audiencia de la aplicación Access que protegerá la API.
- `ORACLE_BASE_URL`: URL HTTPS del esquema ORDS existente, terminada en `/ords/ras_app/`.
- `ORACLE_CLIENT_ID` y `ORACLE_CLIENT_SECRET`: secretos exclusivos de servidor obtenidos del cliente OAuth de lectura de membresías.
- `src/oracle.js` implementa el diagnóstico existente y `findMember({ issuer, subject })`, que convierte NUMBER(1) a booleano. Consulta la membresía en cada petición; sólo conserva en memoria el token OAuth hasta su vencimiento, con renovación limitada.

La exportación predeterminada conecta validación de Access, lectura de membresías y diagnóstico a través de `createRuntime`. La ruta `GET /session` devuelve únicamente el rol de Oracle y sus capacidades; no expone tokens ni credenciales. La ruta raíz conserva el diagnóstico, ahora sujeto a autenticación y membresía habilitada. No hay rutas de escritura. El archivo local `access-members.local.json`, ignorado por Git, contiene los correos autorizados por el usuario; no sustituye Oracle.

## Secuencia de instalación pendiente

1. En RAS_APP, ejecutar `../oracle/setup/002-membership-service.sql`. Es un servicio NUEVO, aún no instalado: módulo `rc.authorization`, base `rc-auth/`, sólo GET, con privilegio específico. Protege el módulo antes de publicarlo. Si ya existe, se detiene para no sobrescribirlo.
2. Probar el endpoint de consulta de membresías sin autenticación: debe denegar acceso (no devolver filas ni un JSON de membresía). Que el diagnóstico `/prueba/estado` sea accesible no constituye esa comprobación.
3. En RAS_APP, ejecutar el archivo local `../oracle/setup-oauth-client.local.sql`. Requiere las firmas modernas de ORDS_SECURITY documentadas en 25.2; si la base informa incompatibilidad, inspeccionar la versión y las firmas instaladas antes de adaptar. La salida genera un CLIENT_ID y un CLIENT_SECRET: copiarlos directamente a secretos de Cloudflare con nombres `ORACLE_CLIENT_ID` y `ORACLE_CLIENT_SECRET`. No enviar la salida al chat, guardarla en Git ni tomar capturas. El cliente sólo recibe el rol `rc.worker.membership.read`, no un rol de administración de Oracle.
4. Revisar la configuración no secreta de `wrangler.local.json`, ya preparada con los valores aportados por el usuario. En el panel del Worker, esos mismos tres valores son variables: ACCESS_ISSUER, ACCESS_AUD y ORACLE_BASE_URL. Conservar la protección Access existente para todo el tráfico de este Worker.
5. Ejecutar `npm run build`. El resultado `dist/worker.mjs` es un módulo único para desplegar mediante el editor de Cloudflare; no contiene los valores de secretos ni credenciales. No copiar únicamente `src/worker.js` al editor: requiere sus imports. Alternativamente, con Wrangler instalado y autenticado, usar la configuración local explícita.
6. Desplegar sólo después de configurar servicio, credenciales y protección. Comprobar `/session` desde la sesión autorizada: debe mostrar `role: owner`. Sin sesión debe intervenir Access; una identidad válida no registrada debe recibir 403, y fallas de Oracle deben dar 503. Las pruebas remotas siguen pendientes.

Si la creación de cliente o su secreto falla después de registrar parcialmente el cliente, no reejecutar para rotarlo a ciegas: inspeccionar la etapa completada. Las APIs de secretos pueden confirmar cambios independientemente de la transacción.

Fuentes Oracle: [ORDS (módulos y privilegios)](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.2/orddg/ORDS-reference.html), [ORDS_SECURITY](https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/25.2/orddg/ords_security-pl-sql-package-reference.html).

## Diagnóstico de una respuesta 503

La respuesta pública conserva `Servicio no disponible`. En los registros del Worker se emite `RAS_API_DIAGNOSTIC` con etiquetas controladas de etapa, motivo y, si corresponde, estado HTTP. Nunca se registra URL, cuerpo de respuesta, credenciales, tokens ni identidad.

- `configuration`: base Oracle inválida o falta de credenciales en el entorno.
- `access-configuration`: emisor o audiencia ausentes/inválidos.
- `oracle-oauth`: falla la obtención del token de servicio.
- `oracle-membership`: falla la consulta del miembro o la forma de su respuesta.
- `oracle-diagnostic`: falla el diagnóstico original.

Para observar un fallo real, desplegar el bundle actualizado, abrir los registros en vivo y luego invocar `/session` desde la sesión del usuario. No regenerar secretos ni modificar permisos basándose únicamente en el 503: usar la etapa y el estado HTTP para identificar primero el componente afectado.

Compatibilidad Fetch: las peticiones a Oracle usan `redirect: manual`. Workers no implementa `redirect: error` (Node sí lo acepta). El modo manual no sigue redirecciones: la respuesta 3xx se rechaza antes de consumir sus datos, sin enviar credenciales a otro destino. Las pruebas de frontera comprueban el modo soportado y ese rechazo. Fuente: https://developers.cloudflare.com/workers/runtime-apis/request/.

## Activación remota

1. Completar el alta de Zero Trust y crear una aplicación Access para la API administrativa con los dos correos autorizados. Conservar pública la web `ras-creaciones`.
2. Obtener emisor y audiencia del panel; verificar el inicio de sesión de cada persona.
3. Registrar emisor + sujeto comprobados con su rol en Oracle. No tomar sujeto/rol de formularios, cabeceras de correo ni valores inventados. La asignación inicial se hace fuera de la web mediante una operación administrativa controlada.
4. Revisar y proteger ORDS para que la base no sea accesible directamente omitiendo el control del Worker. El endpoint de prueba actual no acredita protección de datos comerciales.
5. Conectar adaptadores al contrato Oracle inspeccionado y probar en una versión de prueba protegida. Sin configuración completa, no reemplazar el Worker activo.
6. Probar llamadas directas sin Access, usuario deshabilitado y cada rol desde la aplicación real. El estado local de permisos es sólo una parte de la aceptación.

Todo cambio futuro debe seleccionar una capacidad concreta (`content:write`, `content:publish`, `members:manage`) después de autenticar y antes de tocar datos. Las escrituras requerirán además origen permitido/defensa CSRF, validación y auditoría en la misma transacción; hoy están rechazadas.

Fuente: [validación de JWT de Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
