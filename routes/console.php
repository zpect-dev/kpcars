<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Feed externo de multas: se ingiere una vez al día a la mañana.
Schedule::command('multas:sincronizar --origen=schedule')
    ->dailyAt('06:00')
    ->withoutOverlapping();
