<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Vehículos</title>
    @include('pdf._styles')
</head>
<body>
    <table>
        <thead>
            <tr>
                <th style="width:10%">Patente</th>
                <th style="width:9%">Marca</th>
                <th style="width:20%">Modelo</th>
                <th style="width:6%">Año</th>
                <th style="width:13%">Empresa</th>
                <th style="width:11%">Inversión</th>
                <th style="width:15%">Conductor</th>
                <th style="width:8%">VTV</th>
                <th style="width:8%">GNC</th>
            </tr>
        </thead>
        <tbody>
            @foreach($vehiculos as $v)
                <tr>
                    <td>{{ $v->patente }}</td>
                    <td>{{ $v->marca }}</td>
                    <td>{{ $v->modelo }}</td>
                    <td>{{ $v->anio }}</td>
                    <td>{{ $v->empresa?->nombre ?? '' }}</td>
                    <td>{{ $v->inversion?->nombre ?? '' }}</td>
                    <td>{{ $v->user?->name ?? '' }}</td>
                    <td>{{ $v->fecha_vencimiento_vtv ? \Carbon\Carbon::parse($v->fecha_vencimiento_vtv)->format('m/Y') : '' }}</td>
                    <td>{{ $v->fecha_vencimiento_gnc ? \Carbon\Carbon::parse($v->fecha_vencimiento_gnc)->format('m/Y') : '' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
