import Image from "next/image";

interface LogoProps {
  /** Ancho en píxeles (la altura se calcula manteniendo proporción). */
  size?: number;
  /** Clases extra para el contenedor. */
  className?: string;
  /** Prioriza la carga (útil en la pantalla inicial). */
  priority?: boolean;
}

/**
 * Logo de LivingShare.
 *
 * El PNG tiene fondo claro, por lo que se muestra sobre un contenedor con
 * fondo blanco redondeado para que se vea bien tanto en tema claro como oscuro
 * (evita problemas de contraste del logo sobre fondos oscuros).
 */
export default function Logo({ size = 160, className = "", priority = false }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-sm ${className}`}
    >
      <Image
        src="/logo-livingshare.png"
        alt="LivingShare"
        width={size}
        height={size}
        priority={priority}
        style={{ height: "auto", width: size }}
      />
    </span>
  );
}
