<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Choferes — {{ $estado }}</title>
    @include('pdf._styles')
    <style>
        .estado { display:inline-block; padding:1px 6px; border-radius:4px; font-weight:700; font-size:10px; }
        .est-activo { background:#dcfce7; color:#15803d; }
        .est-inactivo { background:#fee2e2; color:#b91c1c; }
        .muted { color:#9ca3af; }
    </style>
</head>
<body>

<div class="section-title">
    Choferes — {{ $estado }}
    @if($subtitulo) &nbsp;·&nbsp; {{ $subtitulo }} @endif
    @if($busqueda) &nbsp;·&nbsp; Búsqueda: "{{ $busqueda }}" @endif
    &nbsp;&nbsp;·&nbsp;&nbsp; {{ $filas->count() }} chofer{{ $filas->count() !== 1 ? 'es' : '' }}
    &nbsp;&nbsp;·&nbsp;&nbsp; Generado el {{ now()->format('d/m/Y H:i') }}
</div>

<table style="margin-top:12px">
    <thead>
        <tr>
            <th>Nombre</th>
            <th style="width:80px">DNI</th>
            <th style="width:100px">Teléfono</th>
            <th>Correo</th>
            <th>Domicilio</th>
            <th style="width:80px" class="center">Venc. licencia</th>
            <th style="width:70px" class="center">Vehículo</th>
            <th>Depósito</th>
            <th style="width:70px" class="center">Estado</th>
        </tr>
    </thead>
    <tbody>
        @forelse($filas as $f)
            <tr>
                <td><strong>{{ $f['name'] }}</strong></td>
                <td>{{ $f['dni'] }}</td>
                <td>{{ $f['telefono'] ?: '—' }}</td>
                <td>{{ $f['correo'] ?: '—' }}</td>
                <td>{{ $f['direccion'] ?: '—' }}</td>
                <td class="center">{{ $f['venc_licencia'] ?? '—' }}</td>
                <td class="center">{{ $f['vehiculo'] ?? '—' }}</td>
                <td>{!! count($f['depositos']) ? implode(' · ', $f['depositos']) : '<span class="muted">—</span>' !!}</td>
                <td class="center">
                    <span class="estado {{ $f['inactivo'] ? 'est-inactivo' : 'est-activo' }}">
                        {{ $f['inactivo'] ? 'Inactivo' : 'Activo' }}
                    </span>
                </td>
            </tr>
        @empty
            <tr><td colspan="9" style="text-align:center;color:#6b7280">Sin choferes que coincidan con los filtros.</td></tr>
        @endforelse
    </tbody>
</table>

</body>
</html>
