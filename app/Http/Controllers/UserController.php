<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\SaveUserDocumentsAction;
use App\Enums\ChoferEventoTipo;
use App\Enums\DepositoMoneda;
use App\Enums\UserRole;
use App\Models\Asignacion;
use App\Models\ChoferEvento;
use App\Models\Empresa;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserDeposito;
use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Inertia\Response;
class UserController extends Controller
{
    /**
     * Reglas de validación para los documentos (licencia y DNI).
     *
     * Por documento: o un PDF (con ambas caras) o dos imágenes (frente + dorso),
     * nunca ambas modalidades. Si llega una imagen, deben llegar las dos.
     *
     * @return array<string, array<int, string>>
     */
    private function documentRules(): array
    {
        $rules = [];

        foreach (['licencia', 'dni'] as $t) {
            // Frente y dorso son independientes: se puede subir uno hoy y el
            // otro más adelante. 'prohibits' evita mezclar PDF con imágenes.
            $rules["{$t}_pdf"]    = ['nullable', 'file', 'mimes:pdf', 'max:10240', "prohibits:{$t}_frente,{$t}_dorso"];
            $rules["{$t}_frente"] = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'];
            $rules["{$t}_dorso"]  = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'];
        }

        return $rules;
    }

    /**
     * Reemplaza los depósitos del usuario por los enviados (uno o varios,
     * cada uno con su moneda).
     *
     * @param  array<int, array{monto: mixed, moneda: string}>  $depositos
     */
    private function syncDepositos(User $user, array $depositos): void
    {
        $user->depositos()->delete();

        foreach ($depositos as $d) {
            $user->depositos()->create([
                'monto' => $d['monto'],
                'moneda' => $d['moneda'],
            ]);
        }
    }

    /**
     * Actualiza la cotización global del dólar (ARS por 1 USD), usada por el
     * filtro de depósito bajo.
     */
    public function updateCotizacion(Request $request)
    {
        $this->authorize('create', User::class);

        $validated = $request->validate([
            'cotizacion_dolar' => ['required', 'numeric', 'min:0'],
        ]);

        Setting::set('cotizacion_dolar', (string) $validated['cotizacion_dolar']);

        return redirect()->back()->with('success', 'Cotización del dólar actualizada.');
    }

    public function store(Request $request, SaveUserDocumentsAction $documentos)
    {
        $this->authorize('create', User::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', 'unique:users,dni'],
            'role' => ['required', Rule::enum(UserRole::class)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresas' => ['nullable', 'array'],
            'empresas.*' => ['integer', 'exists:empresas,id'],
            'empresa_restringida_id' => ['nullable', 'integer', 'exists:empresas,id'],
            'depositos' => ['nullable', 'array'],
            'depositos.*.monto' => ['required', 'numeric', 'min:0.01', 'max:99999999999.99'],
            'depositos.*.moneda' => ['required', Rule::enum(DepositoMoneda::class)],
            ...$this->documentRules(),
        ]);

        $photoPath = null;
        if ($request->hasFile('profile_photo')) {
            $photoPath = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        // La restricción de empresa sólo aplica a admin/administrativo.
        $esGestor = in_array($validated['role'], [UserRole::ADMINISTRADOR->value, UserRole::ADMINISTRATIVO->value], true);

        // Automatización de contraseña: Primera letra del nombre (Mayúscula) + DNI
        $generatedPassword = strtoupper(mb_substr($validated['name'], 0, 1)).$validated['dni'];

        $user = User::create([
            'name' => $validated['name'],
            'dni' => $validated['dni'],
            'role' => $validated['role'],
            'password' => Hash::make($generatedPassword),
            'must_change_password' => true,
            'correo' => $validated['correo'] ?? null,
            'telefono' => $validated['telefono'] ?? null,
            'fecha_vencimiento_licencia' => $validated['fecha_vencimiento_licencia'] ?? null,
            'profile_photo_path' => $photoPath,
            'empresa_restringida_id' => $esGestor ? ($validated['empresa_restringida_id'] ?? null) : null,
        ]);

        $this->syncDepositos($user, $validated['depositos'] ?? []);

        // Pivot empresa_user: sólo aplica al rol inversor.
        if ($validated['role'] === UserRole::INVERSOR->value) {
            $empresaIds = $validated['empresas'] ?? [];
            // Default si el form no envió nada: la empresa activa de la sesión.
            if (empty($empresaIds) && session('active_company_id')) {
                $empresaIds = [(int) session('active_company_id')];
            }
            if (! empty($empresaIds)) {
                $user->empresas()->sync($empresaIds);
                // Setea empresa_default_id para que el próximo login arranque ahí.
                $user->forceFill(['empresa_default_id' => (int) $empresaIds[0]])->save();
            }
        }

        $documentos->execute($user, $request);

        // Auditoría: registra el alta del chofer para el reporte de movimientos.
        if ($user->isChofer()) {
            ChoferEvento::create([
                'user_id' => $user->id,
                'tipo' => ChoferEventoTipo::ALTA,
                'registrado_por' => auth()->id(),
            ]);
        }

        return redirect()->back()->with('success', 'Usuario creado correctamente.');
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $isChoferFilter = $request->query('role') === 'chofer';
        $isInversorFilter = $request->query('role') === 'inversor';
        $empresaActiva = session('active_company_id');

        $choferCounts = null;
        if ($isChoferFilter) {
            $baseChofer = User::where('role', 'chofer');
            $choferCounts = [
                'activos'   => (clone $baseChofer)->where('inactivo', false)->count(),
                'inactivos' => (clone $baseChofer)->where('inactivo', true)->count(),
            ];
        }

        $query = User::orderBy('name')
            ->when($request->query('role'), function ($query, $role) {
                $query->where('role', $role);
            })
            // Cuando se listan inversores, sólo aparecen los que pertenecen a la
            // empresa activa (via pivot empresa_user).
            ->when($isInversorFilter && $empresaActiva, function ($query) use ($empresaActiva) {
                $query->whereHas('empresas', fn ($q) => $q->where('empresas.id', $empresaActiva));
            })
            ->when($request->query('status'), function ($query, $status) {
                if ($status === 'activos') {
                    $query->where('inactivo', false);
                } elseif ($status === 'inactivos') {
                    $query->where('inactivo', true);
                }
            });

        if ($isChoferFilter) {
            // Personal es global: el carro asignado al chofer puede ser de
            // cualquier empresa (bypass TenantScope en la relación). Usamos
            // vehiculoAsignado (vehiculos.user_id) — misma fuente que el dashboard.
            $query->with([
                'vehiculoAsignado' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class),
                'choferEventos' => fn ($q) => $q->orderByDesc('created_at')->orderByDesc('id'),
                'depositos',
            ]);
        }

        if ($isInversorFilter) {
            // Personal muestra y configura las inversiones del inversor con su
            // deuda (cross-empresa: bypass del TenantScope en Inversion).
            $query->with([
                'empresas:id,nombre',
                'inversiones' => fn ($q) => $q
                    ->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                    ->with('empresa:id,nombre'),
            ]);
        }

        $users = $query
            ->get(['id', 'name', 'dni', 'role', 'inactivo', 'estado_actualizado_en', 'created_at', 'correo', 'telefono', 'fecha_vencimiento_licencia', 'profile_photo_path', 'empresa_default_id', 'empresa_restringida_id', 'licencia_pdf_path', 'licencia_frente_path', 'licencia_dorso_path', 'dni_pdf_path', 'dni_frente_path', 'dni_dorso_path'])
            ->append(['profile_photo_url', 'documentos']);

        if ($isChoferFilter) {
            $today = now()->startOfDay();
            $users = $users->map(function (User $user) use ($today) {
                $arr = collect($user->toArray())->except(['vehiculo_asignado', 'chofer_eventos'])->all();
                $vehiculo = $user->vehiculoAsignado;
                $vencimientoLicencia = $user->fecha_vencimiento_licencia;

                $arr['vehiculo'] = $vehiculo ? [
                    'patente' => $vehiculo->patente,
                    'marca'   => $vehiculo->marca,
                    'modelo'  => $vehiculo->modelo,
                    'precio'  => $vehiculo->precio,
                ] : null;
                $arr['depositos'] = $user->depositos->map(fn (UserDeposito $d) => [
                    'monto' => (float) $d->monto,
                    'moneda' => $d->moneda->value,
                ])->values();
                $arr['licencia_por_vencer'] = $vencimientoLicencia !== null
                    && $vencimientoLicencia->gte($today)
                    && $vencimientoLicencia->lte($today->copy()->addDays(30));
                $arr['sin_licencia'] = $vencimientoLicencia === null;
                $arr['falta_foto'] = $user->profile_photo_path === null;

                // Fechas de alta/baja desde la auditoría (chofer_eventos), misma
                // fuente que el reporte. Se toma el último evento de cada tipo.
                $eventos = $user->choferEventos; // ya ordenados desc por la relación
                $arr['alta_fecha'] = $eventos->firstWhere('tipo', \App\Enums\ChoferEventoTipo::ALTA)?->created_at?->toISOString();
                $arr['baja_fecha'] = $eventos->firstWhere('tipo', \App\Enums\ChoferEventoTipo::BAJA)?->created_at?->toISOString();

                return $arr;
            });
        }

        $empresas = Empresa::orderBy('nombre')->get(['id', 'nombre']);

        $roles = collect(UserRole::cases())->map(fn ($role) => [
            'value' => $role->value,
            'label' => $role->label(),
        ]);

        $filterRoles = collect(UserRole::cases())->map(fn ($role) => [
            'value' => $role->value,
            'label' => $role->pluralLabel(),
        ]);

        $monedas = collect(DepositoMoneda::cases())->map(fn ($m) => [
            'value' => $m->value,
            'label' => $m->label(),
            'symbol' => $m->symbol(),
        ]);

        // Inversiones disponibles para configurar inversores desde Personal
        // (sólo admin; cross-empresa, agrupadas por empresa en el frontend).
        $inversionesDisponibles = null;
        if ($isInversorFilter && Gate::allows('manage-inversiones')) {
            $inversionesDisponibles = \App\Models\Inversion::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->with('empresa:id,nombre')
                ->get(['id', 'nombre', 'empresa_id'])
                ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->map(fn ($inv) => [
                    'id' => $inv->id,
                    'nombre' => $inv->nombre,
                    'empresa' => $inv->empresa,
                ]);
        }

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => $roles,
            'filterRoles' => $filterRoles,
            'empresas' => $empresas,
            'monedas' => $monedas,
            'choferCounts' => $choferCounts,
            'cotizacionDolar' => (float) (Setting::get('cotizacion_dolar') ?? 0),
            'inversionesDisponibles' => $inversionesDisponibles,
        ]);
    }

    /**
     * Sincroniza las inversiones de un inversor desde Personal: a qué
     * inversiones pertenece, si financia y cuánta deuda tiene en cada una.
     */
    public function syncInversiones(Request $request, User $user)
    {
        Gate::authorize('manage-inversiones');

        if ($user->role !== UserRole::INVERSOR) {
            return back()->with('error', 'El usuario seleccionado no tiene rol de inversor.');
        }

        $validated = $request->validate([
            'inversiones' => ['present', 'array'],
            'inversiones.*.inversion_id' => ['required', 'integer', 'distinct', 'exists:inversiones,id'],
            'inversiones.*.es_financiador' => ['required', 'boolean'],
            'inversiones.*.deuda' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
        ]);

        $items = collect($validated['inversiones'] ?? []);

        $invalido = $items->first(fn ($i) => $i['es_financiador'] && (float) $i['deuda'] > 0);
        if ($invalido) {
            return back()->with('error', 'Un inversor no puede ser financiador y deudor al mismo tiempo.');
        }

        DB::transaction(function () use ($user, $items) {
            // Validar el cupo de cada inversión que se agrega (max 6 inversores).
            $actuales = $user->inversiones()
                ->withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->pluck('inversiones.id')
                ->all();

            $nuevas = $items->pluck('inversion_id')->map(fn ($id) => (int) $id)
                ->diff($actuales);

            foreach ($nuevas as $inversionId) {
                $count = DB::table('inversion_user')
                    ->where('inversion_id', $inversionId)
                    ->lockForUpdate()
                    ->count();

                if ($count >= \App\Models\Inversion::MAX_INVERSORES) {
                    $nombre = DB::table('inversiones')->where('id', $inversionId)->value('nombre');
                    throw new \RuntimeException(
                        "La inversión \"{$nombre}\" ya tiene el máximo de ".\App\Models\Inversion::MAX_INVERSORES.' inversores.'
                    );
                }
            }

            $sync = $items->mapWithKeys(fn ($i) => [
                (int) $i['inversion_id'] => [
                    'es_financiador' => (bool) $i['es_financiador'],
                    'deuda' => round((float) $i['deuda'], 2),
                ],
            ])->toArray();

            $user->inversiones()->sync($sync);
        });

        return back()->with('success', 'Inversiones del inversor actualizadas.');
    }

    public function updateRole(Request $request, User $user)
    {
        // UserPolicy::updateRole bloquea self-edit (mismo id).
        $this->authorize('updateRole', $user);

        $validated = $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        $payload = ['role' => $validated['role']];
        if ($validated['role'] !== UserRole::INVERSOR->value) {
            $payload['empresa_id'] = null;
        }

        $user->update($payload);

        return redirect()->back()->with('success', 'Rol actualizado correctamente.');
    }

    public function toggleStatus(User $user)
    {
        // UserPolicy::toggleStatus bloquea self-edit.
        $this->authorize('toggleStatus', $user);

        $newInactivoStatus = ! $user->inactivo;

        DB::transaction(function () use ($user, $newInactivoStatus) {
            $user->update([
                'inactivo' => $newInactivoStatus,
                'estado_actualizado_en' => now(),
            ]);

            // Auditoría: registra alta (reactivación) o baja (desactivación) del
            // chofer para el reporte de movimientos de personal.
            if ($user->isChofer()) {
                ChoferEvento::create([
                    'user_id' => $user->id,
                    'tipo' => $newInactivoStatus ? ChoferEventoTipo::BAJA : ChoferEventoTipo::ALTA,
                    'registrado_por' => auth()->id(),
                ]);
            }

            // Si el usuario es desactivado, quitar asignaciones de vehículos
            if ($newInactivoStatus) {
                // Cerrar las asignaciones activas en el historial
                Asignacion::where('conductor_id', $user->id)
                    ->whereNull('fecha_fin')
                    ->update(['fecha_fin' => now()]);

                // Desvincular vehículos que estuvieran a su nombre.
                // Sin el TenantScope: el usuario puede tener vehículos en
                // otras empresas y todos deben quedar desasignados.
                Vehiculo::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                    ->where('user_id', $user->id)
                    ->update(['user_id' => null]);
            }
        });

        $message = $newInactivoStatus ? 'Usuario desactivado y sus vehículos fueron desasignados.' : 'Usuario activado correctamente.';

        return redirect()->back()->with('success', $message);
    }

    public function update(Request $request, User $user, SaveUserDocumentsAction $documentos)
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'dni' => ['required', 'string', 'max:20', Rule::unique('users')->ignore($user->id)],
            'correo' => ['nullable', 'email', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'fecha_vencimiento_licencia' => ['nullable', 'date'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
            'empresas' => ['nullable', 'array'],
            'empresas.*' => ['integer', 'exists:empresas,id'],
            'empresa_restringida_id' => ['nullable', 'integer', 'exists:empresas,id'],
            'depositos' => ['nullable', 'array'],
            'depositos.*.monto' => ['required', 'numeric', 'min:0.01', 'max:99999999999.99'],
            'depositos.*.moneda' => ['required', Rule::enum(DepositoMoneda::class)],
            'alta_fecha' => ['nullable', 'date'],
            'baja_fecha' => ['nullable', 'date'],
            ...$this->documentRules(),
        ]);

        // Las fechas de alta/baja no son columnas del usuario: se aplican a la
        // auditoría (chofer_eventos) más abajo, no al mass-assignment.
        $altaFecha = $validated['alta_fecha'] ?? null;
        $bajaFecha = $validated['baja_fecha'] ?? null;
        unset($validated['alta_fecha'], $validated['baja_fecha']);

        // Los depósitos no son columnas del usuario: se sincronizan aparte.
        $depositos = $validated['depositos'] ?? [];
        unset($validated['depositos']);

        if ($request->hasFile('profile_photo')) {
            if ($user->profile_photo_path) {
                Storage::disk('public')->delete($user->profile_photo_path);
            }
            $validated['profile_photo_path'] = $request->file('profile_photo')->store('profile-photos', 'public');
        }

        // Los archivos de documentos los persiste la Action, no el mass-assignment.
        unset(
            $validated['licencia_pdf'], $validated['licencia_frente'], $validated['licencia_dorso'],
            $validated['dni_pdf'], $validated['dni_frente'], $validated['dni_dorso'],
        );

        // El campo empresas no se persiste directamente en el modelo.
        $empresaIds = $validated['empresas'] ?? null;
        unset($validated['empresas']);

        // La restricción de empresa sólo aplica a admin/administrativo.
        if (! $user->isAdminOrAdministrativo()) {
            $validated['empresa_restringida_id'] = null;
        }

        $user->update($validated);

        $this->syncDepositos($user, $depositos);

        // Sincroniza pivot empresa_user para inversor (no aplica a otros roles).
        if ($user->isInversor() && $empresaIds !== null) {
            $user->empresas()->sync($empresaIds);

            // Si empresa_default_id ya no está dentro del nuevo set, lo realineamos.
            if (! in_array((int) $user->empresa_default_id, array_map('intval', $empresaIds), true)) {
                $user->forceFill([
                    'empresa_default_id' => ! empty($empresaIds) ? (int) $empresaIds[0] : null,
                ])->save();
            }
        }

        $documentos->execute($user, $request);

        // Ajuste manual de las fechas de alta/baja (auditoría del reporte). Sólo
        // para choferes; modifica el último evento de cada tipo conservando la
        // hora original. Si no existe un evento de alta, se crea.
        if ($user->isChofer() && ($altaFecha !== null || $bajaFecha !== null)) {
            $this->ajustarFechaEvento($user, ChoferEventoTipo::ALTA, $altaFecha, crearSiFalta: true);
            $this->ajustarFechaEvento($user, ChoferEventoTipo::BAJA, $bajaFecha, crearSiFalta: false);
        }

        return redirect()->back()->with('success', 'Usuario actualizado correctamente.');
    }

    /**
     * Reescribe la fecha (created_at) del último evento de auditoría del tipo dado
     * para un chofer, conservando la hora original. Si no existe y $crearSiFalta es
     * true, lo crea con la fecha indicada. Valores null no hacen nada.
     */
    private function ajustarFechaEvento(User $user, ChoferEventoTipo $tipo, ?string $fecha, bool $crearSiFalta): void
    {
        if ($fecha === null) {
            return;
        }

        $evento = $user->choferEventos()
            ->where('tipo', $tipo)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        if ($evento === null) {
            if (! $crearSiFalta) {
                return;
            }
            $evento = new ChoferEvento(['user_id' => $user->id, 'tipo' => $tipo, 'registrado_por' => auth()->id()]);
            $evento->user_id = $user->id;
        }

        // Conserva la hora del evento existente; para uno nuevo usa la hora actual.
        $hora = ($evento->created_at ?? now())->format('H:i:s');
        $nuevaFecha = \Illuminate\Support\Carbon::parse($fecha)->setTimeFromTimeString($hora);

        $evento->created_at = $nuevaFecha;
        $evento->save();
    }

    public function asignaciones(User $user): Response
    {
        $this->authorize('viewAsignaciones', $user);

        $asignaciones = Asignacion::where('conductor_id', $user->id)
            // Vehículo global: la patente se muestra sin importar la empresa activa
            // (un chofer puede haber tenido autos de distintas empresas).
            ->with(['vehiculo' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class), 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'vehiculo' => $a->vehiculo ? [
                    'id' => $a->vehiculo->id,
                    'patente' => $a->vehiculo->patente,
                    'marca' => $a->vehiculo->marca,
                    'modelo' => $a->vehiculo->modelo,
                    'anio' => $a->vehiculo->anio,
                ] : null,
                'asignado_por' => $a->asignadoPor?->name,
                'fecha_inicio' => $a->fecha_inicio?->toISOString(),
                'fecha_fin' => $a->fecha_fin?->toISOString(),
            ]);

        return Inertia::render('Users/Asignaciones', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'dni' => $user->dni,
                'role' => $user->role,
            ],
            'asignaciones' => $asignaciones,
        ]);
    }

    public function asignacionesPdf(User $user): \Illuminate\Http\Response
    {
        $this->authorize('viewAsignaciones', $user);

        $asignaciones = Asignacion::where('conductor_id', $user->id)
            // Vehículo global (sin TenantScope): la patente se ve aunque el auto
            // sea de otra empresa.
            ->with(['vehiculo' => fn ($q) => $q->withoutGlobalScope(\App\Models\Scopes\TenantScope::class), 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get();

        $pdf = Pdf::loadView('pdf.user-asignaciones', compact('user', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$user->dni}-".now()->format('Y-m-d').'.pdf');
    }

    /**
     * Exporta a PDF el listado de choferes respetando los filtros de la vista:
     * estado (activos/inactivos), búsqueda (nombre/DNI) y la alerta seleccionada.
     */
    public function choferesPdf(Request $request): \Illuminate\Http\Response
    {
        $this->authorize('viewAny', User::class);

        $status = $request->query('status'); // activos | inactivos | null
        $q = trim((string) $request->query('q', ''));
        $alert = $request->query('alert'); // ver switch de más abajo

        $today = now()->startOfDay();
        $en30 = $today->copy()->addDays(30);
        $cotizacion = (float) (Setting::get('cotizacion_dolar') ?? 0);

        $choferes = User::where('role', UserRole::CHOFER->value)
            ->when($status === 'activos', fn ($qq) => $qq->where('inactivo', false))
            ->when($status === 'inactivos', fn ($qq) => $qq->where('inactivo', true))
            ->with([
                'vehiculoAsignado' => fn ($qq) => $qq->withoutGlobalScope(\App\Models\Scopes\TenantScope::class),
                'depositos',
            ])
            ->orderBy('name')
            ->get();

        $filas = $choferes->map(function (User $u) use ($today, $en30, $cotizacion) {
            $venc = $u->fecha_vencimiento_licencia;
            $veh = $u->vehiculoAsignado;
            $depTotalArs = $u->depositos->sum(fn (UserDeposito $d) => $d->moneda === DepositoMoneda::USD
                ? (float) $d->monto * $cotizacion
                : (float) $d->monto);

            return [
                'name' => $u->name,
                'dni' => $u->dni,
                'telefono' => $u->telefono,
                'correo' => $u->correo,
                'inactivo' => $u->inactivo,
                'venc_licencia' => $venc?->format('d/m/Y'),
                'depositos' => $u->depositos->map(fn (UserDeposito $d) => $d->moneda->value.' '
                    .number_format((float) $d->monto, 0, ',', '.'))->all(),
                'vehiculo' => $veh?->patente,
                // Flags para replicar los filtros de alerta de la vista.
                '_licencia_vencida' => $venc !== null && $venc->lt($today),
                '_licencia_por_vencer' => $venc !== null && $venc->gte($today) && $venc->lte($en30),
                '_sin_licencia' => $venc === null,
                '_falta_foto' => $u->profile_photo_path === null,
                '_falta_doc_dni' => $u->dni_frente_path === null || $u->dni_dorso_path === null,
                '_falta_doc_licencia' => $u->licencia_frente_path === null && $u->licencia_pdf_path === null,
                // Combinado: le falta DNI, licencia o foto de perfil.
                '_falta_docs' => ($u->dni_frente_path === null || $u->dni_dorso_path === null)
                    || ($u->licencia_frente_path === null && $u->licencia_pdf_path === null)
                    || $u->profile_photo_path === null,
                '_falta_telefono' => empty($u->telefono),
                '_falta_correo' => empty($u->correo),
                '_sin_deposito' => $u->depositos->isEmpty(),
                '_deposito_bajo' => $veh !== null && (float) $veh->precio > 0 && $depTotalArs < 1.5 * (float) $veh->precio,
            ];
        });

        // Búsqueda por nombre / DNI.
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $filas = $filas->filter(fn (array $f) => str_contains(mb_strtolower($f['name']), $needle)
                || str_contains(mb_strtolower($f['dni']), $needle));
        }

        // Filtro de alerta (mismo criterio que la vista).
        $flag = match ($alert) {
            'licencia_vencida' => '_licencia_vencida',
            'licencia_por_vencer' => '_licencia_por_vencer',
            'sin_licencia' => '_sin_licencia',
            'falta_foto' => '_falta_foto',
            'falta_docs' => '_falta_docs',
            'falta_doc_dni' => '_falta_doc_dni',
            'falta_doc_licencia' => '_falta_doc_licencia',
            'falta_telefono' => '_falta_telefono',
            'falta_correo' => '_falta_correo',
            'falta_deposito' => '_sin_deposito',
            'deposito_bajo' => '_deposito_bajo',
            default => null,
        };
        if ($flag !== null) {
            $filas = $filas->filter(fn (array $f) => $f[$flag] === true);
        }

        $filas = $filas->values();

        $etiquetasAlerta = [
            'licencia_vencida' => 'Licencia vencida',
            'licencia_por_vencer' => 'Licencia por vencer',
            'sin_licencia' => 'Sin licencia',
            'falta_foto' => 'Sin foto',
            'falta_docs' => 'Faltan documentos',
            'falta_doc_dni' => 'Falta doc. DNI',
            'falta_doc_licencia' => 'Falta doc. licencia',
            'falta_telefono' => 'Sin teléfono',
            'falta_correo' => 'Sin correo',
            'falta_deposito' => 'Sin depósito',
            'deposito_bajo' => 'Depósito bajo',
        ];
        $etiquetaEstado = match ($status) {
            'inactivos' => 'Inactivos',
            'activos' => 'Activos',
            default => 'Todos',
        };
        $subtitulo = $etiquetasAlerta[$alert] ?? null;

        $pdf = Pdf::loadView('pdf.choferes', [
            'filas' => $filas,
            'estado' => $etiquetaEstado,
            'subtitulo' => $subtitulo,
            'busqueda' => $q,
        ]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download('choferes-'.now()->format('Ymd').'.pdf');
    }
}
