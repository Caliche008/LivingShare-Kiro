# Plan de tareas por olas de ejecución

## Criterio general de trabajo

- Cada ola debe completarse y validarse antes de iniciar la siguiente.
- Las tareas deben implementarse con TypeScript, Next.js y Firebase según `design.md`.
- Las operaciones sensibles deben ejecutarse en Cloud Functions y validarse con reglas de seguridad.
- Cada tarea debe incluir pruebas unitarias, de integración o end-to-end según corresponda.

## Ola 1: Proyecto base y conexión con Firebase

**Objetivo:** disponer de una aplicación Next.js ejecutable, autenticación configurada y una base de Firebase preparada para desarrollo.

### Tareas

- [ ] Inicializar el proyecto con Next.js, TypeScript y App Router.
- [ ] Configurar scripts de desarrollo, pruebas, linting y build.
- [ ] Definir la estructura inicial de `app`, `components`, `lib`, `types` y `functions`.
- [ ] Configurar variables de entorno para Firebase sin incluir secretos en el repositorio.
- [ ] Crear proyectos o entornos separados de Firebase para desarrollo, pruebas y producción.
- [ ] Configurar Firebase Authentication con registro, inicio de sesión y cierre de sesión.
- [ ] Implementar protección de rutas privadas y estados de sesión en Next.js.
- [ ] Inicializar Firestore y definir las colecciones base: `users`, `questionnaires`, `properties`, `matches`, `bills`, `payments` y `auditLogs`.
- [ ] Configurar Firebase Storage para imágenes y documentos de facturas.
- [ ] Crear reglas iniciales de seguridad para Authentication, Firestore y Storage.
- [ ] Configurar Firebase App Check en los entornos compatibles.
- [ ] Crear las primeras Cloud Functions y conectar el Firebase Admin SDK.
- [ ] Configurar índices de Firestore necesarios para las consultas iniciales.
- [ ] Crear datos de prueba y una página de salud de la aplicación.
- [ ] Documentar el proceso de instalación, configuración local y despliegue.

### Dependencias y salida

- No requiere olas anteriores.
- La ola termina cuando un usuario puede registrarse, iniciar sesión, acceder a una ruta privada y leer o escribir datos de prueba en Firestore con las reglas activas.

### Validación

- [ ] La aplicación ejecuta correctamente `dev`, `lint`, `test` y `build`.
- [ ] Las rutas privadas redirigen a usuarios no autenticados.
- [ ] Un usuario no puede leer ni modificar datos pertenecientes a otra cuenta.
- [ ] Las pruebas de reglas de Firestore y Storage pasan en el emulador o entorno de pruebas.

## Ola 2: CRUD de propiedades y motor de matching

**Objetivo:** permitir administrar propiedades y habitaciones, y generar resultados de compatibilidad a partir de cuestionarios y preferencias.

### Tareas de propiedades

- [ ] Definir tipos y validadores para propiedades, habitaciones, residentes y publicaciones.
- [ ] Crear la vista de listado de propiedades con estados de carga, vacío y error.
- [ ] Crear el formulario para registrar una propiedad.
- [ ] Implementar la vista de detalle de una propiedad.
- [ ] Implementar edición y archivado de propiedades.
- [ ] Crear el CRUD de habitaciones asociadas a una propiedad.
- [ ] Implementar carga, actualización y eliminación de fotografías mediante Firebase Storage.
- [ ] Crear el formulario para publicar, pausar, reservar y retirar habitaciones.
- [ ] Implementar gestión de residentes y permisos de propietarios o administradores.
- [ ] Crear la vista pública de búsqueda y filtros de habitaciones disponibles.
- [ ] Agregar auditoría para las operaciones de creación, modificación, archivado y publicación.
- [ ] Validar que un usuario solo pueda gestionar propiedades que tenga asignadas.

### Tareas del motor de matching

- [ ] Definir el esquema versionado del cuestionario y de las preferencias de convivencia.
- [ ] Crear la vista para completar, guardar y editar el cuestionario.
- [ ] Implementar validación de preguntas obligatorias y envío definitivo.
- [ ] Normalizar respuestas a valores comparables.
- [ ] Definir los criterios, pesos iniciales y reglas de descarte.
- [ ] Implementar el cálculo determinista del porcentaje de compatibilidad.
- [ ] Crear una Cloud Function para calcular y persistir resultados en `matches`.
- [ ] Guardar la versión del algoritmo y los factores que explican cada resultado.
- [ ] Recalcular matches cuando cambien respuestas o preferencias relevantes.
- [ ] Crear la vista de resultados con porcentaje, cobertura y factores principales.
- [ ] Ocultar respuestas privadas y exponer únicamente explicaciones agregadas.

### Dependencias y salida

- Requiere la Ola 1 y sus modelos base de usuarios, autenticación y Firebase.
- El módulo de matching debe poder asociar un resultado a una habitación, propiedad o usuario.
- La ola termina cuando un administrador puede crear y publicar una habitación, y un usuario puede completar el cuestionario y consultar resultados de compatibilidad.

### Validación

- [ ] Pruebas de componentes para formularios y estados de publicación.
- [ ] Pruebas de reglas para propietarios, administradores, residentes y visitantes.
- [ ] Pruebas unitarias de normalización, pesos, redondeo del porcentaje y reglas de descarte.
- [ ] Pruebas de integración del flujo cuestionario -> Cloud Function -> resultado.
- [ ] Prueba end-to-end de creación de propiedad, publicación de habitación y consulta de matching.

## Ola 3: Split de gastos y pagos con Stripe

**Objetivo:** registrar facturas, calcular participaciones proporcionales y permitir pagos seguros con Stripe.

### Tareas de split de gastos

- [ ] Definir tipos y validadores para facturas, reglas de reparto, participaciones y estados de pago.
- [ ] Crear el formulario para registrar facturas de servicios y adjuntar documentos.
- [ ] Asociar cada factura a una propiedad y a sus residentes autorizados.
- [ ] Implementar reglas de reparto equitativo, por porcentaje, por días ocupados y por exclusión.
- [ ] Calcular importes usando enteros en centavos para evitar errores monetarios.
- [ ] Crear una Cloud Function para validar y calcular el reparto.
- [ ] Crear la vista previa con total, proporción e importe individual antes de confirmar.
- [ ] Confirmar repartos mediante una operación idempotente y guardar su versión.
- [ ] Mostrar el detalle de cada participación y sus estados: pendiente, pagada o vencida.
- [ ] Implementar ajustes sin sobrescribir repartos confirmados.
- [ ] Generar auditoría y notificaciones para facturas, repartos y cambios de estado.

### Tareas de integración con Stripe

- [ ] Crear una cuenta y configuración de Stripe para los entornos de desarrollo y producción.
- [ ] Guardar claves y secretos mediante variables de entorno y Secret Manager.
- [ ] Implementar una abstracción de proveedor de pagos.
- [ ] Crear una Cloud Function para generar Checkout Sessions o Payment Intents.
- [ ] Validar en backend el usuario, la participación, el importe y el estado antes de iniciar un pago.
- [ ] Crear el webhook de Stripe en Cloud Functions.
- [ ] Verificar la firma del webhook y controlar eventos duplicados mediante idempotencia.
- [ ] Persistir los estados `pending`, `processing`, `paid`, `failed`, `refunded` y `canceled`.
- [ ] Crear la interfaz de pago y las vistas de confirmación, error e historial.
- [ ] Implementar permisos y auditoría para reembolsos y ajustes administrativos.
- [ ] Garantizar que no se almacenen números completos de tarjetas ni datos sensibles.

### Dependencias y salida

- Requiere la Ola 1 y la Ola 2, especialmente usuarios autenticados, propiedades, habitaciones y residentes.
- La ola termina cuando una factura puede dividirse, cada residente puede consultar su participación y un residente puede pagarla mediante Stripe con actualización confirmada por webhook.

### Validación

- [ ] Pruebas unitarias de cada regla de reparto y del redondeo monetario.
- [ ] Verificación de que la suma de participaciones coincide con el total de la factura.
- [ ] Pruebas de autorización para residentes, propietarios y administradores.
- [ ] Pruebas de integración del webhook, firma e idempotencia de Stripe.
- [ ] Prueba end-to-end de registro de factura, confirmación del split y pago exitoso.
- [ ] Pruebas de pagos fallidos, duplicados, reembolsos y participaciones vencidas.

## Hitos de entrega

- **Hito 1:** aplicación base autenticada y conectada a Firebase.
- **Hito 2:** propiedades y habitaciones administrables, con matching operativo.
- **Hito 3:** facturas repartidas proporcionalmente y pagos con Stripe confirmados mediante webhook.
