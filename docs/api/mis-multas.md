# API — Multas del chofer

Endpoint para que el chofer autenticado consulte, desde la app móvil / página externa,
las multas que le fueron imputadas: su **monto** y el **PDF** de la infracción.

## `GET /api/mis-multas`

Devuelve todas las multas imputadas al chofer autenticado (por `conductor_id`),
ordenadas de la más reciente a la más antigua.

### Autenticación

Requiere token de **Sanctum** (Bearer) y que el chofer ya haya cambiado su contraseña
inicial (`must_change_password = false`), igual que el resto de endpoints del chofer.

```
Authorization: Bearer <token>
Accept: application/json
```

El token se obtiene con `POST /api/login` (DNI + contraseña).

### Request

Sin parámetros. El chofer se toma del token; solo ve **sus** multas.

```http
GET /api/mis-multas HTTP/1.1
Host: <host>
Authorization: Bearer 12|abcd...
Accept: application/json
```

### Respuesta `200 OK`

```json
{
  "multas": [
    {
      "id": 42,
      "fecha": "2026-05-01",
      "fecha_vencimiento": "2026-06-01",
      "descripcion": "Exceso de velocidad en Av. Libertador",
      "jurisdiccion": "CABA",
      "punto_rojo": false,
      "patente": "ABC123",
      "monto": 20000,
      "monto_adeudado": 10000,
      "cobrado": false,
      "pdf_url": "https://<host>/storage/multas/abcd1234.pdf"
    }
  ],
  "total_adeudado": 10000
}
```

### Campos

| Campo               | Tipo             | Descripción                                                                                     |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `id`                | int              | Identificador de la multa.                                                                       |
| `fecha`             | string (`Y-m-d`) | Fecha de la infracción.                                                                          |
| `fecha_vencimiento` | string \| null   | Fecha límite para el descuento (ver `monto_adeudado`). `null` en multas de punto rojo.          |
| `descripcion`       | string           | Detalle de la infracción.                                                                        |
| `jurisdiccion`      | string           | `CABA` o `GBA`.                                                                                  |
| `punto_rojo`        | bool             | Multa de seguimiento sin importe. Si es `true`, `monto` y `monto_adeudado` son `0`.             |
| `patente`           | string \| null   | Patente del vehículo de la infracción.                                                           |
| `monto`             | number           | Importe **base** de la multa.                                                                    |
| `monto_adeudado`    | number           | Saldo que el chofer todavía debe. Ver reglas abajo.                                              |
| `cobrado`           | bool             | `true` si la empresa ya le cobró la multa por completo al chofer.                               |
| `pdf_url`           | string \| null   | URL pública al PDF de la multa. `null` si no se adjuntó PDF.                                     |
| `total_adeudado`    | number           | Suma de `monto_adeudado` de todas las multas del chofer.                                         |

### Reglas de `monto_adeudado`

- Multa **de punto rojo** o ya **cobrada** → `0`.
- **CABA** con `fecha_vencimiento` en el futuro (o de hoy) → 50% de descuento sobre el
  importe pendiente.
- En los demás casos → importe pendiente completo.
- Contempla pagos parciales ya registrados por la empresa (descuenta lo cobrado).

### Errores

| Código             | Motivo                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `401 Unauthorized` | Falta el token o es inválido.                                                            |
| `403 Forbidden`    | El chofer aún no cambió su contraseña inicial (`EnsurePasswordChanged`).                 |

### Notas

- El `pdf_url` apunta al disco público (`/storage/...`), accesible directamente por el
  cliente para descargar o previsualizar el PDF.
- La multa es una entidad **global** (abarca vehículos de todas las empresas); no se filtra
  por empresa activa.
