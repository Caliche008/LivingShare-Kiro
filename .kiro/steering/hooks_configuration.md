# Hooks y automatizaciones de LivingShare

## Propósito

Este documento describe cómo deben configurarse y utilizarse las automatizaciones y los ganchos relacionados con el desarrollo de LivingShare. El objetivo es mantener validaciones repetibles, reducir errores manuales y asegurar que las reglas de arquitectura, seguridad y calidad se apliquen de forma consistente.

## Estado actual

Actualmente el proyecto tiene configurado el steering de LivingShare en:

```text
.kiro/steering/livingshare.md
```

Este steering se aplica como contexto de trabajo para el agente y establece las reglas de arquitectura, TypeScript, Firebase, seguridad, pagos, validación y pruebas.

No existen todavía hooks ejecutables adicionales configurados en `.kiro/hooks/`. Por lo tanto, ningún comando automático de lint, pruebas, build, despliegue o modificación de archivos debe considerarse activo hasta que se registre explícitamente y se valide.

## Principios para hooks

- Los hooks deben ser pequeños, deterministas y fáciles de revisar.
- Cada hook debe tener un único propósito claramente descrito.
- Un hook no debe modificar archivos fuera del alcance de la tarea sin autorización explícita.
- Las operaciones sensibles, como pagos, cambios de roles, escritura de auditoría y despliegues, nunca deben ejecutarse automáticamente desde un hook local.
- Los hooks deben fallar de forma visible y devolver un mensaje accionable.
- Las credenciales y secretos deben permanecer en variables de entorno o Secret Manager.
- Las tareas destructivas requieren confirmación explícita.
- Los hooks no deben ocultar errores de lint, typecheck, pruebas o build.
- Antes de activar un hook, se debe probar manualmente el comando que ejecutará.

## Automatizaciones recomendadas

### Validación después de cambios de código

Cuando se implemente una funcionalidad, el agente debe ejecutar primero la validación más cercana al código modificado:

1. Pruebas unitarias del módulo afectado.
2. Pruebas de integración si cambia Firebase, autenticación o Cloud Functions.
3. Lint y typecheck.
4. Build de producción cuando el cambio afecte rutas, configuración o integración entre módulos.

La validación debe conservar el alcance de la tarea y no ejecutar despliegues automáticamente.

### Validación de reglas de Firebase

Los cambios en Firestore Rules, Storage Rules o índices deben activar una revisión específica que compruebe:

- Acceso de usuarios autenticados y no autenticados.
- Acceso del propietario y administradores asignados.
- Restricciones para residentes y visitantes.
- Protección de cuestionarios y documentos privados.
- Validación de rutas y tipos de archivos en Storage.
- Ausencia de permisos amplios no justificados.

Estas comprobaciones deben ejecutarse contra el emulador o un entorno de pruebas, nunca contra producción por defecto.

### Revisión de operaciones monetarias

Los cambios en facturación o pagos deben comprobar que:

- Los importes se almacenan como enteros en centavos.
- El reparto suma exactamente el total de la factura.
- El redondeo es determinista.
- Un reparto confirmado no se sobrescribe.
- Los webhooks de Stripe verifican la firma.
- Los eventos duplicados son idempotentes.
- El navegador no determina el importe final ni recibe claves secretas.

### Revisión de privacidad

Los cambios que procesen cuestionarios, perfiles, facturas o pagos deben verificar que:

- Cada lectura y escritura tiene una autorización correspondiente.
- Las respuestas privadas no se envían a otros usuarios.
- Los archivos adjuntos usan rutas restringidas.
- Los logs no contienen secretos, números completos de tarjeta ni respuestas privadas.
- Las explicaciones de matching muestran únicamente factores agregados.

## Ciclo de ejecución

Todo hook o automatización nueva debe documentarse con los siguientes datos:

- Nombre descriptivo.
- Evento que lo activa.
- Archivos o módulos afectados.
- Comando exacto que ejecuta.
- Variables de entorno necesarias.
- Resultado esperado.
- Condiciones de fallo.
- Forma de ejecutar la comprobación manualmente.
- Si requiere confirmación antes de continuar.

Ejemplo de registro:

```text
Nombre: validar-matching
Evento: cambio en el módulo de matching o en sus pruebas
Alcance: src/lib/domain/matching y tests relacionados
Comando: npm test -- matching
Resultado esperado: todas las pruebas pasan
Fallo: detener el flujo y mostrar el error
Confirmación: no requerida
```

## Hooks que no deben automatizarse sin confirmación

No se deben activar automáticamente las siguientes acciones:

- Desplegar Cloud Functions, reglas o el frontend.
- Crear, cancelar o reembolsar pagos.
- Modificar roles o permisos de usuarios.
- Eliminar propiedades, habitaciones, facturas o documentos.
- Cambiar datos de producción.
- Ejecutar migraciones irreversibles.
- Publicar una habitación o reservarla en nombre de un usuario.

## Mantenimiento

Cada cambio en un hook debe incluir su documentación y una prueba manual o automatizada. Si un hook deja de ser necesario, debe desactivarse y conservarse la razón en el historial del proyecto.

Antes de considerar un hook listo para uso, el agente debe confirmar:

- Que el comando funciona en Windows y en el entorno documentado.
- Que el hook no depende de rutas absolutas de una máquina específica.
- Que no expone secretos en la salida.
- Que sus errores son visibles.
- Que no afecta archivos fuera de su alcance.
- Que existe una forma segura de ejecutarlo manualmente.
