---
trigger: always_on
---

## Reglas de Negocio Estrictas (Dominio: Inventario Interno Rent a Car)
Naturaleza del Sistema: Es un software de control operativo interno. NO se manejan precios, facturación, impuestos ni pasarelas de pago. El único propósito es la trazabilidad física de repuestos y consumibles.

Inmutabilidad y Trazabilidad (Event-Driven Stock): - Las cantidades de stock no se editan directamente. Toda alteración del current_stock en la tabla items DEBE estar justificada por un registro simultáneo en la tabla transactions.

El historial de transacciones es Append-Only (Solo inserción). Las transacciones no se editan ni se eliminan por interfaz para mantener la auditoría. Si hay un error, se ingresa un movimiento compensatorio.

Esta operación (Actualizar Stock + Registrar Transacción) DEBE ser atómica, ejecutada siempre dentro de un bloque DB::transaction() manejado por una clase de tipo Action.

Condicionales de Transacciones:

Ingresos (IN): Representan reabastecimiento. La patente (license_plate) es nula (null).

Egresos (OUT): Representan consumo. Requieren OBLIGATORIAMENTE la patente (license_plate) del vehículo destino en el Request.

El sistema DEBE abortar cualquier intento de egreso si la cantidad solicitada es mayor al current_stock disponible (impedir stock negativo).

Sistema de Alertas (Flash Data): - Toda vez que un egreso (OUT) deje un repuesto con la condición current_stock <= min_stock, el backend (Laravel) DEBE adjuntar un mensaje de estado en la respuesta de Inertia (ej. return redirect()->back()->with('warning', 'Alerta: Stock mínimo alcanzado para [Item]');).

El frontend (React) debe estar preparado para interceptar estos mensajes Flash a través de usePage().props y mostrar notificaciones tipo Toast.

Filtros de Búsqueda y Rendimiento:

La vista del historial de transacciones debe permitir combinaciones de filtros (por patente, por rango de fecha, por artículo).

Para esto, utiliza Query Scopes en Eloquent (ej. scopeFilterByDate, scopeFilterByLicensePlate).

Al mostrar el historial, es estrictamente obligatorio cargar la relación del artículo usando Eager Loading (Transaction::with('item')) para evitar el problema N+1 al renderizar la tabla en React.