# muestralo-admin — panel del negocio

Panel de administración de cada tenant de **Muéstralo**. Front 100% estático (vanilla JS + IS Web Components por CDN), publicable en GitHub Pages / Cloudflare Pages.

## Funcionalidades

- Catálogo: listado con filtro `QUERY` (búsqueda, categoría, activo), crear/editar productos con variaciones y stock, borrado suave.
- Pedidos: cambio de estado, canal de pago y registro de pagos (monto, método, referencia).
- Pagos: listado filtrable por método/estado.
- Métricas del tenant: visitas, usuarios, pedidos, ingresos, conversión por canal, productos top.
- Apariencia: nombre, WhatsApp, DNS, plantilla y meta del tenant. El CSS de marca es local por app (`css/app.css`), no se edita aquí.

## Uso

Requiere sesión con rol `admin` del tenant (header `x-app`). Sirve estático; el kit de componentes viene de `muestralo-app/cdn` por jsDelivr.
