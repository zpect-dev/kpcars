<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request): Response
    {
        $vehiculos = Vehiculo::with(['user', 'empresa'])->get();

        return Inertia::render('dashboard', [
            'vehiculos' => $vehiculos,
        ]);
    }
}
