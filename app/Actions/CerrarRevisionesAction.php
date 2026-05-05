<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\CierreRevision;
use App\Models\Revision;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CerrarRevisionesAction
{
    public function execute(User $admin): CierreRevision
    {
        return DB::transaction(function () use ($admin) {
            // Find the last closure to determine the start of this period
            $ultimoCierre = CierreRevision::latest('periodo_fin')->first();
            
            $periodoInicio = $ultimoCierre ? $ultimoCierre->periodo_fin->addDay() : Carbon::today()->subDays(7);
            $periodoFin = Carbon::today();

            $cierre = CierreRevision::create([
                'user_id' => $admin->id,
                'periodo_inicio' => $periodoInicio,
                'periodo_fin' => $periodoFin,
            ]);

            // Get all vehicles that are currently active and require revisions
            $vehiculos = Vehiculo::where('patente', '!=', 'EXTERNO')
                ->whereNotNull('user_id')
                ->get();

            foreach ($vehiculos as $vehiculo) {
                // Find the open revision for this vehicle
                $revision = Revision::where('vehiculo_id', $vehiculo->id)
                    ->whereNull('cierre_revision_id')
                    ->first();

                if ($revision) {
                    $revision->update(['cierre_revision_id' => $cierre->id]);
                    $estado = 'revisado';
                    $revisionId = $revision->id;
                } else {
                    $estado = 'no_revisado';
                    $revisionId = null;
                }

                $cierre->detalles()->create([
                    'vehiculo_id' => $vehiculo->id,
                    'revision_id' => $revisionId,
                    'estado' => $estado,
                ]);
            }

            return $cierre;
        });
    }
}
