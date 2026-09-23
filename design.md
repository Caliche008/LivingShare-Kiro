# Diseño del sistema

## 1. Objetivo

El sistema permitirá gestionar la convivencia entre personas que buscan o administran habitaciones: completar un cuestionario de estilo de vida, calcular compatibilidad, registrar y repartir facturas, publicar habitaciones y administrar propiedades.

La solución se organizará como una aplicación web con Next.js en el frontend y Firebase como plataforma de backend, autenticación, persistencia y almacenamiento. Los pagos se procesarán mediante un proveedor externo integrado a traves de servicios seguros del backend.

## 2. Arquitectura general

```text
+-------------------+       HTTPS        +---------------------------+
| Navegador         | <-----------------> | Next.js                  |
| Desktop / movil   |                     | App Router + TypeScript |
+-------------------+                     +-------------+-------------+
                                                        |
                                                        | Firebase SDK
                                                        v
                              +-------------------------+-------------------------+
                              | Firebase                                         |
                              | Authentication | Firestore | Storage             |
                              | Cloud Functions | App Check | Hosting (opcional) |
                              +-------------------------+-------------------------+
                                                        |
                                                        | API segura / webhooks
                                                        v
                              +-----------------------------------------------+
                              | Proveedor de pagos (Stripe u otro)          |
                              +-----------------------------------------------+
```

### Principios de diseño

- Separar la interfaz, la logica de dominio y el acceso a datos.
- Mantener las operaciones sensibles en Cloud Functions, nunca en el navegador.
- Aplicar autorizacion tanto en la interfaz como mediante reglas de seguridad de Firebase.
- Usar operaciones idempotentes para pagos, webhooks y repartos de facturas.
- Registrar cambios importantes para mantener trazabilidad.
- Diseñar los modulos para que puedan evolucionar sin acoplar matching, facturacion y publicaciones.

## 3. Frontend con Next.js

### Estructura propuesta

```text
src/
  app/
    (auth)/login/page.tsx
    (auth)/register/page.tsx
    questionnaire/page.tsx
    matches/page.tsx
    bills/page.tsx
    properties/page.tsx
    properties/[propertyId]/page.tsx
    rooms/[roomId]/page.tsx
    dashboard/page.tsx
    api/                    # Solo endpoints que requieran un BFF
  components/
    questionnaire/
    matching/
    bills/
    properties/
    payments/
    ui/
  lib/
    firebase/
    domain/
    validation/
  types/
```

### Responsabilidades

- Next.js App Router: rutas, layouts, carga de datos y separacion de areas publicas y privadas.
- TypeScript: contratos compartidos para usuarios, propiedades, facturas, respuestas y pagos.
- Componentes de cliente: formularios interactivos, filtros, calculadoras de reparto y estados de pago.
- Server Components: vistas de consulta que no necesiten estado interactivo.
- Zod o una libreria equivalente: validacion de datos en formularios y en los limites de la aplicacion.
- Firebase Client SDK: autenticacion y lecturas/escrituras permitidas por las reglas.
- Firebase Admin SDK: solo en Cloud Functions o codigo de servidor protegido.

La interfaz debera ser responsive y mostrar estados de carga, error, vacio y exito para cada operacion relevante.

## 4. Firebase: backend y base de datos

### Servicios

- **Firebase Authentication:** registro, inicio de sesion, recuperacion de cuenta y proveedores sociales si se habilitan.
- **Cloud Firestore:** usuarios, respuestas, compatibilidades, propiedades, habitaciones, facturas, repartos y pagos.
- **Cloud Storage:** fotografias de propiedades, habitaciones y documentos de facturas.
- **Cloud Functions:** calculo de matching, reparto de facturas, validacion de pagos, webhooks y tareas asincronas.
- **Firebase App Check:** reducir solicitudes no autorizadas desde clientes no confiables.
- **Firebase Hosting:** opcion de despliegue para el frontend si se utiliza junto con una configuracion compatible de Next.js.

### Modelo de datos inicial

```text
users/{userId}
  profile, roles, questionnaireStatus, createdAt, updatedAt

questionnaires/{userId}
  answers, version, completedAt, updatedAt

properties/{propertyId}
  ownerId, managerIds, address, description, status, createdAt, updatedAt

properties/{propertyId}/rooms/{roomId}
  title, description, price, availability, amenities, rules, status

matches/{matchId}
  userId, targetType, targetId, score, factors, algorithmVersion, createdAt

bills/{billId}
  propertyId, serviceType, period, totalAmount, dueDate, attachmentPath, status

bills/{billId}/shares/{shareId}
  residentId, rule, proportion, amount, status, calculatedAt

payments/{paymentId}
  userId, billShareId, provider, providerPaymentId, amount, currency, status

auditLogs/{logId}
  actorId, action, resourceType, resourceId, metadata, createdAt
```

Los importes monetarios se almacenaran como enteros en la unidad minima de la moneda, por ejemplo centavos, para evitar errores de redondeo. Las fechas se almacenaran como timestamps de Firebase.

### Reglas de seguridad

- Un usuario solo puede leer y actualizar su propio cuestionario.
- Un propietario o administrador solo puede gestionar propiedades que tenga asignadas.
- Las facturas y sus repartos solo son visibles para los residentes y administradores de la propiedad correspondiente.
- Las publicaciones publicadas pueden ser consultadas por usuarios autenticados o por visitantes, segun la politica definida.
- Los cambios de roles, importes confirmados y estados de pago se ejecutaran en Cloud Functions.
- Storage validara tipo, tamano y ruta del archivo antes de permitir una carga.

## 5. Modulo de matching

### Flujo

1. El usuario completa y envia el cuestionario.
2. Una Cloud Function valida la respuesta y guarda una version inmutable del envio.
3. El motor obtiene las preferencias compatibles de habitaciones, propiedades o usuarios.
4. Normaliza las respuestas a valores comparables.
5. Calcula un puntaje ponderado y guarda el resultado con la version del algoritmo.
6. La interfaz muestra el porcentaje, los factores principales y la fecha de calculo.
7. Un cambio en el cuestionario o en una preferencia relevante dispara un nuevo calculo.

### Calculo

Cada criterio tendra un peso configurable. El puntaje final se calculara como:

```text
compatibilidad = 100 * suma(peso_i * similitud_i) / suma(peso_i aplicable)
```

La similitud sera un valor entre 0 y 1. Los criterios sin respuesta no penalizaran el resultado, pero el sistema indicara cuando la cobertura de respuestas sea insuficiente. Para criterios incompatibles y obligatorios, como no aceptar mascotas cuando existe una mascota, se podra aplicar una regla de descarte antes del calculo.

El motor debe ser determinista, versionado y comprobable mediante pruebas unitarias. No se expondran respuestas privadas de otros usuarios; solo se mostraran factores agregados y explicaciones comprensibles.

## 6. Modulo de facturacion y pagos

### Reparto de facturas

1. Un usuario autorizado registra la factura y su importe total.
2. Selecciona residentes y una regla: equitativa, porcentaje, dias ocupados o exclusion.
3. Una Cloud Function calcula las partes usando enteros en centavos.
4. El sistema presenta una vista previa y permite confirmar el reparto.
5. Al confirmar, crea las participaciones y notifica a los residentes.
6. Cada residente puede pagar su participacion y consultar el detalle del calculo.

El reparto confirmado no se sobrescribira. Una modificacion generara una nueva version o una operacion de ajuste con registro de auditoria.

### Integracion de pagos

Se recomienda Stripe como proveedor inicial, aunque la capa de pagos debe abstraer el proveedor para permitir sustituirlo posteriormente.

- El frontend solicita a una Cloud Function crear una sesion de Checkout o un Payment Intent.
- La funcion valida identidad, autorizacion, importe y estado de la participacion antes de crear el pago.
- El navegador nunca recibe claves secretas ni decide el importe final.
- Stripe envia el resultado a un webhook de Cloud Functions.
- El webhook verifica la firma, comprueba la idempotencia y actualiza el estado de `payments` y de la participacion.
- Los estados principales seran `pending`, `processing`, `paid`, `failed`, `refunded` y `canceled`.
- Los reembolsos y ajustes requeriran permisos de administrador y quedaran auditados.

No se almacenaran numeros completos de tarjetas ni datos sensibles de pago en Firestore. Se guardaran unicamente identificadores del proveedor, importes, moneda, estados y metadatos necesarios para conciliacion.

## 7. Gestion de propiedades y publicaciones

El panel privado permitira crear propiedades, gestionar habitaciones, cargar fotografias, administrar residentes y consultar ocupacion, facturas y publicaciones. Cada publicacion tendra un ciclo de vida controlado: `draft`, `published`, `paused`, `reserved` y `withdrawn`.

Las consultas publicas solo devolveran habitaciones publicadas y disponibles. Las operaciones de escritura validaran la relacion entre usuario, propiedad y habitacion antes de ejecutarse.

## 8. Notificaciones y tareas asincronas

Cloud Functions podra generar notificaciones para:

- Nuevos resultados de compatibilidad.
- Facturas repartidas y proximos vencimientos.
- Confirmacion o fallo de pagos.
- Cambios de estado de una publicacion.
- Solicitudes o actualizaciones de administracion.

Las notificaciones deberan ser idempotentes y registrar su estado para evitar duplicados. La primera version puede usar notificaciones dentro de la aplicacion y correo electronico; las notificaciones push quedan como extension.

## 9. Observabilidad, pruebas y despliegue

- Registrar errores y eventos de negocio sin incluir respuestas privadas ni datos sensibles de pago.
- Configurar alertas para fallos de Functions, webhooks rechazados y errores de permisos.
- Probar con unit tests el algoritmo de matching y el reparto monetario.
- Probar con integration tests las reglas de Firestore, el flujo de autenticacion y los webhooks.
- Ejecutar pruebas end-to-end para completar cuestionarios, publicar habitaciones y pagar una participacion.
- Separar proyectos Firebase de desarrollo, pruebas y produccion.
- Gestionar configuracion y secretos mediante variables de entorno y Secret Manager.
- Desplegar primero reglas, Functions e indices, y despues el frontend.

## 10. Decisiones pendientes

- Confirmar paises y monedas soportados.
- Definir el proveedor de pagos y si se requieren pagos recurrentes.
- Determinar si las publicaciones seran visibles sin autenticacion.
- Definir las ponderaciones iniciales y los criterios obligatorios del matching.
- Confirmar los canales de notificacion requeridos para la primera version.
