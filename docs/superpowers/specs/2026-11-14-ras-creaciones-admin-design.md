# Ras Creaciones — administración segura y transición gradual

**Estado:** aprobado por el usuario. Autorizó configurar Cloudflare para los usuarios acordados y Oracle para datos e imágenes. La activación depende de verificar los recursos existentes y las identidades concretas.

## Intención

Convertir la demo visual actual de Ras Creaciones en una tienda pública administrable por sus responsables, conservando su identidad gráfica. La evolución será gradual: primero se desacopla la interfaz hacia React con Bootstrap como base de accesibilidad y estructura; después se conecta, de forma controlada, el Worker existente y Oracle Autonomous.

La meta inicial es administrar catálogo, contenido y seminarios. No se habilitan cobros, pedidos reales, inscripciones reales ni el acceso del navegador a Oracle.

## Estado comprobado

- El sitio actual vive en `index.html`, con estilos, datos demostrativos y comportamiento en el mismo archivo.
- Hay ocho productos demostrativos, tres seminarios, carrito local y un formulario que no envía ni guarda datos.
- El repositorio no contiene una aplicación React, configuración de Worker, contrato de API ni esquema de Oracle.
- La publicación actual está en `https://ras-creaciones.tienda26.workers.dev/`, mientras que el README menciona Cloudflare Pages. El destino definitivo debe confirmarse al revisar el Worker de prueba.

## Objetivos

- Preservar la apariencia, el lenguaje visual y el comportamiento público actual durante la migración.
- Separar la interfaz pública en componentes React reutilizables y usar Bootstrap sólo como base de grilla, utilidades, formularios y accesibilidad; la identidad visual seguirá siendo propia.
- Crear una zona administrativa separada de la tienda pública.
- Diseñar autenticación y autorización antes de exponer datos reales o permitir cambios.
- Mantener la comunicación con Oracle exclusivamente del lado del Worker.
- Poder avanzar primero con datos de demostración y reemplazarlos por datos reales después de revisar el contrato autorizado.

## No objetivos

- Checkout, pagos, pedidos o inscripciones reales.
- Cuentas de cliente, historial de compras, direcciones o datos comerciales de compradores.
- Contraseñas propias, secretos de base de datos, claves de Cloudflare o credenciales en Git.
- Inventar rutas, parámetros, tablas o credenciales para el Worker de prueba u Oracle.
- Usar Notion para cualquier aspecto de Ras Creaciones.

## Alternativas consideradas

### 1. Mantener HTML estático y añadir JavaScript administrativo

Reduce el cambio inicial, pero perpetúa un único archivo difícil de administrar, probar y conectar de forma segura. No se eligió.

### 2. React público y administración con autenticación propia

Ofrece control total, pero obligaría a construir y mantener contraseñas, recuperación de acceso, sesiones y defensas de seguridad. No se eligió.

### 3. React gradual, Cloudflare Access y Worker como única frontera de datos

Es la opción elegida. Cloudflare Access autentica al equipo autorizado sin contraseñas propias; el Worker valida la identidad y aplica permisos antes de consultar Oracle. El público permanece separado y sin cuentas durante esta etapa.

## Arquitectura elegida

```text
Visitante público ──> interfaz React pública ──> Worker ──> Oracle Autonomous

Equipo autorizado ──> Cloudflare Access ──> /admin en React ──> Worker ──> Oracle Autonomous
```

El Worker será la única capa que conoce el contrato existente de Oracle y que ejecuta autorización. React nunca recibe credenciales, conexiones directas, secretos ni permisos implícitos por ocultar botones.

La integración concreta se implementará mediante un adaptador de datos dentro del Worker, ajustado únicamente después de relevar el Worker de prueba y el contrato/schema autorizado. Hasta ese momento la interfaz utilizará datos de demostración tipados y no tendrá escrituras reales.

## Identidad, roles y permisos

Cloudflare Access será la puerta de autenticación de la zona administrativa. El Worker validará el token de Access y resolverá una membresía interna usando el identificador estable de la identidad (`issuer` + `subject`); el correo se conserva, si se necesita, sólo como atributo de presentación y no como clave de autorización.

Las membresías estarán habilitadas o deshabilitadas y llevarán un único rol operativo inicial:

| Rol | Persona prevista | Puede hacer |
|---|---|---|
| `owner` | Franco | Administrar miembros y roles, catálogo, contenido y publicación; consultar la auditoría funcional. |
| `editor` | Dueño/a de la marca | Ver y administrar productos, categorías, imágenes, textos y seminarios; publicar o despublicar ese contenido. |
| `viewer` | Persona interna futura, si hiciera falta | Sólo consultar el panel y sus contenidos autorizados. |

`editor` ya incluye las capacidades de lectura de `viewer`; una misma persona no recibe ambos roles. El dueño/a de la marca empezará como `editor`. El cliente público no recibe ninguno de estos roles. Si alguna vez se crean cuentas de compra, pertenecerán a una identidad `customer` completamente separada y fuera de este alcance.

| Capacidad | owner | editor | viewer | visitante público |
|---|:---:|:---:|:---:|:---:|
| Ver catálogo y contenido publicado | Sí | Sí | Sí | Sí |
| Ver borradores y panel | Sí | Sí | Sí | No |
| Crear o editar catálogo, contenidos y seminarios | Sí | Sí | No | No |
| Publicar o despublicar contenido | Sí | Sí | No | No |
| Administrar membresías y roles | Sí | No | No | No |
| Consultar auditoría funcional | Sí | No | No | No |

Los roles de la aplicación no conceden acceso a credenciales, configuración de Cloudflare, despliegues ni Oracle fuera del Worker. Esas responsabilidades se administran fuera de la web.

## Reglas de seguridad

- Cloudflare Access protege la ruta administrativa; el Worker sigue validando token y permisos en cada operación, también ante una llamada directa.
- Cada cambio administrativo autorizado deja un registro de auditoría con actor, acción, recurso, resultado y fecha. No se guardan secretos ni datos sensibles en esa auditoría.
- Todas las operaciones que cambien datos usan validación de entrada, autorización por capacidad y respuestas sin detalles internos.
- Las credenciales se incorporan sólo como secretos/configuración de despliegue; nunca en archivos versionados, respuestas de API ni registros.
- No se activa ninguna mutación contra Oracle hasta revisar y aprobar contrato, esquema, estrategia de conexión y pruebas del Worker de prueba.

## Migración gradual

1. Conservar `index.html` como referencia visual y funcional de la demo.
2. Crear la aplicación React local y trasladar primero la tienda pública usando los mismos datos de demostración y activos extraídos de forma segura.
3. Añadir la zona `/admin` con pantallas de lectura y datos demostrativos, sin integración de datos ni escrituras.
4. Relevar el Worker de prueba, el mecanismo de conexión a Oracle y el contrato autorizado. Decidir el destino de hosting (Workers con assets o Pages + Worker) a partir de esa evidencia.
5. Implementar autenticación con Cloudflare Access, resolución de roles y endpoints de lectura autorizada.
6. Después de validar los controles, habilitar cambios de catálogo/contenido y auditoría funcional; pagos y pedidos continúan excluidos.

## Decisiones que necesita aportar el entorno existente

Antes de las etapas 4 a 6 se requiere acceso autorizado a:

- Código/configuración no secreta del Worker de prueba.
- Contrato existente entre Worker y Oracle, incluido el mecanismo de conexión permitido.
- Esquema relevante y responsable de las tablas de catálogo, contenido y membresías, o aprobación para una migración mínima.
- Configuración de Cloudflare Access y los correos de las dos personas iniciales: Franco como `owner` y el dueño/a de la marca como `editor`.

Hasta tener esa evidencia, ninguna ruta de producción, forma de tabla o mecanismo de conexión se supone ni se implementa.

## Criterios de aceptación de la primera entrega

- La interfaz pública React mantiene el diseño y todas las interacciones demostrativas de la demo.
- No hay secretos ni acceso directo a Oracle desde el cliente.
- `/admin` no es accesible sin identidad autorizada y todas sus capacidades se comprueban en el Worker.
- Franco puede operar como `owner`; el dueño/a de la marca como `editor`; `viewer` sólo lee.
- Los cambios de datos siguen deshabilitados hasta que el contrato del Worker y Oracle quede revisado y probado.
- Los controles y la documentación permanecen dentro de este repositorio.
