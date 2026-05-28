<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Artículos con Mayor Salida</title>
    @include('pdf._styles')
</head>
<body>
    <table>
        <thead>
            <tr>
                <th class="center" style="width:6%">#</th>
                <th style="width:50%">Descripción</th>
                <th style="width:17%">Código</th>
                <th class="numeric" style="width:12%">Salida</th>
                <th class="numeric" style="width:15%">Precio</th>
            </tr>
        </thead>
        <tbody>
            @foreach($articulos as $articulo)
                @php
                    $precio = (float) $articulo->precio;
                    $precioConDescuento = round($precio * 0.85, 2);
                @endphp
                <tr>
                    <td class="center">{{ $loop->iteration }}</td>
                    <td>{{ $articulo->descripcion }}</td>
                    <td>{{ $articulo->codigo ?: '—' }}</td>
                    <td class="numeric">{{ number_format((float) $articulo->total_salida, 0, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($precioConDescuento, 0, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
