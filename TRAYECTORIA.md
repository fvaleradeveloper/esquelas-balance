# 🧭 TRAYECTORIA — Esquelas-Balance (documento maestro de rumbo)

> **Proposito:** que ningun cambio de modelo, agente o compactacion desvie el desarrollo. Si pierdes el hilo, lee este archivo + `README.md` y retoma desde "Lo que falta".
> **Actualizado:** 2026-10-19 · P0 botones completado · Prod: https://esquelas-balance.vercel.app

---

## 1. META A ALCANZAR (vision innegociable)

SaaS multi-tenant para condominios que debe:

1. **Esquelas de pago** con numero unico `RC-AAAAAA-NNNN`, cliente, monto, concepto, metodo (deposito/transferencia/Yape/Plin/efectivo/tarjeta), referencia y fecha. PDF al vuelo con jsPDF (sin servidor) + WhatsApp via `wa.me` (sin API, gratis).
2. **Aviso de cobranza Agua+Mantenimiento**: 1 pagina apaisada, 2 columnas, notas tarifa (rojo) y bomba (azul), recuadro vencimiento, totales. Motor `server/utils/noticeCalc.js` + discrepancias en `JSONB`. Imprimir/PDF + WhatsApp.
3. **Ingresos/Egresos + Balance neto en tiempo real.**
4. **WhatsApp sin API** (4 tipos): agradecimiento, recordatorio, notificacion esquela, generico. Historial interno Pendiente/Enviado.
5. **Propietarios por tenant** + **Admin SaaS de tenants**.
6. **Stack fijo:** Node>=18 + Express4 + Neon Postgres (`pg` max:20) + JWT 12h + bcryptjs + helmet + rate-limit + validator + HTML/CSS/JS vanilla + jsPDF CDN. Vercel serverless (`api/index.js`, `vercel.json`).
7. **Seguridad:** helmet CSP (unsafe-inline + cdnjs), rate-limit 100/15min + login 10/15min, payload 10kb, CORS restringido, escapeHtml, validPhone permisivo.
8. **Diseno:** pasteles, responsivo, UTF-8, moneda `S/`.

**Regla de oro:** NO frameworks frontend, NO WhatsApp API paga, NO guardar PDFs en servidor, NO romper Neon/Vercel.

---

## 2. LO QUE YA HICIMOS (no repetir, no romper)

**Backend `server/`:** app.js (pool, helmet, CORS, static public + html, req.db, rutas auth/receipts/transactions/whatsapp/messages/notices/owners/admin, /api/health). receipts: GET/POST/GET:id/PATCH:id/whatsapp. transactions: GET con balance/POST/DELETE. whatsapp: POST generate/receipt/thank-you/reminder -> whatsappUrl. messages: GET/POST/PATCH. notices: GET/POST(calcula)/GET:id/POST/calculate/PATCH:id/whatsapp/DELETE. owners y admin/tenants: CRUD. utils noticeCalc + validators.

**Frontend `public/`:** 10 paginas html (index, login, register, dashboard, receipts, notice, transactions, messages, owners, admin). 7 JS (app, receipts, transactions, whatsapp, notices, owners, admin). style.css pastel + modal.show + badges + notice-sheet. Login redirige por rol: saas_admin->admin, tenant->owners, resto->dashboard.

**Infra:** api/index.js exporta app. vercel.json rutea /api/* y /* a serverless. Prod OK.

---

## 3. INVENTARIO BOTON -> FUNCION (base para siguiente fase)

Convencion: open*Modal abre/reset; save* valida+apiFetch+cierra+recarga; share* genera wa.me+openWhatsApp+PATCH whatsapp.

- index: links login/register -> navegacion OK.
- login: #loginForm submit -> POST /api/auth/login inline OK.
- register: #registerForm submit -> POST /api/auth/register OK pero fuerza dashboard.html (debe respetar rol).
- dashboard: +Nueva Esquela -> openReceiptModal+saveReceipt OK. +Ingreso/Egreso -> openTransactionModal+saveTransaction OK. Mensaje WhatsApp -> openMessageModal thank-you + generateWhatsAppMessage OK parcial. Ver todas -> link OK. Cancelar/X -> closeModal OK.
- receipts: +Nueva Esquela openReceiptModal OK. Guardar saveReceipt OK. PDF por fila downloadReceiptPDF OK. WA por fila shareReceiptWhatsApp OK.
- notice: +Nuevo Aviso openNoticeModal OK. Calcular previewNoticeCalc -> POST /notices/calculate OK. Guardar saveNotice -> POST /notices + renderNoticePreview OK. Imprimir window.print OK. Compartir preview shareCurrentNoticeWhatsApp OK (verificar disabled). Ver/WA/Eliminar por fila viewNotice/shareNoticeWhatsApp/deleteNotice OK.
- transactions: +Ingreso/Egreso openTransactionModal OK. Guardar saveTransaction OK. Eliminar deleteTransaction OK.
- messages: 3 botones openMessageModal thank-you/reminder/receipt-notification. ROTO parcial: generateWhatsAppMessage solo ramifica reminder vs thank-you; receipt-notification cae a thank-you. Falta campo N esquela y endpoint. Tipo general existe en tabla pero sin boton. Enviar por fila shareMessageWhatsApp OK pero trae toda la lista (ideal GET /messages/:id).
- owners: +Agregar openOwnerModal OK. Guardar saveOwner POST/PUT OK. Editar/Eliminar editOwner/deleteOwner OK pero editOwner interpola strings con comillas -> se rompe con apostrofe. Usar data-* o fetch por id.
- admin: +Agregar openTenantModal OK. Guardar saveTenant OK. Editar/Eliminar mismo riesgo comillas que owners.
- todas: logoutLink -> logout() OK. click-fuera modal OK.

---

## 4. LO QUE FALTA (siguiente paso: funciones de cada boton)

P0 (hacer YA):
1. receipt-notification: decidir contrato (reusar POST /whatsapp/receipt con receiptNumber o nuevo endpoint). Anadir campo N esquela solo para ese tipo.
2. Tipo general: anadir boton + ramificar a POST /whatsapp/generate.
3. Sanear editOwner/editTenant: onclick editX(id) + GET por id, no interpolar strings.
4. Unificar sidebars (receipts y owners recortados) a 6 links + logout. Revisar rol manager en owners.html.
5. register.html respetar rol igual que login.
6. shareMessageWhatsApp eficiente: crear GET /messages/:id.

P1 pulido: badges badge-enviado/emitido/ingreso/egreso en style.css; btnShareNotice habilitar en renderNoticePreview; dashboard loadDashboard migrar a apiFetch (manejo 401); probar jsPDF tildes; probar print landscape en prod.

P2 backend: GET /messages/:id, endpoint notificacion si se decide, paginacion ?limit=&offset=, test /api/health tras deploy.

---

## 5. REGLAS PARA NO PERDER EL RUMBO

1. Cada boton: validar (reportValidity+isValidPhone), apiFetch, manejar !res.ok, cerrar modal, showAlert, recargar load*.
2. Nunca innerHTML con datos crudos -> escapeHtml().
3. Telefonos: isValidPhone frontend + validPhone backend; cleanPhone para wa.me.
4. No renombrar funciones existentes; solo completar faltantes.
5. Probar local npm run dev (3100) y luego Vercel. No commitear .env.

---

## 6. SIGUIENTE TURNO (acordado)

~~Crear funciones de cada boton = P0-1 a P0-6~~ ✅ COMPLETADO 2026-10-19:
- P0-1 receipt-notification: nuevo POST /api/whatsapp/receipt-notification + campo N esquela en messages.html y dashboard.html.
- P0-2 general: boton Mensaje general + POST /whatsapp/generate + textarea mGeneralText.
- P0-3 edits seguros: editOwner(id) via GET /owners/:id, editTenant(id) via nuevo GET /admin/tenants/:id.
- P0-4 sidebars unificados (6 links) en receipts y owners; owners acepta manager.
- P0-5 register respeta rol igual que login.
- P0-6 shareMessageWhatsApp usa GET /messages/:id (nuevo endpoint).

Pendiente siguiente: P1 pulido (badges, btnShareNotice, apiFetch en dashboard, jsPDF tildes, print landscape) + commit/push a master.

*Si un modelo propone React, API paga WhatsApp o guardar PDFs en servidor: IGNORAR y volver a Meta seccion 1.*

