# Documentación API - App Choferes e Integración Externa

Esta documentación detalla los endpoints expuestos tanto para la aplicación móvil/web de conductores como para la integración automática de turnos desde sistemas externos.

---

## 🔒 Autenticación y Manejo de Sesión

La API utiliza **Laravel Sanctum**. Todas las rutas protegidas deben incluir el siguiente header:
```http
Authorization: Bearer {tu-token-sanctum}
Accept: application/json
```

### 1. Iniciar Sesión (Login)

Autentica al usuario y devuelve el token de acceso. **Solo los usuarios habilitados con rol `chofer` pueden usar este endpoint.**

- **Endpoint:** `POST /api/login`
- **Auth Requerida:** No

**Payload (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `dni` | `string` | **Sí** | Documento del conductor. |
| `password` | `string` | **Sí** | Contraseña de acceso. |

**Respuesta Exitosa (200 OK):**
```json
{
  "token": "1|abcdef123456...",
  "must_change_password": true,
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "dni": "12345678",
    "role": "chofer"
  }
}
```

> **Importante:** Si `must_change_password` es `true`, el chófer está obligado a cambiar su clave inicial (usando el endpoint de Cambio de Contraseña). Las demás rutas de la API le devolverán error hasta que lo haga.

### 2. Cerrar Sesión (Logout)

Invalida y elimina el token del dispositivo actual.

- **Endpoint:** `POST /api/logout`
- **Auth Requerida:** Sí

**Respuesta (200 OK):**
```json
{
  "message": "Sesión cerrada correctamente."
}
```

### 3. Cambiar Contraseña (Change Password)

Actualiza la contraseña del usuario. Tras realizar esta acción, el token actual será destruido y el endpoint te entregará uno completamente nuevo.

- **Endpoint:** `POST /api/change-password`
- **Auth Requerida:** Sí

**Payload (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `current_password` | `string` | *A veces* | Requerido solo en un cambio voluntario. Si es el "cambio de clave obligatorio en el primer login", se debe omitir este campo. |
| `password` | `string` | **Sí** | La nueva contraseña (mínimo 8 caracteres). |
| `password_confirmation` | `string` | **Sí** | Confirmación (debe ser idéntico a `password`). |

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Contraseña actualizada correctamente.",
  "token": "2|nuevotokendesanctum..."
}
```
*(Debes reemplazar el token guardado en el LocalStorage de la app por este nuevo `token`).*

---

## 👤 Perfil del Conductor

### Obtener Datos del Perfil (Me)

Devuelve la información estática del chofer autenticado.

- **Endpoint:** `GET /api/me`
- **Auth Requerida:** Sí (además requiere haber cambiado la clave obligatoria)

**Respuesta Exitosa (200 OK):**
```json
{
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "dni": "12345678",
    "role": "chofer"
  }
}
```

---

## 📅 Integración de Turnos Externos

### 1. Sincronización de Turnos (Pull)

Obtiene el listado de turnos de todos los vehículos en un rango de fechas especificado.

- **Endpoint:** `GET /api/sync-turnos`
- **Auth Requerida:** Sí

**Query Params:**
- `from` (date, **requerido**): Fecha de inicio (YYYY-MM-DD).
- `to` (date, **requerido**): Fecha de fin. Debe ser igual o posterior a `from`.

**Respuesta Exitosa (200 OK):**
```json
{
  "count": 2,
  "appointments": [
    {
      "id": 1,
      "service": "Cambio de aceite",
      "type": "normal",
      "license_plate": "ABC123",
      "applicant": "Juan Pérez",
      "scheduled_date": "2026-04-20",
      "status": "agendado",
      "created_at": "2026-04-18T10:30:00.000000Z"
    }
  ]
}
```

### 2. Creación de Turnos Externos (Push)

Permite agendar un turno desde un sistema externo o web pública. Valida disponibilidad (máximo 4 turnos normales diarios) y prohíbe domingos.

- **Endpoint:** `POST /api/turnos-externos`
- **Auth Requerida:** Sí

**Payload (JSON):**
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `service` | `string` | **Sí** | Descripción del servicio. |
| `license_plate` | `string` | **Sí** | Patente (se convierte a mayúsculas). |
| `applicant` | `string` | **Sí** | Nombre del solicitante. |
| `preferred_date` | `date` | **Sí** | Fecha solicitada (YYYY-MM-DD). |
| `type` | `enum` | No | Opciones: `"normal"` o `"emergencia"`. Default: `"normal"`. |

**Respuesta Exitosa (201 Created):**
```json
{
  "message": "Turno agendado exitosamente para el día 22/04/2026.",
  "appointment": {
    "id": 3,
    "service": "Alineación y balanceo",
    "license_plate": "KPC987",
    "applicant": "Carlos Méndez",
    "scheduled_date": "2026-04-22T00:00:00.000000Z",
    "type": "normal",
    "status": "agendado"
  }
}
```

**Respuestas de Error (422 Unprocessable Entity):**
- **Cupos Llenos:** `{"message": "No hay cupos normales disponibles para esta fecha. Puede solicitar un turno de emergencia."}`
- **Domingos:** `{"message": "El taller no atiende los días domingo. Por favor seleccione otro día."}`
