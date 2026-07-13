<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Cierre de Caja #{{ $cierre->id }}</title>
    @include('pdf._styles')
</head>
<body>
    <div class="section-title">
        Cierre de Caja #{{ $cierre->id }} — {{ $cierre->created_at->format('d/m/Y H:i') }}{{ $cierre->user ? ' · '.$cierre->user->name : '' }}
    </div>

    @if($empresas->isEmpty())
        <table>
            <thead><tr><th>No hay detalles para este cierre</th></tr></thead>
        </table>
    @else
        @foreach($empresas as $empresaNombre => $inversiones)
            @php $empresaTotal = collect($inversiones)->sum('total'); @endphp
            <div class="section-title">{{ $empresaNombre }}</div>

            @include('pdf._cobros-vehiculos', ['inversiones' => $inversiones])

            <table>
                <tbody>
                    <tr class="total-row">
                        <td style="width:80%">Total {{ $empresaNombre }} (cobros + gastos)</td>
                        <td class="numeric" style="width:20%">${{ number_format((float) $empresaTotal, 0, ',', '.') }}</td>
                    </tr>
                </tbody>
            </table>
        @endforeach

        <table>
            <tbody>
                <tr class="total-row">
                    <td style="width:80%">TOTAL DEL CIERRE (cobros + gastos)</td>
                    <td class="numeric" style="width:20%">${{ number_format((float) $total, 0, ',', '.') }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
