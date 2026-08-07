<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Recalcula la `clave` sintética de las actas de CABA quitando el `monto` del
 * hash. Antes la clave era sha1(patente|fecha|motivo|monto); si CABA
 * actualizaba el importe (intereses), el hash cambiaba y la misma infracción se
 * marcaba "pagada" y reaparecía como "nueva". Ahora es sha1(patente|fecha|motivo).
 *
 * Se recalcula desde `raw` (el ítem crudo del feed). Si dos actas colapsan a la
 * misma clave nueva, se conserva la más reciente y se borran las demás.
 */
return new class extends Migration
{
    public function up(): void
    {
        $vistas = []; // clave nueva => id conservado

        // Se carga todo el set (CABA es acotado) para no paginar mientras se
        // borran duplicados, que desalinearía el offset y saltearía filas.
        $actas = DB::table('actas')
            ->where('jurisdiccion', 'CABA')
            ->select('id', 'patente', 'raw')
            ->orderByDesc('id')
            ->get();

        foreach ($actas as $acta) {
            $raw = is_string($acta->raw) ? json_decode($acta->raw, true) : (array) $acta->raw;

            $partes = [
                (string) $acta->patente,
                trim((string) ($raw['fechaInfraccion'] ?? '')),
                trim((string) ($raw['motivo'] ?? '')),
            ];

            $clave = 'CABA:'.sha1(implode('|', $partes));

            // Colisión: ya conservamos una fila con esta clave (más nueva por el
            // orden desc). Esta es duplicada => se borra.
            if (isset($vistas[$clave])) {
                DB::table('actas')->where('id', $acta->id)->delete();

                continue;
            }

            $vistas[$clave] = $acta->id;
            DB::table('actas')->where('id', $acta->id)->update(['clave' => $clave]);
        }
    }

    public function down(): void
    {
        // Irreversible: el monto original quedó fuera de la clave. Las claves
        // viejas se pueden reconstruir desde `raw` si hiciera falta.
    }
};
