---
name: coliving-architecture
description: Reglas de arquitectura, seguridad y dominio para construir una aplicacion de co-living con matching de compatibilidad, reparto de facturas y pagos. Usar al disenar o implementar funcionalidades de vivienda compartida.
---

# Arquitectura de co-living (LivingShare)

Aplica estas reglas al construir una aplicacion de vivienda compartida que incluya
cuestionario de compatibilidad, matching, gestion de propiedades/habitaciones,
reparto de facturas y pagos.

## Arquitectura

- Separa presentacion, logica de dominio y acceso a datos.
- Usa Server Components para vistas de solo lectura; Client Components solo para
  formularios interactivos, filtros, calculadoras y UI que depende de la sesion.
- Mantiene los tipos de dominio compartidos en una carpeta `types` y las reglas
  de dominio puras (matching, reparto) en una carpeta `domain`.
- El SDK de administracion (Firebase Admin u equivalente) solo vive en el backend
  (Cloud Functions o codigo de servidor protegido), nunca en el navegador.
- Operaciones sensibles (creacion de pagos, webhooks, calculo de matching, reparto
  de facturas, cambios de rol y escritura de auditoria) van en el backend.

## Reglas de dominio (invariantes)

- El dinero se almacena y calcula SIEMPRE en unidades minimas enteras (centavos).
  Nunca uses aritmetica de punto flotante para dinero.
- La suma de las participaciones de una factura debe ser EXACTAMENTE igual al total,
  tras el redondeo determinista (metodo Largest Remainder / Hamilton).
- Un reparto confirmado no se sobrescribe: se crea una nueva version con auditoria.
- El matching es determinista, versionado y explicable mediante factores agregados;
  las respuestas sin contestar no penalizan, pero se reporta la cobertura insuficiente.
- Aplica reglas de incompatibilidad obligatorias antes de calcular el puntaje ponderado.
- Los cambios de estado de pago se dirigen por eventos verificados del backend.
- Los webhooks de pago verifican la firma y son idempotentes (registra el id del
  evento antes de procesarlo).

## Seguridad

- Autorizacion en dos capas: UI + reglas de seguridad de la base de datos. Las
  comprobaciones solo en la UI nunca son suficientes.
- Un usuario accede solo a su propio cuestionario. Propietarios y administradores
  asignados gestionan solo sus propiedades. Las facturas y participaciones son
  visibles solo para residentes y administradores autorizados.
- Valida la entrada externa en los limites de la aplicacion con una libreria de
  esquemas (p. ej. Zod) y reutiliza los esquemas entre formularios y backend.
- Lee secretos de variables de entorno o un gestor de secretos; nunca los subas al repo.
- Registra las mutaciones importantes en una coleccion de auditoria sin incluir
  respuestas privadas ni datos de tarjeta.

## Pruebas

- Pruebas unitarias enfocadas en: matching, exclusiones obligatorias, reglas de
  reparto, redondeo entero y transiciones de estado de pago.
- Pruebas basadas en propiedades para las invariantes monetarias (la suma de las
  participaciones siempre iguala el total).
- Antes de dar por completo un cambio: corre primero la prueba mas cercana, luego
  lint y build.
