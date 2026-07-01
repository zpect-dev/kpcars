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
            $rules["{$t}_pdf"]    = ['nullable', 'file', 'mimes:pdf', 'max:10240', "prohibits:{$t}_frente,{$t}_dorso"];
            $rules["{$t}_frente"] = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096', "required_with:{$t}_dorso"];
            $rules["{$t}_dorso"]  = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096', "required_with:{$t}_frente"];
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
            $query->with(['empresas:id,nombre']);
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

        return Inertia::render('Users/Index', [
            'users' => $users,
            'roles' => $roles,
            'filterRoles' => $filterRoles,
            'empresas' => $empresas,
            'monedas' => $monedas,
            'choferCounts' => $choferCounts,
            'cotizacionDolar' => (float) (Setting::get('cotizacion_dolar') ?? 0),
        ]);
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
            ->with(['vehiculo', 'asignadoPor:id,name'])
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
            ->with(['vehiculo', 'asignadoPor:id,name'])
            ->orderBy('fecha_inicio', 'desc')
            ->get();

        $pdf = Pdf::loadView('pdf.user-asignaciones', compact('user', 'asignaciones'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("asignaciones-{$user->dni}-".now()->format('Y-m-d').'.pdf');
    }
}
