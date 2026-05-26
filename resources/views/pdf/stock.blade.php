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
                <th style="width:80%">Descripción</th>
                <th class="center" style="width:20%">Stock Actual</th>
            </tr>
        </thead>
        <tbody>
            @foreach($articulos as $articulo)
                <tr>
                    <td>{{ $articulo->descripcion }}</td>
                    <td class="center">{{ $articulo->stock }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
