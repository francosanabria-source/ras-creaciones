# Panel y migración React — plan de implementación

## Resultado local

Implementados los cinco entregables de código y preparación. 39 pruebas API y 9 de interfaz pasan; ambas salidas web y el bundle Worker compilan. Revisión independiente completada y observaciones corregidas, con regresiones para paginación extensa y respuestas fuera de orden. La auditoría npm de web reporta cero vulnerabilidades.

Pendientes explícitos: revisión visual (herramienta de Chrome bloqueada por no poder verificar URL), compilación y pruebas reales del nuevo SQL en Oracle, instalación de assets/Worker, prueba de Romina y publicación. No se hicieron cambios remotos. El panel permite editar contenido; equipo es consulta sin mutaciones de roles. Catálogo público aún de muestra y carga de imágenes BLOB posterior. Ver README raíz como guía vigente.

Diseño aprobado: `../specs/2026-11-14-ras-creaciones-admin-design.md`.
Ubicación elegida por el usuario: raíz actual en el Escritorio. Trabajar en este checkout, conservando los cambios previos. No publicar ni modificar la instalación remota en esta etapa.

## Entregables

1. `web/`: Vite, React y Bootstrap. Reutilizar exactamente estilos, imágenes, textos y secciones de la demo mediante extracción reproducible desde `index.html` (que se conserva). Componentes React para catálogo, filtros, carrito, favoritos, seminarios, formulario, navegación y diálogos accesibles. Separar salida pública y administrativa.
2. Panel administrativo: sesión real de `/session`, navegación según capacidades, consulta de contenido, formulario de edición y publicación para owner/editor, miembros y auditoría sólo para owner. Estado de carga, sesión vencida, error, lista vacía y cambios sin guardar. Vista previa local de cada rol explícita y excluida de builds de producción.
3. Extender el Worker con rutas `GET /admin/content`, `POST /admin/content`, `GET /admin/members` y `GET /admin/audit`. Comprobar capacidad en servidor antes de consultar Oracle. Cambios de contenido: origen exacto, JSON, límite de tamaño, validación y bandera ENABLE_CONTENT_WRITES. No pedidos ni pagos.
4. Contrato nuevo ORDS bajo `rc-admin/`, preparado como script, sin fingir que ya existe. Consultas limitadas, actor transmitido por el Worker desde JWT verificado, validación de rol en Oracle, revisión optimista y auditoría en la misma transacción del cambio de contenido. El cliente de servicio actual recibe sólo este nuevo privilegio al ejecutar el script autorizado. No conceder escritura directa a tablas ni habilitar AutoREST.
5. Servir el panel y sus assets desde `ras-creaciones-api` mediante binding ASSETS después de autenticar, con API del mismo origen. Mantener el storefront público en el Worker `ras-creaciones`. Evitar CORS con cookies de Access entre dominios.

## Contratos

Contenido: `{id, type: product|workshop|page, title, slug, body, state: draft|published|archived, revision, attributes}`. Atributos: `{category, price, image, description, topics}`. Precios enteros en ARS, imágenes locales del catálogo de muestra o HTTPS, texto sin HTML. Un cambio envía `{id?, revision?, type, title, slug, body, state, attributes}`. La identidad del actor nunca proviene del formulario.

El panel recibe sesión `{role, capabilities}` y colecciones `{items, hasMore}`. Guardar o publicar requiere confirmación HTTP correcta; ante fallo conservar el formulario. No simular un guardado remoto.

## Pruebas

Antes de implementar cada comportamiento, escribir y ejecutar su prueba. Verificar búsqueda con tildes, cantidades/carrito persistido inválido, modal/teclado, formularios, sesión owner/editor/viewer, rechazo de cambios no autorizados, origen inválido, datos inválidos, conflicto de edición y errores Oracle. Compilar ambas salidas, comprobar assets y hacer revisión visual local y revisión de código independiente. Las pruebas ORDS y Access remotas quedan explícitamente pendientes de instalación del nuevo servicio.
