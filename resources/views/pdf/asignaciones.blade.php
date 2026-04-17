<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Historial de Conductores - {{ $vehiculo->patente }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            background: #fff;
        }

        .header {
            padding: 24px 32px 16px;
            border-bottom: 3px solid #F48E00;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 20px;
            font-weight: 700;
            color: #1a1a1a;
        }

        .header .meta {
            margin-top: 4px;
            font-size: 10px;
            color: #6b7280;
        }

        .header .meta span {
            color: #F48E00;
            font-weight: 600;
        }

        .vehicle-info {
            margin: 0 32px 20px;
            background: #fff8ee;
            border: 1px solid #F48E00;
            border-radius: 8px;
            padding: 12px 16px;
            display: flex;
            gap: 32px;
        }

        .vehicle-info .field label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            font-weight: 600;
        }

        .vehicle-info .field .value {
            font-size: 13px;
            font-weight: 700;
            color: #1a1a1a;
            margin-top: 2px;
        }

        .body {
            padding: 0 32px 32px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        thead tr {
            background-color: #F48E00;
        }

        thead th {
            padding: 9px 12px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #ffffff;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        tbody td {
            padding: 9px 12px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }

        .badge-activo {
            display: inline-block;
            background: #dcfce7;
            color: #166534;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .badge-finalizado {
            display: inline-block;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
        }

        .no-data {
            text-align: center;
            padding: 32px;
            color: #9ca3af;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Historial de Conductores</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="vehicle-info">
        <div class="field">
            <label>Patente</label>
            <div class="value">{{ $vehiculo->patente }}</div>
        </div>
        <div class="field">
            <label>Vehículo</label>
            <div class="value">{{ $vehiculo->marca }} {{ $vehiculo->modelo }}</div>
        </div>
        <div class="field">
            <label>Año</label>
            <div class="value">{{ $vehiculo->anio }}</div>
        </div>
        <div class="field">
            <label>Total asignaciones</label>
            <div class="value">{{ $asignaciones->count() }}</div>
        </div>
    </div>

    <div class="body">
        @if($asignaciones->isEmpty())
            <p class="no-data">Este vehículo no tiene historial de conductores registrado.</p>
        @else
            <table>
                <thead>
                    <tr>
                        <th style="width:25%">Conductor</th>
                        <th style="width:15%">DNI</th>
                        <th style="width:22%">Inicio</th>
                        <th style="width:22%">Fin</th>
                        <th style="width:10%; text-align:center">Estado</th>
                        <th style="width:6%">Asignado por</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($asignaciones as $asignacion)
                        <tr>
                            <td style="font-weight:600; color:#111827">
                                {{ $asignacion->conductor?->name ?? '— Sin conductor —' }}
                            </td>
                            <td style="color:#6b7280">
                                {{ $asignacion->conductor?->dni ?? '—' }}
                            </td>
                            <td>{{ $asignacion->fecha_inicio?->format('d/m/Y H:i') ?? '—' }}</td>
                            <td>{{ $asignacion->fecha_fin?->format('d/m/Y H:i') ?? '—' }}</td>
                            <td style="text-align:center">
                                @if(is_null($asignacion->fecha_fin))
                                    <span class="badge-activo">Activo</span>
                                @else
                                    <span class="badge-finalizado">Finalizado</span>
                                @endif
                            </td>
                            <td style="color:#6b7280; font-size:10px">
                                {{ $asignacion->asignadoPor?->name ?? '—' }}
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif

        <div class="footer">
            <span>KPcars — Sistema de Gestión de Inventario</span>
            <span>{{ now()->format('d/m/Y H:i') }}</span>
        </div>
    </div>
</body>
</html>
