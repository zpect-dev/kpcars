<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <title>Turnos</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

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

        .status-badge {
            display: inline-block;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            text-transform: uppercase;
        }

        .status-agendado {
            background: #dbeafe;
            color: #1e40af;
        }

        .status-en_proceso {
            background: #fef9c3;
            color: #854d0e;
        }

        .status-completado {
            background: #dcfce7;
            color: #166534;
        }

        .status-cancelado {
            background: #fee2e2;
            color: #991b1b;
        }

        .tipo-normal {
            display: inline-block;
            background: #f3f4f6;
            color: #374151;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
        }

        .tipo-emergencia {
            display: inline-block;
            background: #fee2e2;
            color: #991b1b;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
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
        <h1>Historial de Turnos</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span>
            &nbsp;·&nbsp; Total de registros: <span>{{ $appointments->count() }}</span>
            @if(!empty($filters['from']) || !empty($filters['to']))
            &nbsp;·&nbsp; Período: <span>{{ $filters['from'] ?? '—' }}</span> al <span>{{ $filters['to'] ?? '—'
                }}</span>
            @endif
        </div>
    </div>

    @if(!empty($filters['status']) || !empty($filters['plate']))
    <div class="filters">
        Filtros activos:
        @if(!empty($filters['status'])) <strong>Estado: {{ ucfirst(str_replace('_', ' ', $filters['status']))
            }}</strong>&nbsp; @endif
        @if(!empty($filters['plate'])) <strong>Patente: {{ $filters['plate'] }}</strong> @endif
    </div>
    @endif

    <div class="body">
        <table>
            <thead>
                <tr>
                    <th style="width:8%; text-align:center"># Turno</th>
                    <th style="width:14%">Fecha</th>
                    <th style="width:16%">Patente</th>
                    <th style="width:34%">Servicio</th>
                    <th style="width:16%">Solicitante</th>
                    <th style="width:12%; text-align:center">Tipo</th>
                </tr>
            </thead>
            <tbody>
                @forelse($appointments as $appt)
                <tr>
                    <td style="text-align:center; font-weight:600; color:#111827">
                        {{ $appt->id }}
                    </td>
                    <td style="color:#6b7280">
                        {{ \Carbon\Carbon::parse($appt->scheduled_date)->format('d/m/Y') }}
                    </td>
                    <td style="font-weight:600; color:#111827">
                        {{ $appt->license_plate }}
                    </td>
                    <td>{{ $appt->service }}</td>
                    <td>{{ $appt->conductor->name ?? '-' }}</td>
                    <td style="text-align:center">
                        @if($appt->type === 'emergencia')
                        <span class="tipo-emergencia">Emergencia</span>
                        @else
                        <span class="tipo-normal">Normal</span>
                        @endif
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="6" style="text-align:center; padding:24px; color:#9ca3af">
                        No hay turnos para los filtros seleccionados.
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>

        <div class="footer">
            <span>KP Cars — Sistema de Turnos</span>
            <span>Reporte al {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>

</html>