<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Gastos</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">Gastos — {{ now()->format('d/m/Y') }}</div>

    <table>
        <thead>
            <tr>
                <th style="width:14%">Fecha</th>
                <th style="width:40%">Descripción</th>
                <th style="width:16%">Categoría</th>
                <th style="width:14%">Patente</th>
                <th class="numeric" style="width:16%">Monto</th>
            </tr>
        </thead>
        <tbody>
            @forelse($filas as $f)
                <tr>
                    <td>{{ $f['fecha'] }}</td>
                    <td>{{ $f['descripcion'] }}</td>
                    <td>{{ $f['categoria'] }}</td>
                    <td>{{ $f['patente'] }}</td>
                    <td class="numeric">${{ number_format($f['monto'], 2, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="center">No hay gastos registrados.</td></tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="4">TOTAL</td>
                <td class="numeric">${{ number_format($total, 2, ',', '.') }}</td>
            </tr>
        </tfoot>
    </table>
</body>
</html>
