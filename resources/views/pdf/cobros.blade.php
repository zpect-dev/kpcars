<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cobros con gastos</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">Cobros con gastos — {{ now()->format('d/m/Y') }}</div>

    @if($resumen->isEmpty())
        <table>
            <thead><tr><th>No hay cobros ni gastos en el período</th></tr></thead>
        </table>
    @else
        @include('pdf._cobros-vehiculos', ['inversiones' => $resumen])

        <table>
            <tbody>
                <tr class="total-row">
                    <td style="width:80%">TOTAL GENERAL (cobros + gastos)</td>
                    <td class="numeric" style="width:20%">${{ number_format((float) $total, 0, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
