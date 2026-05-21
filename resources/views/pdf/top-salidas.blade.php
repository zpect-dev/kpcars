<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artículos con Mayor Salida</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            color: #1f2937;
            background: #fff;
        }

        /* ───── Encabezado ───── */
        .header {
            padding: 24px 32px 18px;
            border-bottom: 1px solid #e5e7eb;
            display: table;
            width: 100%;
        }

        .header-left,
        .header-right {
            display: table-cell;
            vertical-align: middle;
        }

        .header-right {
            text-align: right;
        }

        .brand {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: #1f2937;
            line-height: 1.05;
        }

        .brand .brand-logo {
            display: inline-block;
            width: 32px;
            height: 32px;
            vertical-align: middle;
            margin-right: 10px;
        }

        .brand .brand-text {
            display: inline-block;
            vertical-align: middle;
        }

        .brand .brand-sub {
            display: block;
            margin-top: 2px;
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            letter-spacing: 0.5px;
        }

        .title {
            font-size: 22px;
            font-weight: 700;
            color: #F48E00;
            letter-spacing: -0.3px;
            line-height: 1.1;
        }

        .title-sub {
            margin-top: 4px;
            font-size: 10px;
            color: #6b7280;
        }

        /* ───── Banda resumen ───── */
        .summary {
            margin: 20px 32px 14px;
            padding: 10px 14px;
            background: #fff7ed;
            border-left: 4px solid #F48E00;
            border-radius: 4px;
            font-size: 11px;
            color: #1f2937;
        }

        .summary .label {
            color: #F48E00;
            font-weight: 700;
            margin-right: 8px;
        }

        .summary .sep {
            color: #d1d5db;
            margin: 0 10px;
        }

        .summary .stat-label {
            color: #6b7280;
            font-weight: 500;
        }

        .summary .stat-value {
            font-weight: 700;
            color: #1f2937;
        }

        /* ───── Tabla ───── */
        .body {
            padding: 0 32px 32px;
        }

        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }

        thead tr {
            background-color: #F48E00;
        }

        thead th {
            padding: 10px 14px;
            text-align: left;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #ffffff;
        }

        thead th.numeric {
            text-align: right;
        }

        tbody td {
            padding: 11px 14px;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: middle;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        .td-rank {
            font-weight: 700;
            color: #6b7280;
            width: 36px;
            text-align: center;
            font-size: 12px;
        }

        .td-descripcion {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            font-weight: 400;
            color: #111827;
        }

        .td-numeric {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            font-size: 12px;
            font-weight: 400;
            color: #111827;
        }

        .td-precio {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            font-size: 12px;
            font-weight: 700;
            color: #F48E00;
        }

        .td-codigo {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: #374151;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
        }

        .td-imagen {
            width: 200px;
            text-align: center;
            padding: 10px;
            vertical-align: middle;
        }

        .td-imagen .image-frame {
            display: inline-block;
            width: 190px;
            height: 140px;
            line-height: 140px;
            background: #fff7ed;
            border: 1px dashed #fdba74;
            border-radius: 6px;
            text-align: center;
            overflow: hidden;
        }

        .td-imagen .image-frame.has-image {
            background: #ffffff;
            border-style: solid;
            border-color: #e5e7eb;
        }

        .td-imagen img {
            max-width: 184px;
            max-height: 134px;
            vertical-align: middle;
        }

        .td-imagen .no-image {
            display: inline-block;
            line-height: 1.2;
            vertical-align: middle;
            color: #F48E00;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }

        /* ───── Pie ───── */
        .footer {
            margin: 18px 32px 0;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
            display: table;
            width: calc(100% - 64px);
        }

        .footer span {
            display: table-cell;
        }

        .footer span:last-child {
            text-align: right;
        }
    </style>
</head>

<body>
    <div class="header">
        <div class="header-left">
            <div class="brand">
                <span class="brand-text">
                    KP CARS
                    <span class="brand-sub">SISTEMA DE INVENTARIO</span>
                </span>
            </div>
        </div>
        <div class="header-right">
            <div class="title">Artículos con Mayor Salida</div>
            <div class="title-sub">
                Reporte generado: {{ now()->translatedFormat('d \\d\\e F \\d\\e Y, H:i') }}
            </div>
        </div>
    </div>

    <div class="body">
        <table>
            <thead>
                <tr>
                    <th style="width:4%">#</th>
                    <th style="width:20%">Imagen</th>
                    <th style="width:34%">Descripción</th>
                    <th style="width:14%">Código</th>
                    <th class="numeric" style="width:13%">Salida</th>
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
                    <td class="td-rank">{{ $loop->iteration }}</td>
                    <td class="td-imagen">
                        @if(! empty($articulo->imagen_data))
                            <span class="image-frame has-image">
                                <img src="{{ $articulo->imagen_data }}" alt="">
                            </span>
                        @else
                            <span class="image-frame">
                                <span class="no-image">Sin imagen</span>
                            </span>
                        @endif
                    </td>
                    <td class="td-descripcion">{{ $articulo->descripcion }}</td>
                    <td class="td-codigo">{{ $articulo->codigo ?: '—' }}</td>
                    <td class="td-numeric">{{ number_format((float) $articulo->total_salida, 0, ',', '.') }}</td>
                    <td class="td-precio">${{ number_format($precioConDescuento, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="footer">
        <span>KP Cars — Sistema de Inventario</span>
        <span>Reporte al {{ now()->format('d/m/Y') }}</span>
    </div>
</body>

</html>