# Esquelas-Balance

> Sistema de esquelas de pago (recibos), **avisos de cobranza de agua y mantenimiento**, balance de ingresos/egresos y mensajería WhatsApp sin API. Diseño profesional en colores pasteles, 100% responsivo, protegido anti-hackers y desplegado en **Vercel + Neon (PostgreSQL)**.

**En producción:**

- App: **https://esquelas-balance.vercel.app**
- Repositorio: **https://github.com/fvaleradeveloper/esquelas-balance**
- Aviso de cobranza: **https://esquelas-balance.vercel.app/html/notice.html**
- Health check: **https://esquelas-balance.vercel.app/api/health**

---

## Características

- **Esquelas de pago (recibos):** Genere recibos por depósitos, transferencias, Yape, Plin, efectivo o tarjeta. Cada esquela tiene número único (RC-AAAAAA-NNNN), cliente, monto, concepto, referencia y fecha.
- **Aviso de cobranza (agua + mantenimiento):** Plantilla reutilizable de una página apaisada con dos columnas: lecturas y deuda anterior a la izquierda, resumen de importes a la derecha, notas de tarifa (rojo) y bomba (azul), recuadro de vencimiento y totales inferiores. Motor de cálculo independiente con tarifa configurable por periodo y registro de discrepancias fórmula-vs-referencia. Impresión/PDF y compartir por WhatsApp.
- **Descarga en PDF:** Generación de PDF en el navegador con jsPDF (sin dependencias de servidor).
- **Ingresos y Egresos:** Registro financiero completo con balance neto en tiempo real.
- **Mensajes WhatsApp (sin API):** Enlaces directos `wa.me` para:
  - **Agradecimiento por pago** — mensaje de confirmación al cliente.
  - **Recordatorio de pago** — aviso con fecha de vencimiento.
  - **Notificación de esquela** — envío del recibo por WhatsApp.
  - **Compartir esquela** — un clic para abrir WhatsApp con el mensaje pre-redactado.
- **Mensajes internos:** Historial de todos los mensajes enviados con estado (Pendiente/Enviado).
- **Diseño profesional:** Colores pasteles, tarjetas con sombras suaves, 100% responsivo (celular, tablet, escritorio).
- **Seguridad anti-hackers:** Ver sección de seguridad.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js ≥ 18 |
| Servidor | Express 4 |
| Base de datos | PostgreSQL (Neon) con `pg` |
| Autenticación | JWT (12h) + bcryptjs |
| Seguridad | helmet, express-rate-limit, express-validator |
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| PDF | jsPDF (CDN) |
| WhatsApp | wa.me (sin API) |
| Despliegue | Vercel + Neon |

---

## Estructura del Proyecto

```
esquelas-balance/
├── api/
│   └── index.js              # Entry point para Vercel Serverless
├── db/
│   ├── schema.sql            # Esquema PostgreSQL (Neon)
│   ├── init.js               # Inicializar base de datos
│   └── seed.js               # Datos de prueba
├── server/
│   ├── app.js                # Express + seguridad + rutas
│   └── routes/
│       ├── auth.js           # Registro, login, perfil, cambio de contraseña
│       ├── receipts.js       # CRUD de esquelas de pago
│       ├── transactions.js   # Ingresos y egresos + balance
│       ├── whatsapp.js       # Generación de enlaces wa.me
│       └── messages.js       # Mensajes internos
├── public/
│   ├── css/style.css         # Estilos (paleta pastel, responsivo)
│   ├── js/
│   │   ├── app.js            # Utilidades (API, escape HTML, validaciones)
│   │   ├── receipts.js       # Esquelas + PDF + compartir
│   │   ├── transactions.js   # Transacciones + balance
│   │   └── whatsapp.js       # Mensajes WhatsApp
│   └── html/
│       ├── index.html        # Landing page
│       ├── login.html        # Inicio de sesión
│       ├── register.html     # Registro
│       ├── dashboard.html    # Panel principal con estadísticas
│       ├── receipts.html     # Esquelas de pago
│       ├── transactions.html # Ingresos y egresos
│       └── messages.html     # Mensajes / WhatsApp
├── vercel.json               # Configuración de Vercel
├── .env.example              # Variables de entorno de ejemplo
└── package.json
```

---

## Instalación Local

```bash
# 1. Clonar e instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edite .env: JWT_SECRET (32+ caracteres), DATABASE_URL (Neon), etc.

# 3. Inicializar la base de datos (crea tablas en Neon)
npm run init:db

# 4. Poblar con datos de prueba (opcional)
npm run seed

# 5. Ejecutar en desarrollo
npm run dev
```

Servidor local: `http://localhost:3100`

---

## Datos de Prueba (seed)

| Usuario | Email | Contraseña |
|---------|-------|------------|
| Admin | admin@esquelas-balance.local | Admin12345 |
| Tenant | carlos@lasbrisas.local | Tenant1234 |

El seed crea 4 esquelas de pago, 7 transacciones y 4 mensajes internos de ejemplo.

---

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default 3100) |
| `JWT_SECRET` | Secreto JWT (mínimo 32 caracteres) |
| `DATABASE_URL` | URL de conexión de Neon (PostgreSQL) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del admin inicial |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) |

## Seguridad Anti-Hackers

Todas las medidas están **implementadas y verificadas** en el código:

| Capa | Medida | Implementación |
|------|--------|----------------|
| **Headers HTTP** | Helmet con CSP personalizado | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, CSP que permite scripts inline + CDN jsPDF |
| **DDoS / Fuerza bruta** | Rate limiting global | 100 requests / IP / 15 min |
| **Fuerza bruta en login** | Rate limiting de auth | 10 intentos / IP / 15 min |
| **DDoS por payload** | Límite de cuerpo JSON | `express.json({ limit: '10kb' })` |
| **SQL Injection** | Consultas parametrizadas | Todas usan `$1, $2...` de `pg` (nunca concatenación) |
| **Contraseñas** | Hash bcrypt | `bcryptjs` con costo 10, nunca se devuelven en respuestas |
| **Tokens** | JWT con expiración | 12 horas, secreto de 32+ caracteres |
| **Validación de entrada** | express-validator | Email, teléfono móvil, montos numéricos, enums en TODOS los POST |
| **XSS (salida)** | Escape HTML | Función `escapeHtml()` en frontend antes de renderizar |
| **CORS** | Lista blanca | Solo orígenes explícitos en `CORS_ORIGINS` |
| **Fuga de errores** | Manejador global | Mensaje genérico al cliente; detalles solo en logs |
| **UTF-8** | Codificación consistente | `<meta charset="UTF-8">` + respuestas JSON en UTF-8 |

### Pentest básico

1. **XSS:** ingrese `<script>alert('xss')</script>` en nombre/concepto → debe mostrarse como texto plano.
2. **SQL Injection:** pruebe `'; DROP TABLE users; --` → neutralizado por consultas parametrizadas.
3. **Fuerza bruta:** 11+ logins fallidos → bloqueo 15 min (`429`).
4. **Payload grande:** POST con JSON > 10kb → rechazo `413`.
5. **Headers:** `curl -I https://su-app/` debe mostrar `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`.

> `script-src` del CSP incluye `'unsafe-inline'` porque el frontend usa scripts inline. La defensa XSS principal es `escapeHtml()` en la salida de datos.

---

## Flujo WhatsApp (sin API)

Sin API de WhatsApp Business ni servicios de pago. Solo enlaces `wa.me`:

1. El usuario crea la esquela / mensaje en el sistema.
2. El backend genera el texto pre-redactado (`/api/whatsapp/*`).
3. Se abre `https://wa.me/<teléfono>?text=<mensaje>` en pestaña nueva.
4. El usuario envía desde WhatsApp Web/Desktop, adjuntando el PDF si desea.
5. El sistema marca el registro como `whatsapp_sent = true`.

| Tipo | Endpoint | Contenido |
|------|----------|-----------|
| Esquela de pago | `POST /api/whatsapp/receipt` | Número, cliente, monto, concepto, método, fecha |
| Agradecimiento | `POST /api/whatsapp/thank-you` | Confirmación de pago recibido |
| Recordatorio | `POST /api/whatsapp/reminder` | Pago pendiente con fecha de vencimiento |
| Genérico | `POST /api/whatsapp/generate` | Texto libre (reenviar mensajes internos) |

**Costo:** Gratis. **Configuración:** ninguna. **Requisito:** WhatsApp Web/Desktop abierto.

---

## Despliegue en Vercel + Neon

### 1. Base de datos en Neon

1. Cree cuenta en [neon.tech](https://neon.tech) y cree proyecto + BD `esquelas_balance`.
2. Copie el `DATABASE_URL` (formato `postgresql://user:pass@host/db?sslmode=require`).

### 2. Inicializar el esquema

```bash
# Con DATABASE_URL configurado en .env:
npm run init:db    # crea tablas
npm run seed       # datos de prueba (opcional)
```

### 3. Subir a GitHub

```bash
cd k:\esquelas-balance
git init
git add -A
git commit -m "feat: esquelas-balance v1.0.0 - recibos, balance, whatsapp share, seguridad anti-hackers"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/esquelas-balance.git
git push -u origin main
```

### 4. Desplegar en Vercel

1. Importe el repositorio en [vercel.com](https://vercel.com).
2. Variables de entorno del proyecto:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | (la de Neon, con `?sslmode=require`) |
| `JWT_SECRET` | secreto de 32+ caracteres |
| `ADMIN_EMAIL` | admin del sistema |
| `ADMIN_PASSWORD` | contraseña segura |
| `CORS_ORIGINS` | `https://SU-APP.vercel.app` |
| `NODE_ENV` | `production` |

3. Vercel usará `vercel.json` y `api/index.js` como entry point serverless.
4. `public/` se sirve desde el mismo Express.

**Nota:** el pool `pg` está configurado con `max: 20` e `idleTimeoutMillis` para conexiones efímeras de Neon. jsPDF se carga desde CDN en el navegador. Los PDF se generan y descargan localmente (no se suben al servidor).

---

## API (resumen)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No (rate-limit) | Registro de usuario |
| POST | `/api/auth/login` | No (rate-limit) | Login → JWT |
| GET | `/api/auth/profile` | Sí | Perfil |
| POST | `/api/auth/change-password` | Sí | Cambio de contraseña |
| GET / POST | `/api/receipts` | Sí | Listar / crear esquela |
| GET | `/api/receipts/:id` | Sí | Detalle (para PDF) |
| PATCH | `/api/receipts/:id/whatsapp` | Sí | Marcar enviada |
| GET / POST | `/api/transactions` | Sí | Listar (con balance) / crear |
| DELETE | `/api/transactions/:id` | Sí | Eliminar |
| POST | `/api/whatsapp/generate` | Sí | Enlace wa.me genérico |
| POST | `/api/whatsapp/receipt` | Sí | Mensaje de esquela |
| POST | `/api/whatsapp/thank-you` | Sí | Agradecimiento |
| POST | `/api/whatsapp/reminder` | Sí | Recordatorio |
| GET / POST | `/api/messages` | Sí | Mensajes internos |
| PATCH | `/api/messages/:id/whatsapp` | Sí | Marcar enviado |

---

*Generado con UTF-8 — Esquelas-Balance v1.0.0*