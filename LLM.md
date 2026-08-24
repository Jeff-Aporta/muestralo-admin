# LLM.md — muestralo-admin

Panel con el que cada negocio administra su tienda. Front estático, vanilla JS,
todo lo visual y todo lo que habla con la API llega del kit por CDN. Este repo
solo tiene composición: si algo es reutilizable, va al kit, no aquí.

## Qué reusar (y de dónde)

| Necesidad | Usa | Dónde vive |
|---|---|---|
| Llamar a la API | `MslCliente` | `muestralo-app/cdn/msl-cliente.js` |
| Saber si se puede hacer algo | `puede(accion)` / `cargarPermisos()` | mismo archivo |
| Tema y paleta del tenant | `aplicarTema()`, `montarControlesTema()` | `cdn/msl-tema.js` |
| Subir imágenes | `<msl-imagen-input>` | `cdn/components/` |
| Cifras de métricas | `<msl-metrica-card>` | `cdn/components/` |
| Acceso | `<msl-auth-form>` | `cdn/components/` |
| Estilos de esos componentes | `msl-kit.css` (lo carga el loader) | `cdn/` |
| Botones, iconos, pestañas, spinner | `is-*` por CDN | is-webcomponents |

`css/admin.css` solo debe tener lo específico del panel (rejilla, barra de
filtros, tablas). Todo estilo de un componente `msl-*` va en `msl-kit.css`.

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

## Secciones

Catálogo (filtro `QUERY`, alta y edición con variaciones y stock, borrado
suave, uploader a R2), Pedidos (estado, canal de pago, registro de pagos),
Pagos, Métricas del tenant y Apariencia (variables e identidad).

## Calidad

`node /tmp/verifica-js.mjs .` — o el workflow `Verificar JS`, que baja el
verificador de `muestralo-app/scripts/verifica-js.mjs`. Chequea sintaxis **como
módulo ESM**: `node --check` sobre un `.js` parsea como CommonJS y da falsos OK.

## Ver también

- `muestralo-app/LLM.md` — el kit completo y sus convenciones.
- `muestralo-api/LLM.md` — endpoints y permisos SEG.
- `GET /api/LLM.md` — documentación viva de la API.
