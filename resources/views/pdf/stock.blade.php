<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Stock</title>
    @include('pdf._styles')
</head>
<body>
    <table>
        <thead>
            <tr>
                <th style="width:60%">Descripción</th>
                <th class="center" style="width:18%">Stock Actual</th>
                <th class="numeric" style="width:22%">Precio de venta</th>
            </tr>
        </thead>
        <tbody>
            @foreach($articulos as $articulo)
                <tr>
                    <td>{{ $articulo->descripcion }}</td>
                    <td class="center">{{ $articulo->stock }}</td>
                    <td class="numeric">${{ number_format((float) $articulo->precio, 2, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
