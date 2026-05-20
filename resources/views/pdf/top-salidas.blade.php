<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artículos con más salida</title>
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
            letter-spacing: -0.3px;
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
            padding: 10px 14px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #ffffff;
        }

        tbody tr:nth-child(even) {
            background-color: #fafafa;
        }

        tbody td {
            padding: 10px 14px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }

        .td-rank {
            font-weight: 700;
            color: #6b7280;
            width: 36px;
            text-align: center;
            font-size: 13px;
        }

        .td-descripcion {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            font-weight: 500;
            color: #111827;
        }

        .td-numeric {
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 600;
            color: #111827;
        }

        .price-discount {
            color: #111827;
            font-weight: 700;
            font-size: 14px;
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

        .note {
            margin-bottom: 14px;
            padding: 8px 12px;
            background: #fef3c7;
            border-left: 4px solid #F48E00;
            font-size: 10px;
            color: #78350f;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Artículos con más salida</h1>
        <div class="meta">
            Generado el <span>{{ now()->format('d/m/Y H:i') }}</span> ·
            <span>{{ $articulos->count() }} artículos</span> con movimiento
        </div>
    </div>

    <div class="body">
        <div class="note">
            Los precios indicados ya tienen aplicado el descuento del 15% sobre el precio actual de cada artículo.
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:6%">#</th>
                    <th style="width:54%">Descripción</th>
                    <th style="width:13%; text-align:right">Salidas</th>
                    <th style="width:10%; text-align:right">Stock</th>
                    <th style="width:17%; text-align:right">Precio de compra aprox.</th>
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
                        <td class="td-descripcion">{{ $articulo->descripcion }}</td>
                        <td class="td-numeric">{{ number_format((float) $articulo->total_salida, 0, ',', '.') }}</td>
                        <td class="td-numeric">{{ number_format((float) $articulo->stock, 0, ',', '.') }}</td>
                        <td class="td-numeric">
                            <span class="price-discount">${{ number_format($precioConDescuento, 2, ',', '.') }}</span>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="footer">
            <span>KP Cars — Sistema de Inventario</span>
            <span>Reporte al {{ now()->format('d/m/Y') }}</span>
        </div>
    </div>
</body>
</html>
