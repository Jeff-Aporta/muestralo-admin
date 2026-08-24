// Panel admin Muéstralo: todo el render vive aquí.
const KIT = String(window.MSL_CDN || "https://cdn.jsdelivr.net/gh/Jeff-Aporta/muestralo-app@main/cdn").replace(/\/+$/, "");
const { cargarKit } = await import(`${KIT}/msl-loader.js`);
const { MslCliente, puede, cargarPermisos } = await import(`${KIT}/msl-cliente.js`);
const { aplicarTema, montarControlesTema, dinero } = await import(`${KIT}/msl-tema.js`);

// ------------------------------------------------------------- utilidades

// Query corto.
const $ = (sel, raiz = document) => raiz.querySelector(sel);

// Escapa HTML de datos de la API.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Pesos a centavos.
const aCentavos = (txt) => Math.round(Number(String(txt).replace(",", ".")) * 100) || 0;

// Lee JSON de textarea con error claro.
const leerJson = (txt, nombre) => {
  const limpio = String(txt || "").trim();
  if (!limpio) return {};
  try { return JSON.parse(limpio); } catch { throw new Error(`${nombre}: JSON inválido`); }
};

// Muestra error en la zona dada.
const mostrarError = (zona, e) => {
  const el = $(zona);
  if (el) el.innerHTML = `<p class="msl-error">${esc(e.message || e)}</p>`;
};

// Muestra ok fugaz en la zona dada.
const mostrarOk = (zona, msg) => {
  const el = $(zona);
  if (el) el.innerHTML = `<p class="adm-ok">${esc(msg)}</p>`;
};

// ---------------------------------------------------------------- estado

const ESTADOS_PEDIDO = ["pendiente_pago", "pagado", "entregado", "cancelado"];
const METODOS_PAGO = ["whatsapp_manual", "wompi"];

const TABS = [
  ["catalogo", "mdi:package-variant", "Catálogo"],
  ["pedidos", "mdi:receipt-text", "Pedidos"],
  ["pagos", "mdi:cash-multiple", "Pagos"],
  ["metricas", "mdi:chart-box", "Métricas"],
  ["apariencia", "mdi:palette", "Apariencia"],
];

// Config del tenant en memoria (paletas de marca para los controles de tema).
const estado = { cfg: null };

const ui = {
  tab: "catalogo",
  prod: { search: "", activo: "1", categoria: "", sort: "id", desc: false, offset: 0, limit: 20 },
  editando: null, // producto en edición; {} = nuevo
  pedEstado: "",
  pago: { metodo: "", estado: "" },
};

// ------------------------------------------------------------------- boot

// Acción SEG = id del endpoint. El admin se pinta según permisos, no roles.
const ACC = {
  productos: "POST:/api/productos",
  pedidos: "QUERY:/api/pedidos",
  pagos: "QUERY:/api/pagos",
  metricas: "QUERY:/api/metricas",
  config: "PUT:/api/config",
  archivos: "POST:/api/archivos",
};

async function boot() {
  // ?app=slug fija el tenant de entrada (enlace directo desde la consola matriz).
  const appUrl = new URLSearchParams(location.search).get("app");
  if (appUrl) MslCliente.configurar({ app: appUrl.trim() });
  await cargarKit();
  // Identidad del tenant: paleta de marca + claro/oscuro, como en su tienda.
  estado.cfg = await aplicarTema();
  if (!MslCliente.token) return pintarGate();
  await cargarPermisos();
  if (!TABS.some(([id]) => puede(ACC[id]))) {
    MslCliente.logout();
    return pintarGate("Esta cuenta no administra este tenant.");
  }
  pintarShell();
}

// -------------------------------------------------------------- gate auth

// Sin token: selector de tenant + form de acceso.
function pintarGate(aviso = "") {
  $("#raiz").innerHTML = `
    <div class="adm-gate">
      <div id="adm-tema" class="adm-tema-bar"></div>
      <h1>Admin Muéstralo</h1>
      <is-input id="gate-app" label="App a administrar" value="${esc(MslCliente.app)}"
        placeholder="slug del tenant, ej: demo"></is-input>
      <msl-auth-form></msl-auth-form>
      <div id="gate-aviso">${aviso ? `<p class="msl-error">${esc(aviso)}</p>` : ""}</div>
    </div>`;
  montarControlesTema($("#adm-tema"), estado.cfg?.paletas || []);
  // El tenant se fija ANTES de cualquier login/registro del form.
  $("#gate-app").addEventListener("input", (e) => {
    const app = String(e.target.value ?? "").trim();
    if (app) MslCliente.configurar({ app });
  });
  $("#raiz").addEventListener("msl-login", () => {
    // El login ya trajo el mapa de permisos: si no administra nada, fuera.
    if (!TABS.some(([id]) => puede(ACC[id]))) {
      MslCliente.logout();
      $("#gate-aviso").innerHTML = `<p class="msl-error">Esta cuenta no administra este tenant.</p>`;
      return;
    }
    pintarShell();
  }, { once: false });
}

// ------------------------------------------------------------------ shell

function pintarShell() {
  // La pestaña activa siempre es una que la sesión tenga permitida.
  if (!puede(ACC[ui.tab])) ui.tab = (TABS.find(([id]) => puede(ACC[id])) ?? [])[0] ?? ui.tab;
  $("#raiz").innerHTML = `
    <header class="adm-top">
      <h1><is-icon icon="mdi:store-cog"></is-icon> Admin · ${esc(MslCliente.app)}</h1>
      <span class="adm-spacer"></span>
      <div id="adm-tema"></div>
      <is-button variant="text" id="btn-salir"><is-icon icon="mdi:logout"></is-icon> Salir</is-button>
    </header>
    <is-tab-group class="adm-tabs" id="adm-tabs" active="${ui.tab}">
      ${TABS.filter(([id]) => puede(ACC[id])).map(([id, icono, nombre]) => `
        <is-tab slot="nav" panel="${id}">
          <is-icon icon="${icono}"></is-icon> ${nombre}
        </is-tab>`).join("")}
    </is-tab-group>
    <main class="adm-main" id="adm-main"></main>`;
  montarControlesTema($("#adm-tema"), estado.cfg?.paletas || []);
  $("#btn-salir").addEventListener("click", () => { MslCliente.logout(); pintarGate(); });
  $("#adm-tabs").addEventListener("is-tab-show", (e) => {
    ui.tab = e.detail.name;
    pintarSeccion();
  });
  pintarSeccion();
}

// Despacha la sección activa.
function pintarSeccion() {
  const main = $("#adm-main");
  main.innerHTML = `<div id="sec-aviso"></div><div id="sec-cuerpo"><is-spinner></is-spinner></div>`;
  const secciones = {
    catalogo: secCatalogo,
    pedidos: secPedidos,
    pagos: secPagos,
    metricas: secMetricas,
    apariencia: secApariencia,
  };
  secciones[ui.tab]().catch((e) => {
    $("#sec-cuerpo").innerHTML = "";
    mostrarError("#sec-aviso", e);
  });
}

// --------------------------------------------------------------- catálogo

async function secCatalogo() {
  $("#sec-cuerpo").innerHTML = `
    <div class="adm-barra">
      <is-input id="f-search" label="Buscar" value="${esc(ui.prod.search)}" placeholder="nombre o descripción"></is-input>
      <is-select id="f-activo" label="Estado" value="${esc(ui.prod.activo)}">
        <is-option value="1">Activos</is-option>
        <is-option value="0">Inactivos</is-option>
      </is-select>
      <is-input id="f-categoria" label="Categoría" value="${esc(ui.prod.categoria)}"></is-input>
      <is-select id="f-sort" label="Ordenar por" value="${esc(ui.prod.sort)}">
        ${["id", "nombre", "precio", "creado_en"].map((s) =>
          `<is-option value="${s}">${s}</is-option>`).join("")}
      </is-select>
      <is-checkbox id="f-desc" ${ui.prod.desc ? "checked" : ""}>Desc</is-checkbox>
      <is-button id="btn-filtrar"><is-icon icon="mdi:magnify"></is-icon> Filtrar</is-button>
      <is-button id="btn-nuevo" variant="text"><is-icon icon="mdi:plus"></is-icon> Nuevo</is-button>
    </div>
    <div id="prod-form"></div>
    <div id="prod-lista"><is-spinner></is-spinner></div>
    <div class="adm-pagin" id="prod-pagin"></div>`;
  $("#btn-filtrar").addEventListener("click", () => {
    ui.prod.search = $("#f-search").value.trim();
    ui.prod.activo = $("#f-activo").value;
    ui.prod.categoria = $("#f-categoria").value.trim();
    ui.prod.sort = $("#f-sort").value;
    ui.prod.desc = $("#f-desc").checked;
    ui.prod.offset = 0;
    cargarProductos();
  });
  $("#f-search").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-filtrar").click(); });
  $("#btn-nuevo").addEventListener("click", () => pintarFormProducto({}));
  if (ui.editando) pintarFormProducto(ui.editando);
  await cargarProductos();
}

// Filtro QUERY de productos.
function filtroProductos() {
  const eq = { activo: Number(ui.prod.activo) };
  if (ui.prod.categoria) eq.categoria = ui.prod.categoria;
  const f = { eq, sort: ui.prod.sort, desc: ui.prod.desc, limit: ui.prod.limit, offset: ui.prod.offset };
  if (ui.prod.search) f.search = ui.prod.search;
  return f;
}

// Pinta tabla de productos.
async function cargarProductos() {
  const lista = $("#prod-lista");
  lista.innerHTML = `<is-spinner></is-spinner>`;
  // Pinta con lo cacheado y se rehace solo si el servidor trae algo distinto.
  const pintar = ({ results, pagina }) => {
    if (!results.length) {
      lista.innerHTML = `<p class="adm-vacio">Sin productos con este filtro.</p>`;
    } else {
      lista.innerHTML = `
        <table class="adm-tabla">
          <thead><tr>
            <th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th>
            <th>Categoría</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            ${results.map((p) => `
              <tr class="${p.activo ? "" : "inactivo"}">
                <td>${p.id}</td>
                <td>${esc(p.nombre)}</td>
                <td>${dinero(p.precio, p.moneda)}</td>
                <td>${p.stock}</td>
                <td>${esc(p.categoria || "—")}</td>
                <td><is-badge>${p.activo ? "activo" : "inactivo"}</is-badge></td>
                <td class="adm-acciones">
                  <is-button variant="text" data-editar="${p.id}" title="Editar"><is-icon icon="mdi:pencil"></is-icon></is-button>
                  <is-button variant="text" data-borrar="${p.id}" title="Desactivar"><is-icon icon="mdi:delete"></is-icon></is-button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    }
    // Paginación: total llega en pagina (forma defensiva).
    const total = Number(pagina?.total ?? pagina?.n ?? 0);
    $("#prod-pagin").innerHTML = `
      <is-button variant="text" id="pg-ant" ${ui.prod.offset === 0 ? "disabled" : ""}>
        <is-icon icon="mdi:chevron-left"></is-icon> Anterior</is-button>
      <small>${total ? `${ui.prod.offset + 1}–${ui.prod.offset + results.length} de ${total}` : ""}</small>
      <is-button variant="text" id="pg-sig" ${results.length < ui.prod.limit ? "disabled" : ""}>
        Siguiente <is-icon icon="mdi:chevron-right"></is-icon></is-button>`;
    $("#pg-ant").addEventListener("click", () => {
      ui.prod.offset = Math.max(0, ui.prod.offset - ui.prod.limit);
      cargarProductos();
    });
    $("#pg-sig").addEventListener("click", () => {
      ui.prod.offset += ui.prod.limit;
      cargarProductos();
    });
    // Acciones de fila: onclick se reemplaza en cada recarga.
    lista.onclick = async (e) => {
      const be = e.target.closest("[data-editar]");
      const bb = e.target.closest("[data-borrar]");
      if (be) {
        const p = await MslCliente.producto(be.dataset.editar).catch((err) => (mostrarError("#sec-aviso", err), null));
        if (p) pintarFormProducto(p);
      }
      if (bb) {
        if (!confirm(`¿Desactivar el producto #${bb.dataset.borrar}?`)) return;
        try {
          await MslCliente.borrarProducto(bb.dataset.borrar);
          mostrarOk("#sec-aviso", "Producto desactivado.");
          cargarProductos();
        } catch (err) { mostrarError("#sec-aviso", err); }
      }
    };
  };
  try {
    await MslCliente.productos.vivo(filtroProductos(), pintar, {
      onError: (e) => mostrarError("#sec-aviso", e),
    });
  } catch (e) {
    lista.innerHTML = "";
    mostrarError("#sec-aviso", e);
  }
}

// Form de crear/editar producto.
function pintarFormProducto(p) {
  ui.editando = p;
  const esNuevo = !p.id;
  $("#prod-form").innerHTML = `
    <div class="adm-card">
      <h3>${esNuevo ? "Nuevo producto" : `Editar producto #${p.id}`}</h3>
      <form class="adm-form" id="form-prod">
        <div class="adm-fila">
          <is-input name="nombre" label="Nombre" required value="${esc(p.nombre || "")}"></is-input>
          <is-input name="precio" type="number" min="0" step="any" required label="Precio (pesos)"
            value="${p.precio != null ? p.precio / 100 : ""}"></is-input>
          <is-input name="moneda" label="Moneda" value="${esc(p.moneda || "COP")}" maxlength="3"></is-input>
        </div>
        <div class="adm-fila">
          <is-input name="stock" type="number" min="0" step="1" label="Stock" value="${p.stock ?? 0}"></is-input>
          <is-input name="categoria" label="Categoría" value="${esc(p.categoria || "")}"></is-input>
          ${esNuevo ? "" : `<is-checkbox name="activo" ${p.activo ? "checked" : ""}>Activo</is-checkbox>`}
        </div>
        <is-textarea name="descripcion" label="Descripción" rows="3"
          value="${esc(p.descripcion || "")}"></is-textarea>
        <msl-imagen-input id="prod-img" label="Subir imágenes" entidad="producto" multiple
          ${p.id ? `entidad-id="${p.id}"` : ""}></msl-imagen-input>
        <is-textarea name="imagenes" label="Imágenes (una URL por línea)" rows="3"
          value="${esc((p.imagenes || []).join("\n"))}"></is-textarea>
        <is-textarea name="variaciones" label="Variaciones (JSON)" rows="6"
          value="${esc(JSON.stringify(p.variaciones || {}, null, 2))}"></is-textarea>
        <is-textarea name="meta" label="Meta (JSON)" rows="4"
          value="${esc(JSON.stringify(p.meta || {}, null, 2))}"></is-textarea>
        <div class="adm-fila">
          <is-button type="submit"><is-icon icon="mdi:content-save"></is-icon> Guardar</is-button>
          <is-button type="button" variant="text" id="btn-cancelar-prod">Cancelar</is-button>
        </div>
        <div id="form-prod-aviso"></div>
      </form>
    </div>`;
  // El uploader escribe en el textarea: una sola fuente al guardar.
  const uploader = $("#prod-img");
  if (uploader) {
    uploader.valor = p.imagenes || [];
    uploader.addEventListener("msl-cambio", (e) => {
      $("#form-prod").imagenes.value = e.detail.urls.join("\n");
    });
  }
  $("#btn-cancelar-prod").addEventListener("click", () => {
    ui.editando = null;
    $("#prod-form").innerHTML = "";
  });
  $("#form-prod").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const datos = {
        nombre: f.nombre.value.trim(),
        descripcion: f.descripcion.value.trim() || null,
        precio: aCentavos(f.precio.value),
        moneda: f.moneda.value.trim() || "COP",
        stock: Math.round(Number(f.stock.value) || 0),
        categoria: f.categoria.value.trim() || null,
        imagenes: f.imagenes.value.split("\n").map((u) => u.trim()).filter(Boolean),
        variaciones: leerJson(f.variaciones.value, "variaciones"),
        meta: leerJson(f.meta.value, "meta"),
      };
      if (!esNuevo) datos.activo = f.activo.checked;
      if (esNuevo) await MslCliente.crearProducto(datos);
      else await MslCliente.actualizarProducto(p.id, datos);
      ui.editando = null;
      $("#prod-form").innerHTML = "";
      mostrarOk("#sec-aviso", esNuevo ? "Producto creado." : "Producto actualizado.");
      cargarProductos();
    } catch (err) {
      mostrarError("#form-prod-aviso", err);
    }
  };
  $("#prod-form").scrollIntoView({ behavior: "smooth" });
}

// ---------------------------------------------------------------- pedidos

async function secPedidos() {
  $("#sec-cuerpo").innerHTML = `
    <div class="adm-barra">
      <is-select id="f-ped-estado" label="Estado" value="${esc(ui.pedEstado || "")}">
        <is-option value="">Todos</is-option>
        ${ESTADOS_PEDIDO.map((s) => `<is-option value="${s}">${s}</is-option>`).join("")}
      </is-select>
      <is-button id="btn-ped-filtrar"><is-icon icon="mdi:magnify"></is-icon> Filtrar</is-button>
    </div>
    <div id="ped-lista"><is-spinner></is-spinner></div>`;
  $("#btn-ped-filtrar").addEventListener("click", () => {
    ui.pedEstado = $("#f-ped-estado").value;
    cargarPedidos();
  });
  await cargarPedidos();
}

// Pinta lista de pedidos con acciones admin.
async function cargarPedidos() {
  const lista = $("#ped-lista");
  lista.innerHTML = `<is-spinner></is-spinner>`;
  try {
    const filtro = { sort: "id", desc: true, limit: 50 };
    if (ui.pedEstado) filtro.eq = { estado: ui.pedEstado };
    // Caché primero; se repinta solo si el servidor difiere.
    await MslCliente.pedidos.vivo(filtro, ({ results: pedidos }) => {
    if (!pedidos.length) {
      lista.innerHTML = `<p class="adm-vacio">Sin pedidos con este filtro.</p>`;
      return;
    }
    lista.innerHTML = pedidos.map((p) => `
      <div class="adm-pedido" data-codigo="${esc(p.codigo)}">
        <msl-pedido-card></msl-pedido-card>
        <div class="adm-pedido-acciones">
          <is-select data-campo="estado" label="Estado" value="${esc(p.estado || "")}">
            ${ESTADOS_PEDIDO.map((s) => `<is-option value="${s}">${s}</is-option>`).join("")}
          </is-select>
          <is-select data-campo="canal" label="Canal" value="${esc(p.canal_pago || "")}">
            <is-option value="">—</is-option>
            ${["whatsapp", "wompi"].map((c) => `<is-option value="${c}">${c}</is-option>`).join("")}
          </is-select>
          <is-button data-x="guardar" variant="text"><is-icon icon="mdi:content-save"></is-icon> Estado</is-button>
          <is-input data-campo="monto" type="number" min="0" step="any" label="Monto (pesos)"
            value="${(p.total ?? 0) / 100}"></is-input>
          <is-select data-campo="metodo" label="Método" value="${esc(METODOS_PAGO[0] || "")}">
            ${METODOS_PAGO.map((m) => `<is-option value="${m}">${m}</is-option>`).join("")}
          </is-select>
          <is-input data-campo="referencia" label="Referencia" placeholder="opcional"></is-input>
          <is-button data-x="pagar"><is-icon icon="mdi:cash-plus"></is-icon> Registrar pago</is-button>
          <div class="adm-ped-aviso"></div>
        </div>
      </div>`).join("");
    // Carga cada tarjeta y amarra acciones.
    for (const nodo of lista.querySelectorAll(".adm-pedido")) {
      const p = pedidos.find((x) => x.codigo === nodo.dataset.codigo);
      const card = nodo.querySelector("msl-pedido-card");
      card.pedido = p;
      const campo = (n) => nodo.querySelector(`[data-campo="${n}"]`);
      const aviso = nodo.querySelector(".adm-ped-aviso");
      nodo.querySelector('[data-x="guardar"]').addEventListener("click", async () => {
        try {
          await MslCliente.actualizarPedido(p.codigo, {
            estado: campo("estado").value,
            canal_pago: campo("canal").value || undefined,
          });
          aviso.innerHTML = `<p class="adm-ok">Pedido actualizado.</p>`;
          p.estado = campo("estado").value;
          card.pedido = p;
        } catch (e) { aviso.innerHTML = `<p class="msl-error">${esc(e.message)}</p>`; }
      });
      nodo.querySelector('[data-x="pagar"]').addEventListener("click", async () => {
        try {
          await MslCliente.registrarPago({
            pedido_codigo: p.codigo,
            monto: aCentavos(campo("monto").value),
            metodo: campo("metodo").value,
            referencia_externa: campo("referencia").value.trim() || undefined,
          });
          aviso.innerHTML = `<p class="adm-ok">Pago registrado.</p>`;
        } catch (e) { aviso.innerHTML = `<p class="msl-error">${esc(e.message)}</p>`; }
      });
    }
    }, { onError: (e) => mostrarError("#sec-aviso", e) });
  } catch (e) {
    lista.innerHTML = "";
    mostrarError("#sec-aviso", e);
  }
}

// ------------------------------------------------------------------ pagos

async function secPagos() {
  $("#sec-cuerpo").innerHTML = `
    <div class="adm-barra">
      <is-select id="f-pago-metodo" label="Método" value="${esc(ui.pago.metodo || "")}">
        <is-option value="">Todos</is-option>
        ${METODOS_PAGO.map((m) => `<is-option value="${m}">${m}</is-option>`).join("")}
      </is-select>
      <is-select id="f-pago-estado" label="Estado" value="${esc(ui.pago.estado || "")}">
        <is-option value="">Todos</is-option>
        ${["registrado", "confirmado", "rechazado"].map((s) =>
          `<is-option value="${s}">${s}</is-option>`).join("")}
      </is-select>
      <is-button id="btn-pago-filtrar"><is-icon icon="mdi:magnify"></is-icon> Filtrar</is-button>
    </div>
    <div id="pago-lista"><is-spinner></is-spinner></div>`;
  $("#btn-pago-filtrar").addEventListener("click", () => {
    ui.pago.metodo = $("#f-pago-metodo").value;
    ui.pago.estado = $("#f-pago-estado").value;
    cargarPagos();
  });
  await cargarPagos();
}

// Pinta tabla de pagos.
async function cargarPagos() {
  const lista = $("#pago-lista");
  lista.innerHTML = `<is-spinner></is-spinner>`;
  try {
    const eq = {};
    if (ui.pago.metodo) eq.metodo = ui.pago.metodo;
    if (ui.pago.estado) eq.estado = ui.pago.estado;
    const filtro = { sort: "id", desc: true, limit: 50 };
    if (Object.keys(eq).length) filtro.eq = eq;
    await MslCliente.pagos.vivo(filtro, ({ results: pagos }) => {
    if (!pagos.length) {
      lista.innerHTML = `<p class="adm-vacio">Sin pagos con este filtro.</p>`;
      return;
    }
    lista.innerHTML = `
      <table class="adm-tabla">
        <thead><tr>
          <th>ID</th><th>Pedido</th><th>Monto</th><th>Método</th>
          <th>Estado</th><th>Referencia</th><th>Fecha</th>
        </tr></thead>
        <tbody>
          ${pagos.map((g) => `
            <tr>
              <td>${g.id}</td>
              <td>#${Number(g.pedido_id).toString(36)}</td>
              <td>${dinero(g.monto, "COP")}</td>
              <td>${esc(g.metodo)}</td>
              <td><is-badge>${esc(g.estado)}</is-badge></td>
              <td>${esc(g.referencia_externa || "—")}</td>
              <td>${esc((g.registrado_en || "").slice(0, 16).replace("T", " "))}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
    }, { onError: (e) => mostrarError("#sec-aviso", e) });
  } catch (e) {
    lista.innerHTML = "";
    mostrarError("#sec-aviso", e);
  }
}

// --------------------------------------------------------------- métricas

async function secMetricas() {
  // Las cifras aparecen al instante con lo último conocido y se corrigen solas.
  await MslCliente.metricas.vivo({}, async (m) => {
  // Nombres del top: un fetch por producto, tolerante a borrados.
  const top = await Promise.all((m.productos_top || []).map(async (t) => {
    const p = await MslCliente.producto(t.producto_id).catch(() => null);
    return { ...t, nombre: p?.nombre || `#${t.producto_id}` };
  }));
  $("#sec-cuerpo").innerHTML = `
    <div class="adm-metricas">
      <msl-metrica-card icono="mdi:eye" valor="${m.visitas}" etiqueta="Visitas"></msl-metrica-card>
      <msl-metrica-card icono="mdi:account-group" valor="${m.usuarios}" etiqueta="Usuarios"></msl-metrica-card>
      <msl-metrica-card icono="mdi:receipt-text" valor="${m.pedidos?.total ?? 0}" etiqueta="Pedidos"></msl-metrica-card>
      <msl-metrica-card icono="mdi:clock-alert" valor="${m.pedidos?.pendientes ?? 0}" etiqueta="Pendientes de pago"></msl-metrica-card>
      <msl-metrica-card icono="mdi:cash" valor="${dinero(m.ingresos_centavos)}" etiqueta="Ingresos"></msl-metrica-card>
    </div>
    <div class="adm-card">
      <h3>Conversión por canal</h3>
      <table class="adm-tabla">
        <thead><tr><th>Canal</th><th>Pedidos</th></tr></thead>
        <tbody>
          ${Object.entries(m.conversion || {}).map(([canal, n]) =>
            `<tr><td>${esc(canal)}</td><td>${n}</td></tr>`).join("") ||
            `<tr><td colspan="2" class="adm-vacio">Sin datos.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="adm-card">
      <h3>Productos top (interés)</h3>
      <table class="adm-tabla">
        <thead><tr><th>Producto</th><th>Peso</th><th>Eventos</th></tr></thead>
        <tbody>
          ${top.map((t) =>
            `<tr><td>${esc(t.nombre)}</td><td>${t.peso}</td><td>${t.eventos}</td></tr>`).join("") ||
            `<tr><td colspan="3" class="adm-vacio">Sin datos.</td></tr>`}
        </tbody>
      </table>
    </div>`;
  }, { onError: (e) => mostrarError("#sec-aviso", e) });
}

// -------------------------------------------------------------- apariencia

async function secApariencia() {
  const cfg = await MslCliente.config();
  $("#sec-cuerpo").innerHTML = `
    <div class="adm-card">
      <h3>Configuración del tenant</h3>
      <form class="adm-form" id="form-cfg">
        <div class="adm-fila">
          <is-input name="nombre" label="Nombre" required value="${esc(cfg.nombre || "")}"></is-input>
          <is-input name="whatsapp_soporte" type="tel" label="WhatsApp soporte"
            value="${esc(cfg.whatsapp_soporte || "")}" placeholder="573001112233"></is-input>
        </div>
        <div class="adm-fila">
          <is-input name="dns_personalizado" label="DNS personalizado"
            value="${esc(cfg.dns_personalizado || "")}" placeholder="mitienda.com"></is-input>
          <is-input name="plantilla_activa" label="Plantilla activa"
            value="${esc(cfg.plantilla_activa || "catalogo")}"></is-input>
          <is-input name="vigencia_suscripcion" type="date" label="Vigencia suscripción"
            hint="La config pública no la expone: déjala vacía para no tocarla."></is-input>
        </div>
        <div>
          <p class="adm-leyenda">Variables CSS (tema del tenant)</p>
          <div id="css-vars"></div>
          <is-button type="button" variant="text" id="btn-add-var">
            <is-icon icon="mdi:plus"></is-icon> Agregar variable</is-button>
        </div>
        <is-textarea name="meta" label="Meta (JSON)" rows="4"
          value="${esc(JSON.stringify(cfg.meta || {}, null, 2))}"></is-textarea>
        <div class="adm-fila">
          <is-button type="submit"><is-icon icon="mdi:content-save"></is-icon> Guardar</is-button>
        </div>
        <div id="form-cfg-aviso"></div>
      </form>
    </div>`;

  // Pares clave=valor de css_vars.
  const vars = $("#css-vars");
  const pintarPar = (k = "", v = "") => {
    const fila = document.createElement("div");
    fila.className = "adm-par";
    fila.innerHTML = `
      <is-input data-k placeholder="--primario" value="${esc(k)}" aria-label="Variable CSS"></is-input>
      <is-input data-v placeholder="#6d28d9" value="${esc(v)}" aria-label="Valor"></is-input>
      <is-button variant="text" type="button" data-quitar><is-icon icon="mdi:close"></is-icon></is-button>`;
    fila.querySelector("[data-quitar]").addEventListener("click", () => fila.remove());
    vars.appendChild(fila);
  };
  for (const [k, v] of Object.entries(cfg.css_vars || {})) pintarPar(k, v);
  if (!vars.children.length) pintarPar();
  $("#btn-add-var").addEventListener("click", () => pintarPar());

  $("#form-cfg").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const css_vars = {};
      for (const fila of vars.querySelectorAll(".adm-par")) {
        const k = fila.querySelector("[data-k]").value.trim();
        const v = fila.querySelector("[data-v]").value.trim();
        if (k) css_vars[k] = v;
      }
      const datos = {
        nombre: f.nombre.value.trim(),
        whatsapp_soporte: f.whatsapp_soporte.value.trim() || null,
        dns_personalizado: f.dns_personalizado.value.trim() || null,
        plantilla_activa: f.plantilla_activa.value.trim() || "catalogo",
        css_vars,
        meta: leerJson(f.meta.value, "meta"),
      };
      // Vigencia solo si el admin la escribe: la config pública no la devuelve.
      if (f.vigencia_suscripcion.value) datos.vigencia_suscripcion = f.vigencia_suscripcion.value;
      await MslCliente.guardarConfig(datos);
      aplicarTema();
      mostrarOk("#form-cfg-aviso", "Configuración guardada.");
    } catch (err) {
      mostrarError("#form-cfg-aviso", err);
    }
  };
}

// ------------------------------------------------------------------ arranque

boot().catch((e) => {
  $("#raiz").innerHTML = `<p class="msl-error">${esc(e.message || e)}</p>`;
});
