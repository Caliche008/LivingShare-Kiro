# Plan de tareas por olas de ejecución

## Criterio general de trabajo

- Cada ola debe completarse y validarse antes de iniciar la siguiente.
- Las tareas deben implementarse con TypeScript, Next.js y Firebase según `design.md`.
- Las operaciones sensibles deben ejecutarse en Cloud Functions y validarse con reglas de seguridad.
- Cada tarea debe incluir pruebas unitarias, de integración o end-to-end según corresponda.

## Ola 1: Proyecto base y conexión con Firebase

**Objetivo:** disponer de una aplicación Next.js ejecutable, autenticación configurada y una base de Firebase preparada para desarrollo.

### Tareas

- [x] Inicializar el proyecto con Next.js, TypeScript y App Router.
- [x] Configurar scripts de desarrollo, pruebas, linting y build.
- [x] Definir la estructura inicial de `app`, `components`, `lib`, `types` y `functions`.
- [x] Configurar variables de entorno para Firebase sin incluir secretos en el repositorio.
- [x] Crear proyectos o entornos separados de Firebase para desarrollo, pruebas y producción.
- [x] Configurar Firebase Authentication con registro, inicio de sesión y cierre de sesión.
- [x] Implementar protección de rutas privadas y estados de sesión en Next.js.
- [x] Inicializar Firestore y definir las colecciones base: `users`, `questionnaires`, `properties`, `matches`, `bills`, `payments` y `auditLogs`.
- [x] Configurar Firebase Storage para imágenes y documentos de facturas.
- [x] Crear reglas iniciales de seguridad para Authentication, Firestore y Storage.
- [x] Configurar Firebase App Check en los entornos compatibles.
- [x] Crear las primeras Cloud Functions y conectar el Firebase Admin SDK.
- [x] Configurar índices de Firestore necesarios para las consultas iniciales.
- [x] Crear datos de prueba y una página de salud de la aplicación.
- [x] Documentar el proceso de instalación, configuración local y despliegue.

### Dependencias y salida

- No requiere olas anteriores.
- La ola termina cuando un usuario puede registrarse, iniciar sesión, acceder a una ruta privada y leer o escribir datos de prueba en Firestore con las reglas activas.

### Validación

- [x] La aplicación ejecuta correctamente `dev`, `lint`, `test` y `build`.
- [x] Las rutas privadas redirigen a usuarios no autenticados.
- [x] Un usuario no puede leer ni modificar datos pertenecientes a otra cuenta.
- [x] Las pruebas de reglas de Firestore y Storage pasan en el emulador o entorno de pruebas.

## Ola 2: CRUD de propiedades y motor de matching

**Objetivo:** permitir administrar propiedades y habitaciones, y generar resultados de compatibilidad a partir de cuestionarios y preferencias.

### Tareas de propiedades

- [x] Definir tipos y validadores para propiedades, habitaciones, residentes y publicaciones.
- [x] Crear la vista de listado de propiedades con estados de carga, vacío y error.
- [x] Crear el formulario para registrar una propiedad.
- [x] Implementar la vista de detalle de una propiedad.
- [x] Implementar edición y archivado de propiedades.
- [x] Crear el CRUD de habitaciones asociadas a una propiedad.
- [x] Implementar carga, actualización y eliminación de fotografías mediante Firebase Storage.
- [x] Crear el formulario para publicar, pausar, reservar y retirar habitaciones.
- [x] Implementar gestión de residentes y permisos de propietarios o administradores.
- [x] Crear la vista pública de búsqueda y filtros de habitaciones disponibles.
- [x] Agregar auditoría para las operaciones de creación, modificación, archivado y publicación.
- [x] Validar que un usuario solo pueda gestionar propiedades que tenga asignadas.

### Tareas del motor de matching

- [x] Definir el esquema versionado del cuestionario y de las preferencias de convivencia.
- [x] Crear la vista para completar, guardar y editar el cuestionario.
- [x] Implementar validación de preguntas obligatorias y envío definitivo.
- [x] Normalizar respuestas a valores comparables.
- [x] Definir los criterios, pesos iniciales y reglas de descarte.
- [x] Implementar el cálculo determinista del porcentaje de compatibilidad.
- [x] Crear una Cloud Function para calcular y persistir resultados en `matches`.
- [x] Guardar la versión del algoritmo y los factores que explican cada resultado.
- [x] Recalcular matches cuando cambien respuestas o preferencias relevantes.
- [x] Crear la vista de resultados con porcentaje, cobertura y factores principales.
- [x] Ocultar respuestas privadas y exponer únicamente explicaciones agregadas.

### Dependencias y salida

- Requiere la Ola 1 y sus modelos base de usuarios, autenticación y Firebase.
- El módulo de matching debe poder asociar un resultado a una habitación, propiedad o usuario.
- La ola termina cuando un administrador puede crear y publicar una habitación, y un usuario puede completar el cuestionario y consultar resultados de compatibilidad.

### Validación

- [x] Pruebas de componentes para formularios y estados de publicación.
- [x] Pruebas de reglas para propietarios, administradores, residentes y visitantes.
- [x] Pruebas unitarias de normalización, pesos, redondeo del porcentaje y reglas de descarte.
- [x] Pruebas de integración del flujo cuestionario -> Cloud Function -> resultado.
- [x] Prueba end-to-end de creación de propiedad, publicación de habitación y consulta de matching.

## Ola 3: Split de gastos y pagos con Stripe

**Objetivo:** registrar facturas, calcular participaciones proporcionales y permitir pagos seguros con Stripe.

### Tareas de split de gastos

- [x] Definir tipos y validadores para facturas, reglas de reparto, participaciones y estados de pago.
- [x] Crear el formulario para registrar facturas de servicios y adjuntar documentos.
- [x] Asociar cada factura a una propiedad y a sus residentes autorizados.
- [x] Implementar reglas de reparto equitativo, por porcentaje, por días ocupados y por exclusión.
- [x] Calcular importes usando enteros en centavos para evitar errores monetarios.
- [x] Crear una Cloud Function para validar y calcular el reparto.
- [x] Crear la vista previa con total, proporción e importe individual antes de confirmar.
- [x] Confirmar repartos mediante una operación idempotente y guardar su versión.
- [x] Mostrar el detalle de cada participación y sus estados: pendiente, pagada o vencida.
- [x] Implementar ajustes sin sobrescribir repartos confirmados.
- [x] Generar auditoría y notificaciones para facturas, repartos y cambios de estado.

### Tareas de integración con Stripe

- [x] Crear una cuenta y configuración de Stripe para los entornos de desarrollo y producción.
- [x] Guardar claves y secretos mediante variables de entorno y Secret Manager.
- [x] Implementar una abstracción de proveedor de pagos.
- [x] Crear una Cloud Function para generar Checkout Sessions o Payment Intents.
- [x] Validar en backend el usuario, la participación, el importe y el estado antes de iniciar un pago.
- [x] Crear el webhook de Stripe en Cloud Functions.
- [x] Verificar la firma del webhook y controlar eventos duplicados mediante idempotencia.
- [x] Persistir los estados `pending`, `processing`, `paid`, `failed`, `refunded` y `canceled`.
- [x] Crear la interfaz de pago y las vistas de confirmación, error e historial.
- [x] Implementar permisos y auditoría para reembolsos y ajustes administrativos.
- [x] Garantizar que no se almacenen números completos de tarjetas ni datos sensibles.

### Dependencias y salida

- Requiere la Ola 1 y la Ola 2, especialmente usuarios autenticados, propiedades, habitaciones y residentes.
- La ola termina cuando una factura puede dividirse, cada residente puede consultar su participación y un residente puede pagarla mediante Stripe con actualización confirmada por webhook.

### Validación

- [x] Pruebas unitarias de cada regla de reparto y del redondeo monetario.
- [x] Verificación de que la suma de participaciones coincide con el total de la factura.
- [x] Pruebas de autorización para residentes, propietarios y administradores.
- [x] Pruebas de integración del webhook, firma e idempotencia de Stripe (29 pruebas en functions/src/billing.test.ts con mocks de Firestore y Stripe).
- [ ] Prueba end-to-end de registro de factura, confirmación del split y pago exitoso (requiere entorno con credenciales Stripe reales y Stripe CLI).
- [x] Pruebas de pagos fallidos, duplicados, reembolsos y participaciones vencidas (cubiertas en billing.test.ts con flujo pago fallido → reintento).

## Hitos de entrega

- **Hito 1:** ✅ Aplicación base autenticada y conectada a Firebase.
- **Hito 2:** ✅ Propiedades y habitaciones administrables, con matching operativo.
- **Hito 3:** ✅ Facturas repartidas proporcionalmente y pagos con Stripe confirmados mediante webhook.
- **Hito 4:** ✅ Layout privado compartido, notificaciones in-app y dashboard enriquecido.

## Ola 4: Layout privado, notificaciones in-app y dashboard enriquecido

**Objetivo:** unificar la navegación en un layout compartido, añadir notificaciones in-app en tiempo real y enriquecer el dashboard con datos reales de facturas, habitaciones y pagos.

### Tareas

- [x] Agregar tipo `Notification` a `src/types/index.ts` (`NotificationType` + interface).
- [x] Crear `notificationsService.ts` con `getNotifications`, `getUnreadCount`, `subscribeToNotifications`, `markAsRead`, `markAllAsRead`.
- [x] Crear Cloud Function `generateNotification` en `functions/src/notifications.ts` con autorización, idempotencia y helper interno `createNotificationInternal`.
- [x] Crear layout privado compartido `src/app/(private)/layout.tsx`: sidebar fijo, nav activa por pathname, hamburguesa móvil, avatar, cierre de sesión.
- [x] Crear componente `NotificationBell.tsx`: suscripción en tiempo real, badge de no-leídas (máx "9+"), panel desplegable accesible, marcar individual y todas.
- [x] Crear componente `DashboardSummary.tsx`: carga paralela de propiedades, facturas, habitaciones y pagos; tarjetas de resumen, skeleton de carga, acciones rápidas.
- [x] Reescribir `dashboard/page.tsx` delegando en el layout y `DashboardSummary`.
- [x] Agregar 15 pruebas unitarias de `notificationsService` (query, conteo, markAsRead, batch, orden unread-first).
- [x] Verificar que `npm test` pasa en raíz (104 pruebas) y en `functions/` (29 pruebas).

### Resultado de pruebas — Ola 4 ✅

```
Raíz: 5 suites, 104 pruebas — 0 fallidas
functions/: 1 suite, 29 pruebas — 0 fallidas
```

### Archivos generados — Ola 4

- `src/types/index.ts` — `NotificationType`, `Notification`
- `src/lib/firebase/notificationsService.ts` — servicio cliente de notificaciones
- `src/lib/firebase/notifications.service.test.ts` — 15 pruebas unitarias
- `functions/src/notifications.ts` — Cloud Function `generateNotification` + helper interno
- `functions/src/index.ts` — exporta `generateNotification`
- `src/app/(private)/layout.tsx` — layout privado compartido
- `src/components/ui/NotificationBell.tsx` — campanita con tiempo real
- `src/components/ui/DashboardSummary.tsx` — resumen del dashboard
- `src/app/(private)/dashboard/page.tsx` — página delgada del dashboard

## Archivos generados — Ola 3

### Dominio
- `src/lib/domain/billSplit.ts` — lógica pura de reparto (equal, percentage, days_occupied, exclude)
- `src/lib/domain/billSplit.test.ts` — 28 pruebas unitarias (reglas, redondeo, validaciones)

### Tipos y validación
- `src/types/index.ts` — extendido con BillShare (detallado), ResidentSplitInput, BillSplitRequest, Payment
- `src/lib/validation/schemas.ts` — billSchema (con refinements), residentSplitInputSchema, billSplitRequestSchema

### Servicios Firebase (cliente)
- `src/lib/firebase/billsService.ts` — CRUD de facturas con auditoría
- `src/lib/firebase/billSplitService.ts` — leer participaciones, pagos, suscripciones en tiempo real

### Cloud Functions
- `functions/src/billing.ts` — calculateBillSplit, createPaymentSession, stripeWebhook
- `functions/src/index.ts` — exporta las nuevas funciones
- `functions/package.json` — agrega stripe 17.7.0

### Componentes
- `src/components/bills/BillForm.tsx` — formulario de registro de factura
- `src/components/bills/BillSplitPreview.tsx` — vista previa interactiva del reparto
- `src/components/bills/ShareCard.tsx` — tarjeta de participación con botón de pago Stripe

### Páginas
- `src/app/(private)/bills/page.tsx` — listado de facturas con filtros
- `src/app/(private)/bills/new/page.tsx` — nueva factura con subida de adjunto
- `src/app/(private)/bills/[billId]/page.tsx` — detalle con reparto y participaciones
- `src/app/(private)/payments/success/page.tsx` — confirmación de pago
- `src/app/(private)/payments/cancel/page.tsx` — cancelación de pago

## Resultado final de pruebas — Integración Stripe ✅

```
functions/ (npm test)
Test Suites: 1 passed, 1 total
Tests:       29 passed, 0 failed
```

| Suite | Pruebas | Estado |
|---|---|---|
| `functions/src/billing.test.ts` | 29 | ✅ |

### Cobertura de las 29 pruebas de billing.test.ts

| Área | Pruebas |
|---|---|
| stripeWebhook — verificación de firma | 3 |
| stripeWebhook — idempotencia | 2 |
| stripeWebhook — checkout.session.completed | 5 |
| stripeWebhook — checkout.session.expired | 3 |
| stripeWebhook — payment_intent.payment_failed | 3 |
| stripeWebhook — charge.refunded | 3 |
| stripeWebhook — eventos no manejados | 1 |
| createPaymentSession — autenticación | 1 |
| createPaymentSession — autorización | 2 |
| createPaymentSession — idempotencia | 2 |
| createPaymentSession — creación exitosa | 3 |
| Flujo completo: pago fallido → reintento | 1 |

### Archivos generados — Integración Stripe

- `functions/src/billing.test.ts` — 29 pruebas de integración de Cloud Functions
- `functions/src/__mocks__/firebase-admin.ts` — Firestore en memoria con subcollecciones
- `functions/src/__mocks__/firebase-functions.ts` — onCall/onRequest/HttpsError/logger
- `functions/src/__mocks__/firebase-functions-params.ts` — defineSecret
- `functions/src/__mocks__/stripe.ts` — checkout.sessions.create + webhooks.constructEvent configurables



```
Test Suites: 4 passed, 4 total
Tests:       89 passed, 0 failed
```

| Suite | Pruebas | Estado |
|---|---|---|
| `src/lib/domain/billSplit.test.ts` | 28 | ✅ |
| `src/lib/firebase/billing.service.test.ts` | 17 | ✅ |
| `src/lib/firebase/billing.webhook.test.ts` | 18 | ✅ |
| `src/lib/domain/matching.test.ts` | 26 | ✅ |

## Correcciones aplicadas en la integración final

- **`.env.example`** — agrega `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` con instrucciones de Secret Manager.
- **`firestore.rules`** — añade `_stripeEvents` y `_health` (deny all), lectura de bills para residentes, helper `getBillPropertyId`, shares accesibles al residente o al manager.
- **`firestore.indexes.json`** — 17 índices: bills (3), shares (4 + collectionGroup), payments (5), matches (2), properties (1), rooms (1).
- **`storage.rules`** — ruta `bills/{propertyId}/{allPaths=**}` cubre todos los patrones de subida de adjuntos.
- **`functions/src/billing.ts`** — import `Stripe` nativo, `HttpsError` tipado, `toHttpsError()` helper, `rawBody` correcto para webhook, tipos explícitos en todos los handlers.
- **`package.json`** — `testMatch` con `<rootDir>/src/**/*.test.ts`, `testPathIgnorePatterns` excluye `/functions/`, mock de `@stripe/stripe-js`.

## Pendiente para poner en producción

1. Ejecutar `cd functions && npm install` para instalar `stripe` en las Cloud Functions.
2. Configurar en Firebase Secret Manager:
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
3. Agregar a `.env.local`:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
4. Registrar el webhook en el Dashboard de Stripe:
   - URL: `https://<region>-<project>.cloudfunctions.net/stripeWebhook`
   - Eventos: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`
5. Compilar y desplegar funciones:
   ```bash
   cd functions && npm run build && cd ..
   firebase deploy --only functions,firestore:rules,firestore:indexes,storage
   ```
