# LLM.md — muestralo-admin

Panel con el que cada negocio administra su tienda. Front estático, vanilla JS,
todo lo visual y todo lo que habla con la API llega del kit por CDN. Este repo
solo tiene composición: si algo es reutilizable, va al kit, no aquí.

## Qué reusar (y de dónde)

| Necesidad | Usa | Dónde vive |
|---|---|---|
| Llamar a la API | `MslCliente` | `muestralo-app/cdn/msl-cliente.js` |
| Listar sin espera en blanco | `MslCliente.<lectura>.vivo(filtro, pintar)` | mismo archivo (caché IndexedDB) |
| Saber si se puede hacer algo | `puede(accion)` / `cargarPermisos()` | mismo archivo |
| Tema claro/oscuro | `aplicarTema()`, `montarControlesTema()` | `cdn/msl-tema.js` |
| Subir imágenes | `<msl-imagen-input>` | `cdn/components/` |
| Cifras de métricas | `<msl-metrica-card>` | `cdn/components/` |
| Acceso | `<msl-auth-form>` | `cdn/components/` |
| Estilos de esos componentes | `msl-kit.css` (lo carga el loader) | `cdn/` |
| Botones, iconos, pestañas, spinner | `is-*` por CDN | is-webcomponents |

`css/admin.css` solo debe tener lo específico del panel (rejilla, barra de
filtros, tablas). Todo estilo de un componente `msl-*` va en `msl-kit.css`.

## Listados con caché

Las secciones del panel usan la variante `.vivo`: la tabla aparece con lo
último conocido y se rehace **solo** si el servidor devuelve algo distinto.
Las mutaciones (crear, editar, borrar, registrar pago) invalidan solas lo que
tocaron, así que tras guardar se ve el dato nuevo, no el viejo.

Contrato SSD local (gitignored): `specs/cache/spec.md`.

## Permisos: nada de roles quemados

El panel se pinta **según el mapa de permisos**, no según el nombre del rol:

```js
const ACC = { productos: "POST:/api/productos", pedidos: "QUERY:/api/pedidos", … };
if (!puede(ACC.pagos)) { /* la pestaña no se dibuja */ }
```

La acción es el id del endpoint (`METHOD:/path`), declarado en
`muestralo-api/src/json/01-api.json` y concedido en base de datos. Si añades
una pestaña, añade su acción a `ACC` y deja que `puede()` decida.

## Entrada

- `?app=slug` fija el tenant de entrada (enlace directo desde la consola matriz).
- Sin `?app=`, el gate pide el slug antes del login.
- La página `/admin/` del sitio de cada empresa carga **este mismo panel** desde
  GitHub Pages con el tenant y la API ya fijados en `localStorage`.
- `window.MSL_CDN` en esa página, si apunta al kit de la tienda, debe ser URL
  **absoluta** (`new URL("../cdn/", location.href)`). Un `../cdn` relativo se
  resuelve contra `muestralo-admin` en Pages y el panel queda en blanco.
- Desarrollador de todas las apps: login con handle de equipo (cuenta en
  `matriz`, rol `DESARROLLADOR`). El gate no debe exigir un usuario espejo en
  el tenant. El mapa `GET /api/permisos` trae `*` y se pintan todas las pestañas.
- `cargarKit()` instala el reportero is-errores (`web-muestralo`).

## Secciones

Catálogo (filtro `QUERY`, alta y edición con variaciones y stock, borrado
suave, uploader a R2), Pedidos (estado, canal de pago, registro de pagos),
Pagos, Métricas del tenant y Apariencia (nombre, WhatsApp, DNS, plantilla,
meta). **No** hay editor de variables CSS: el look es local por app.
Layout del panel: grid en barras/filtros (`adm-barra-*`), vidrio
(`adm-vidrio`), vacíos con icono. `is-select`/`is-input` con `full-width` en
celdas de grid.
Recomendaciones de vitrina: no las cables aquí; el sitio público las pide
solo si el dueño quiere (`QUERY /api/recomendaciones` o ids fijos).

## Post-mortem (panel)

### 1. Chip `contapyme` / paleta huérfana
**Qué pasó.** `is-palette-selector` con paleta localStorage aunque el tenant
no declara paletas.
**Regla.** `montarControlesTema`: sin `paletas.length`, solo theme-toggle.
Quitar `data-palette` del html del admin.

### 2. Editor `css_vars` en Apariencia
**Regla.** Prohibido. CSS = archivo de la app. Ver `muestralo-api/LLM.md` §17.

### 3. Filtros mal alineados (select solo chevron)
**Causa.** `is-select` sin ancho de celda; flex amontonaba a la izquierda.
**Regla.** Barras = CSS grid + `full-width` + grupo `.adm-barra-acciones`
alineado a la fila de controles (no a la etiqueta).

## Calidad

`node /tmp/verifica-js.mjs .` — o el workflow `Verificar JS`, que baja el
verificador de `muestralo-app/scripts/verifica-js.mjs`. Chequea sintaxis **como
módulo ESM**: `node --check` sobre un `.js` parsea como CommonJS y da falsos OK.

## Gobernanza (aplica a los cuatro repos)

- **Commits: autor único `Jeff-Aporta`.** Prohibidos los trailers de coautoría
  (`Co-authored-by:`). El historial refleja autoría individual.
- **Índice de propiedad:** `tests/_propiedad.json` (ignorado por git) lleva
  `author` / `notTouched`. `author` vacío = todo el repo es de Jeff-Aporta.
  Nunca modificar lo listado en `notTouched` sin preguntar primero.
- **Comentarios caveman en español**, una línea, `//`. Prohibidos `/* */` y
  `/** */` multilínea. En CSS los `/* */` también van cortos y sin relleno
  (`/* margen safe-area iOS */`, no una frase explicativa). Regla del corpus
  InSoft `comments-caveman-es`: obligatoria y universal, incluye JSDoc.
- **Cero vestigios legacy:** nada de código comentado ni capas antiguas.
- **Higiene:** lo temporal y de operación vive en carpetas ignoradas
  (`scripts/`, `tests/`, `logs/`).
- **Antes de decidir cómo se hace algo en InSoft, consultar el RAG**
  (`python C:\ContaPyme\RAG\rag.py preguntar "..."`), incluido el dominio
  `guideagents-jeffrey` para preferencias del desarrollador. Citar la ruta que
  devuelva. "No está indexado" es respuesta válida; inventar no lo es.

## Ver también

- `specs/` (gitignored) — contrato SSD local del agente.
- `muestralo-app/LLM.md` — el kit completo y sus convenciones.
- `muestralo-api/LLM.md` — endpoints y permisos SEG.
- `GET /api/LLM.md` — documentación viva de la API.
