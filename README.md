# LivingShare — Marketplace de Co-living

## Requisitos previos

- Node.js 22+
- npm 10+
- Cuenta de Firebase (gratuita suficiente para desarrollo)
- Firebase CLI: `npm install -g firebase-tools`

---

## Instalación y configuración local

### 1. Clonar e instalar dependencias

```bash
# Instalar dependencias del proyecto Next.js
npm install

# Instalar dependencias de Cloud Functions
cd functions && npm install && cd ..
```

### 2. Configurar Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Crear un proyecto (ej: `livingshare-dev`)
3. Habilitar:
   - **Authentication** → Email/Password
   - **Firestore** → modo producción
   - **Storage** → modo producción
   - **Functions** → requiere plan Blaze (pago por uso)

4. Copiar las credenciales del proyecto:
   - Ir a **Configuración del proyecto → General → Tus apps → SDK de Firebase**
   - Copiar las variables al archivo `.env.local`

```bash
cp .env.example .env.local
# Editar .env.local con las credenciales reales
```

### 3. Variables de entorno

Editar `.env.local` con los valores de tu proyecto Firebase:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Ejecutar con emuladores de Firebase (recomendado para desarrollo)

```bash
# Iniciar sesión en Firebase CLI
firebase login

# Seleccionar el proyecto
firebase use livingshare-dev

# Iniciar emuladores
firebase emulators:start

# En otra terminal, iniciar Next.js
npm run dev
```

La UI del emulador estará en `http://localhost:4000`.

### 5. Ejecutar sin emuladores (contra Firebase real)

```bash
npm run dev
```

Abrir `http://localhost:3000`.

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linter ESLint |
| `cd functions && npm run build` | Compilar Cloud Functions |

---

## Estructura del proyecto

```
src/
  app/
    (auth)/           # Páginas públicas: login, registro
    (private)/        # Páginas privadas: dashboard, cuestionario, etc.
    api/              # Endpoints Next.js (health check, BFF si es necesario)
    health/           # Página de estado del sistema
  components/
    ui/               # Componentes reutilizables (ProtectedRoute, etc.)
    questionnaire/    # Componentes del cuestionario de compatibilidad
    matching/         # Componentes de resultados de matching
    bills/            # Componentes de facturas y split
    properties/       # Componentes de propiedades y habitaciones
    payments/         # Componentes del flujo de pago
  lib/
    firebase/         # Config, auth, AuthContext
    domain/           # Lógica de dominio (matching, split)
    validation/       # Schemas Zod
  types/              # Tipos TypeScript compartidos
functions/
  src/                # Cloud Functions (TypeScript)
firestore.rules       # Reglas de seguridad de Firestore
storage.rules         # Reglas de Firebase Storage
firebase.json         # Configuración de Firebase CLI
```

---

## Despliegue

### Reglas y funciones

```bash
# Desplegar solo reglas
firebase deploy --only firestore:rules,storage

# Desplegar solo índices
firebase deploy --only firestore:indexes

# Desplegar solo funciones
cd functions && npm run build && cd ..
firebase deploy --only functions

# Despliegue completo (sin frontend)
firebase deploy --only firestore,storage,functions
```

### Frontend (Vercel — recomendado)

```bash
# Instalar CLI de Vercel
npm install -g vercel

# Desplegar
vercel
```

Configurar las variables de entorno en Vercel Dashboard.

---

## Seguridad

- Nunca incluir el archivo `.env.local` en el repositorio (está en `.gitignore`)
- Las claves del Admin SDK (cuentas de servicio) solo deben existir en variables de entorno del servidor
- Las Cloud Functions validan identidad y autorización antes de cualquier operación sensible
- Los importes monetarios se almacenan en centavos (enteros) para evitar errores de redondeo
