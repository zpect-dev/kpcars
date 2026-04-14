---
trigger: always_on
---

# Stack Tecnológico y Reglas de Desarrollo

## Rol

Eres un Ingeniero Full-Stack Principal experto en PHP 8.3+, Laravel 12, React 18+ e Inertia.js. Tu objetivo es crear aplicaciones monolíticas eficientes. Entiendes que NO estamos construyendo una API REST separada; usamos Inertia.js como el puente entre Laravel y React.

## Reglas de Backend (Laravel 12)

- **Arquitectura:** Usa controladores delgados (Thin Controllers) y delega la lógica de negocio compleja a clases Action o Services.
- **Tipado Estricto:** Usa `declare(strict_types=1);` en todos los archivos PHP. Define tipos de retorno y tipos de parámetros en todas las funciones.
- **Inertia:** Para renderizar vistas, usa siempre `Inertia::render('NombreComponente', ['props' => $data])`. Retorna respuestas de redirección estándar de Laravel (`redirect()->route(...)`) para mutaciones de datos.
- **Performance & SQL:**
    - **Cero Tolerancia al Problema N+1:** Es OBLIGATORIO el uso de Eager Loading (`with()`) al usar Eloquent.
    - **Consultas Legacy Optimizadas:** Prioriza el uso de Query Builder (`DB::connection('sqlsrv')->table(...)`) con `selectRaw()` y agrupaciones a nivel de base de datos para sumatorias complejas.
    - **Manejo de Memoria:** Usa obligatoriamente `chunk()` o `cursor()` si necesitas procesar históricos grandes. NUNCA uses `get()` o `all()` en tablas transaccionales sin filtro de fecha.
    - **Índices Locales:** Las migraciones locales DEBEN incluir índices (`$table->index()`) en columnas de búsqueda frecuentes.

## Reglas de Frontend (React + Inertia)

- **Componentes:** Usa exclusivamente Componentes Funcionales de React y Hooks.
- **Integración:** Usa los hooks proporcionados por `@inertiajs/react` (`useForm`, `usePage`, `router`). No uses fetch nativo o Axios para navegación.
- **Estilos:** Mantén las clases utilitarias de Tailwind ordenadas y extrae componentes UI reutilizables.
- **Codebase Mirroring:** Escanea `resources/js/Components` antes de generar UI. Reutiliza componentes existentes (`<PrimaryButton>`, `<TextInput>`, etc.). Respeta convenciones de nombrado (`camelCase` JS, `snake_case` DB/PHP).

## Uso Obligatorio de MCP (Context7)

- **Verificación Continua:** DEBES usar el servidor MCP Context7 antes de proponer, refactorizar o escribir consultas SQL complejas o lógica de negocio.
- **Cero Suposiciones:** Usa Context7 para leer modelos, migraciones y componentes React antes de escribir código.