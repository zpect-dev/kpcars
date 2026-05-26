---
trigger: always_on
---

# Contexto Principal

Eres un desarrollador experto en Laravel (Backend) y React + Inertia.js (Frontend).
El sistema es un ERP Multi-empresa (Multi-tenant) para la gestión integral de flotas, inversiones, inventario y personal.

# Arquitectura Multi-Tenant (Empresas)

- El sistema permite cambiar el contexto de la empresa activa desde el menú de usuario (dropdown de cierre de sesión).
- El ID de la empresa activa DEBE almacenarse en la sesión (`session('active_company_id')`) y enviarse al frontend globalmente vía el middleware `HandleInertiaRequests`.
- Entidades limitadas por Empresa (Tenant): Vehículos, Inversiones, Cobros, Gastos. DEBEN usar un Global Scope (`TenantScope`) basado en la empresa activa.
- Entidades Globales (No tienen `company_id`): Inventario, Turnos, Revisiones y Personal.
- Relaciones Estructurales: Cada Empresa tiene Inversiones (aprox. 10). Cada Inversión tiene Vehículos (aprox. 10).

# Sistema de Roles y Permisos (RBAC)

Todo el control de acceso DEBE manejarse mediante Laravel Gates/Policies y Middleware. Existen 5 roles definidos:

1. **Administrador**: Acceso total. Puede cambiar de empresa.
2. **Administrativo**: Puede cambiar de empresa. Acceso LIMITADO a: Vehículos, Inventario, Turnos, Revisiones y Personal.
3. **Inversor**: Acceso ÚNICAMENTE a su vista de perfil ("Mi cuenta"). No tiene acceso a dashboards operativos.
4. **Chofer**: NO tiene acceso web. Solo se autentica e interactúa a través de los endpoints de la API móvil.
5. **Mecánico**: Funciones operativas de taller (Mantiene su lógica heredada).
   _Regla de Frontend:_ El renderizado condicional de menús y vistas en React DEBE consumir los permisos expuestos mediante `usePage().props.auth.permissions`.

# Reglas de Negocio Estrictas: Inventario y Transacciones (Event-Driven Stock)

- El stock de `items` NO se edita directamente. Toda alteración del `current_stock` requiere un registro simultáneo en `transactions`.
- Las transacciones son Append-Only (Solo inserción). Para corregir errores, se ingresa un movimiento compensatorio.
- Operaciones Atómicas: La actualización de stock y registro de transacción DEBE ejecutarse en un `DB::transaction()` dentro de una clase `Action`.
- Tipos de Transacción:
    - Ingresos (IN): Reabastecimiento. `license_plate` es nulo.
    - Egresos (OUT): Consumo. Requieren OBLIGATORIAMENTE el `license_plate` del vehículo destino.
- Impedir Stock Negativo: Abortar egresos si la cantidad solicitada supera el `current_stock`.

# Rendimiento y Patrones de Código

- Consultas BD: Prohibido el problema N+1. Utilizar SIEMPRE Eager Loading (`with('relacion')`) en controladores.
- Filtros: Utilizar Query Scopes de Eloquent (ej. `scopeFilterByDate`, `scopeFilterByCompany`).
- Controladores: Mantenerlos "flacos" (Skinny Controllers). La lógica de negocio compleja (cobros, inversiones, transacciones de stock) DEBE ir en clases `Action` o `Service`.
- Pruebas: Cada nueva Action o endpoint crítico (especialmente los financieros de Gastos/Cobros y los de Stock) DEBE incluir su correspondiente Test de Integración en Pest/PHPUnit.
