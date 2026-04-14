<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Historial de Transacciones</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 10px;
            color: #1a1a1a;
            background: #fff;
        }

        .header {
            padding: 20px 28px 14px;
            border-bottom: 3px solid #F48E00;
            margin-bottom: 16px;
        }

        .header h1 {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a1a;
        }

        .header .meta {
            margin-top: 4px;
            font-size: 9px;
            color: #6b7280;
        }

        .header .meta span {
            color: #F48E00;
            font-weight: 600;
        }

        .filters {
            margin: 0 28px 14px;
            padding: 8px 12px;
            background: #fff7ed;
            border: 1px solid #fed7aa;
            border-radius: 6px;
            font-size: 9px;
            color: #7c2d12;
        }

        .filters strong {
            font-weight: 700;
            color: #c2410c;
        }

        .body {
            padding: 0 28px 28px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        thead tr {
            background-color: #F48E00;
        }

        thead th {
            padding: 8px 10px;
            text-align: left;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #ffffff;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        tbody td {
            padding: 7px 10px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }

        .tipo-in {
            display: inline-block;
            background: #dcfce7;
            color: #166534;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            text-transform: uppercase;
        }

        .tipo-out {
            display: inline-block;
            background: #fee2e2;
            color: #991b1b;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            text-transform: uppercase;
        }

        .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Historial de Transacciones</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span>
            &nbsp;·&nbsp; Total de registros: <span>{{ $transactions->count() }}</span>
        </div>
    </div>

    @if(isset($articleStock))
        <div class="filters">
            <strong>{{ $articleName }}</strong>
            &nbsp;·&nbsp; Stock actual: <strong>{{ $articleStock }}</strong>
        </div>
    @endif

    <div class="body">
        <table>
            <thead>
                <tr>
                    <th style="width:14%">Fecha</th>
                    <th style="width:22%">Artículo</th>
                    <th style="width:10%; text-align:center">Tipo</th>
                    <th style="width:8%; text-align:center">Cantidad</th>
                    <th style="width:18%">Patente</th>
                    <th style="width:20%">Descripción</th>
                    <th style="width:16%">Solicitante</th>
                    <th style="width:16%">Usuario</th>
                </tr>
            </thead>
            <tbody>
                @forelse($transactions as $tx)
                    <tr>
                        <td style="color:#6b7280">
                            {{ \Carbon\Carbon::parse($tx->created_at)->format('d/m/Y H:i') }}
                        </td>
                        <td style="font-weight:500; color:#111827">
                            {{ $tx->articulo?->descripcion ?? 'N/A' }}
                        </td>
                        <td style="text-align:center">
                            @if($tx->tipo === 'IN')
                                <span class="tipo-in">Ingreso</span>
                            @else
                                <span class="tipo-out">Egreso</span>
                            @endif
                        </td>
                        <td style="text-align:center; font-weight:700; color:#111827">
                            {{ $tx->cantidad }}
                        </td>
                        <td style="font-weight:500; color:#111827">
                            {{ $tx->vehiculo?->patente ?? '-' }}
                            @if($tx->vehiculo)
                                <br><span style="font-weight:400; color:#6b7280; font-size:8.5px">{{ $tx->vehiculo->marca }} {{ $tx->vehiculo->modelo }}</span>
                            @endif
                        </td>
                        <td>{{ $tx->descripcion ?? '-' }}</td>
                        <td>{{ $tx->solicitante ?? '-' }}</td>
                        <td style="color:#6b7280">{{ $tx->user?->name ?? 'N/A' }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" style="text-align:center; padding:24px; color:#9ca3af">
                            No hay transacciones para los filtros seleccionados.
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="footer">
            <span>KP Cars — Sistema de Inventario</span>
            <span>Reporte al {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>
</html>
