<?php

declare(strict_types=1);

use App\Actions\AnnulTransactionAction;
use App\Actions\ProcessConteoAction;
use App\Enums\UserRole;
use App\Models\Articulo;
use App\Models\Conteo;
use App\Models\ConteoLinea;
use App\Models\Transaccion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'role' => UserRole::ADMINISTRADOR,
        'dni' => '70000001',
    ]);
    $this->actingAs($this->admin);

    $this->aceite = Articulo::create(['descripcion' => 'Aceite', 'stock' => 10, 'min_stock' => 1, 'precio' => 100, 'repuestos' => true]);
});

it('un faltante genera un AJUSTE negativo y baja el stock al físico', function () {
    $conteo = (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 8, 'motivo' => 'perdida_no_explicada', 'nota' => 'Faltan 2 sin registro']],
        'repuestos',
    );

    expect($this->aceite->fresh()->stock)->toBe(8);

    $ajuste = Transaccion::where('tipo', 'AJUSTE')->first();
    expect($ajuste)->not->toBeNull()
        ->and($ajuste->cantidad)->toBe(-2)
        ->and($ajuste->vehiculo_id)->toBeNull();

    $linea = ConteoLinea::first();
    expect($linea->stock_esperado)->toBe(10)
        ->and($linea->stock_fisico)->toBe(8)
        ->and($linea->diferencia)->toBe(-2)
        ->and($linea->motivo)->toBe('perdida_no_explicada')
        ->and($linea->transaccion_id)->toBe($ajuste->id)
        ->and($linea->conteo_id)->toBe($conteo->id);
});

it('un sobrante genera un AJUSTE positivo y sube el stock al físico', function () {
    (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 13, 'motivo' => 'error_carga', 'nota' => 'Se cargó de menos un ingreso']],
        'repuestos',
    );

    expect($this->aceite->fresh()->stock)->toBe(13)
        ->and(Transaccion::where('tipo', 'AJUSTE')->value('cantidad'))->toBe(3);
});

it('sin diferencia no genera AJUSTE ni toca el stock', function () {
    (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 10]],
        'repuestos',
    );

    expect($this->aceite->fresh()->stock)->toBe(10)
        ->and(Transaccion::where('tipo', 'AJUSTE')->count())->toBe(0);

    $linea = ConteoLinea::first();
    expect($linea->diferencia)->toBe(0)
        ->and($linea->motivo)->toBeNull()
        ->and($linea->transaccion_id)->toBeNull();
});

it('exige motivo y nota cuando hay diferencia; no aplica nada si faltan', function () {
    expect(fn () => (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 8]],
        'repuestos',
    ))->toThrow(InvalidArgumentException::class);

    // La transacción envolvente hizo rollback: nada cambió.
    expect($this->aceite->fresh()->stock)->toBe(10)
        ->and(Conteo::count())->toBe(0)
        ->and(ConteoLinea::count())->toBe(0)
        ->and(Transaccion::count())->toBe(0);
});

it('el snapshot del esperado se toma del stock vivo al confirmar', function () {
    // Simula un egreso cargado entre el preview y la confirmación: el esperado
    // debe ser 6 (stock vivo), no 10.
    $this->aceite->update(['stock' => 6]);

    (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 5, 'motivo' => 'rotura', 'nota' => 'Una rota']],
        'repuestos',
    );

    $linea = ConteoLinea::first();
    expect($linea->stock_esperado)->toBe(6)
        ->and($linea->diferencia)->toBe(-1)
        ->and($this->aceite->fresh()->stock)->toBe(5);
});

it('un AJUSTE no puede anularse', function () {
    (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 8, 'motivo' => 'perdida_no_explicada', 'nota' => 'x']],
        'repuestos',
    );

    $ajuste = Transaccion::where('tipo', 'AJUSTE')->first();

    expect(fn () => (new AnnulTransactionAction)->execute($ajuste))->toThrow(Exception::class);

    // El stock no se revirtió.
    expect($this->aceite->fresh()->stock)->toBe(8);
});

it('rechaza zona inválida', function () {
    expect(fn () => (new ProcessConteoAction)->execute(
        [['articulo_id' => $this->aceite->id, 'fisico' => 10]],
        'inexistente',
    ))->toThrow(InvalidArgumentException::class);
});
