# LivingShare Co-living Power

Un Kiro Power que empaqueta las reglas de arquitectura, seguridad y dominio para
construir aplicaciones de **co-living** (vivienda compartida): cuestionario de
compatibilidad, matching, gestion de propiedades y habitaciones, reparto de
facturas en centavos y pagos idempotentes.

Extraido del proyecto [LivingShare](https://github.com/Caliche008/LivingShare-Kiro).

## Que incluye

- **`plugin.json`** — manifiesto del power (nombre, version, keywords de activacion).
- **`skills/coliving-architecture/SKILL.md`** — reglas de arquitectura, invariantes
  de dominio (dinero en centavos, suma exacta del reparto, matching determinista),
  seguridad en dos capas y estrategia de pruebas.
- **`mcp.json`** — ejemplo de servidor MCP (documentacion de AWS) que el power deja
  disponible.

## Keywords que lo activan

`coliving`, `roommates`, `matching`, `bill-split`, `facturas`, `stripe`,
`firebase`, `nextjs`, `zod`.

## Como instalarlo

En el panel de Powers de Kiro:
1. **Add Custom Power** -> **Import power from GitHub** y pega la URL de este repo, o
2. **Add Custom Power** -> **Import power from a folder** y selecciona esta carpeta.

Luego, en una conversacion, usa alguna de las keywords (p. ej. "reparto de facturas"
o "matching de roommates") para activar el power.

## Licencia

MIT
