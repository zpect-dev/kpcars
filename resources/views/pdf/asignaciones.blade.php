<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Asignaciones - {{ $vehiculo->patente }}</title>
    @include('pdf._styles')
</head>
<body>
    @if($asignaciones->isEmpty())
        <table>
            <thead>
                <tr><th>Sin asignaciones registradas</th></tr>
            </thead>
        </table>
    @else
        <table>
            <thead>
                <tr>
                    <th style="width:28%">Conductor</th>
                    <th style="width:15%">DNI</th>
                    <th style="width:20%">Inicio</th>
                    <th style="width:20%">Fin</th>
                    <th class="center" style="width:9%">Estado</th>
                    <th style="width:8%">Asignado por</th>
                </tr>
            </thead>
            <tbody>
                @foreach($asignaciones as $asignacion)
                    <tr>
                        <td>{{ $asignacion->conductor?->name ?? '— Sin conductor —' }}</td>
                        <td>{{ $asignacion->conductor?->dni ?? '—' }}</td>
                        <td>{{ $asignacion->fecha_inicio?->format('d/m/Y H:i') ?? '—' }}</td>
                        <td>{{ $asignacion->fecha_fin?->format('d/m/Y H:i') ?? '—' }}</td>
                        <td class="center">{{ is_null($asignacion->fecha_fin) ? 'Activa' : 'Finalizada' }}</td>
                        <td>{{ $asignacion->asignadoPor?->name ?? '—' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</body>
</html>
