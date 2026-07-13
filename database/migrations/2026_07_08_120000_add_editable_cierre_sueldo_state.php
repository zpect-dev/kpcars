<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Estado necesario para que el cierre de sueldo sea EDITABLE:
     *
     * - cierre_sueldo_participaciones: foto de la composición de cada inversión
     *   al momento del cierre (socio, empresa, saldo de deuda, si es financiador).
     *   Imprescindible para recalcular: la deuda viva (inversion_user.deuda)
     *   cambia con los abonos, pero el cálculo del sueldo usa la foto original.
     *
     * - cierre_sueldo_socios: decisión por socio deudor. `abona` (media parte)
     *   vs no abona (0 en sus deudas). `abono_monto` es lo que se descuenta de su
     *   deuda cuando abona (preseteado al sueldo generado, editable).
     */
    public function up(): void
    {
        Schema::create('cierre_sueldo_participaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_sueldo_id')->constrained('cierres_sueldo')->cascadeOnDelete();
            $table->foreignId('inversion_id')->constrained('inversiones')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('empresa_id')->constrained('empresas')->cascadeOnDelete();
            $table->decimal('saldo', 14, 2)->default(0);
            $table->boolean('es_financiador')->default(false);
            $table->timestamps();

            $table->index(['cierre_sueldo_id', 'inversion_id'], 'csp_cierre_inv_idx');
            $table->index(['cierre_sueldo_id', 'user_id'], 'csp_cierre_user_idx');
        });

        Schema::create('cierre_sueldo_socios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cierre_sueldo_id')->constrained('cierres_sueldo')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('abona')->default(true);
            $table->decimal('abono_monto', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['cierre_sueldo_id', 'user_id'], 'css_cierre_user_uq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cierre_sueldo_socios');
        Schema::dropIfExists('cierre_sueldo_participaciones');
    }
};
