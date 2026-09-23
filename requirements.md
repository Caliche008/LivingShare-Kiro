# Requisitos del sistema

## 1. Cuestionario de estilo de vida y compatibilidad

### RF-01. Completar cuestionario

Como usuario, quiero completar un cuestionario de estilo de vida para describir mis hábitos y preferencias de convivencia.

El sistema debe permitir:

- Crear una respuesta nueva, guardar el progreso y continuar posteriormente.
- Editar las respuestas mientras el cuestionario no se haya enviado.
- Validar que las preguntas obligatorias estén respondidas antes del envío.
- Mostrar el estado de avance del cuestionario.
- Confirmar al usuario que sus respuestas fueron guardadas correctamente.

El cuestionario podrá incluir, como mínimo, preferencias relacionadas con:

- Horarios de descanso y trabajo.
- Limpieza y orden.
- Nivel de ruido.
- Visitas y áreas comunes.
- Mascotas.
- Consumo de tabaco y alcohol.
- Presupuesto y fecha de mudanza.

### RF-02. Calcular compatibilidad

Al enviar el cuestionario, el sistema debe calcular automáticamente un porcentaje de compatibilidad entre el usuario y cada habitación, propiedad o posible compañero compatible.

El cálculo debe:

- Comparar únicamente respuestas disponibles y criterios aplicables.
- Aplicar una ponderación configurable a cada criterio.
- Mostrar el porcentaje o nivel de compatibilidad y los principales factores que lo explican.
- Actualizarse cuando el usuario modifique sus respuestas o cuando cambien los datos comparados.
- Informar cuando no existan suficientes respuestas para generar un resultado confiable.

### Criterios de aceptación

- Un usuario puede completar y enviar el cuestionario sin perder sus respuestas.
- El sistema no permite enviar un cuestionario incompleto si contiene preguntas obligatorias.
- Después del envío se muestra un resultado de compatibilidad calculado automáticamente.
- Al modificar una respuesta, el resultado se recalcula y se refleja en la interfaz.

## 2. Registro y división proporcional de facturas

### RF-03. Ingresar facturas de servicios

Como usuario, quiero ingresar facturas de servicios para registrar los gastos compartidos de una propiedad.

El sistema debe permitir:

- Registrar el tipo de servicio, proveedor, período de facturación, fecha de vencimiento y monto total.
- Asociar la factura a una propiedad y a sus residentes.
- Adjuntar una imagen o documento de respaldo.
- Editar, eliminar y consultar facturas registradas según los permisos del usuario.
- Mantener un historial de facturas y cambios relevantes.
- Validar que el monto sea positivo y que los datos obligatorios estén completos.

### RF-04. Dividir costos proporcionalmente

El sistema debe calcular cuánto corresponde pagar a cada residente según una regla de distribución seleccionada.

Las reglas deben contemplar, como mínimo:

- División equitativa entre residentes.
- División según porcentaje asignado a cada residente.
- División según los días ocupados durante el período.
- Exclusión de residentes o participantes de un servicio específico.

El sistema debe:

- Mostrar el monto total, la proporción aplicada y el importe individual de cada residente.
- Garantizar que la suma de los importes individuales coincida con el total de la factura, considerando el redondeo monetario.
- Permitir revisar y confirmar el reparto antes de notificarlo.
- Registrar el estado de cada importe: pendiente, pagado o vencido.
- Permitir consultar el detalle de cálculo después de confirmar la división.

### Criterios de aceptación

- Una factura válida puede asociarse a una propiedad y a sus residentes.
- El usuario puede seleccionar una regla de división y visualizar el desglose antes de confirmarlo.
- La suma de las partes coincide con el total de la factura.
- Los residentes pueden consultar cuánto deben pagar y el vencimiento correspondiente.
- Una factura eliminada o modificada conserva un registro de auditoría cuando ya fue repartida.

## 3. Panel de habitaciones y gestión de propiedades

### RF-05. Publicar habitaciones disponibles

Como propietario o administrador, quiero publicar habitaciones disponibles para que otros usuarios puedan encontrarlas y evaluar su compatibilidad.

El panel debe permitir:

- Crear una publicación con título, descripción, fotografías, ubicación, precio, depósito y disponibilidad.
- Indicar servicios incluidos, reglas de convivencia, características de la habitación y espacios compartidos.
- Definir requisitos o preferencias de los residentes.
- Guardar una publicación como borrador.
- Publicar, pausar, editar y retirar una publicación.
- Consultar el estado de cada publicación: borrador, publicada, pausada, reservada o retirada.
- Visualizar las publicaciones propias y filtrar por estado o propiedad.

### RF-06. Gestionar propiedades

El panel debe permitir a propietarios o administradores:

- Crear, editar y archivar propiedades.
- Registrar dirección, descripción, fotografías, cantidad de habitaciones y espacios comunes.
- Gestionar residentes, habitaciones y publicaciones asociadas.
- Consultar ocupación, disponibilidad y gastos registrados por propiedad.
- Asignar roles y permisos de administración según el perfil del usuario.
- Evitar que una propiedad archivada aparezca como disponible para nuevas reservas.

### RF-07. Consultar habitaciones

Los usuarios deben poder:

- Buscar y filtrar habitaciones por ubicación, precio, disponibilidad y características.
- Consultar el detalle de una publicación y sus condiciones de convivencia.
- Ver el nivel de compatibilidad calculado cuando exista información suficiente.
- Identificar si una publicación está disponible, pausada o reservada.

### Criterios de aceptación

- Un usuario autorizado puede crear una propiedad y publicar una habitación asociada.
- Una publicación puede pasar por los estados borrador, publicada, pausada y retirada.
- Los cambios realizados en una propiedad se reflejan en sus habitaciones y publicaciones relacionadas.
- Una habitación retirada o reservada deja de mostrarse como disponible.
- Un usuario sin permisos de administración no puede modificar propiedades ajenas.

## 4. Requisitos generales

### RNF-01. Autenticación y autorización

- El sistema debe identificar a cada usuario mediante autenticación segura.
- Las funciones de propietario, administrador, residente y visitante deben respetar permisos diferenciados.
- Los datos de cuestionarios, facturas y propiedades solo deben estar disponibles para usuarios autorizados.

### RNF-02. Usabilidad

- La interfaz debe ser clara y adaptable a dispositivos móviles y de escritorio.
- Los formularios deben mostrar mensajes de validación comprensibles.
- Los importes deben mostrarse con moneda, separador decimal y redondeo consistentes.

### RNF-03. Trazabilidad y privacidad

- El sistema debe registrar quién creó, modificó o confirmó una factura, reparto, propiedad o publicación.
- La información personal del cuestionario debe tratarse como confidencial.
- Los documentos adjuntos deben almacenarse con acceso restringido.
