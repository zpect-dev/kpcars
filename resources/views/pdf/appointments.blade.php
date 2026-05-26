<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Turnos</title>
    @include('pdf._styles')
</head>
<body>
    <table>
        <thead>
            <tr>
                <th class="center" style="width:5%">#</th>
                <th style="width:10%">Fecha</th>
                <th style="width:11%">Patente</th>
                <th style="width:25%">Servicio</th>
                <th style="width:15%">Solicitante</th>
                <th class="center" style="width:8%">Tipo</th>
                <th style="width:26%">Descripción</th>
            </tr>
        </thead>
        <tbody>
            @foreach($appointments as $appt)
                <tr>
                    <td class="center">{{ $appt->id }}</td>
                    <td>{{ \Carbon\Carbon::parse($appt->scheduled_date)->format('d/m/Y') }}</td>
                    <td>{{ $appt->license_plate }}</td>
                    <td>{{ $appt->service }}</td>
                    <td>{{ $appt->conductor->name ?? '-' }}</td>
                    <td class="center">{{ $appt->type === 'emergencia' ? 'Emergencia' : 'Programado' }}</td>
                    <td>{{ $appt->completion_description ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
