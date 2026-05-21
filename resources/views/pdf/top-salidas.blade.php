<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Artículos con Mayor Salida</title>
    @include('pdf._styles')
    <style>
        /* Override: image column needs taller rows */
        .image-row td {
            height: 110px;
            line-height: normal;
            white-space: normal;
            overflow: hidden;
        }

        .td-imagen {
            text-align: center;
            padding: 4px;
        }

        .image-frame {
            display: inline-block;
            width: 130px;
            height: 100px;
            line-height: 100px;
            background: #fff7ed;
            border: 1px dashed #fdba74;
            text-align: center;
            overflow: hidden;
        }

        .image-frame.has-image {
            background: #ffffff;
            border-style: solid;
            border-color: #000;
        }

        .image-frame img {
            max-width: 126px;
            max-height: 96px;
            vertical-align: middle;
        }

        .no-image {
            display: inline-block;
            line-height: 1.2;
            vertical-align: middle;
            color: #F48E00;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
                <th class="center" style="width:5%">#</th>
                <th class="center" style="width:18%">Imagen</th>
                <th style="width:36%">Descripción</th>
                <th style="width:14%">Código</th>
                <th class="numeric" style="width:12%">Salida</th>
                <th class="numeric" style="width:15%">Precio</th>
            </tr>
        </thead>
        <tbody>
            @foreach($articulos as $articulo)
                @php
                    $precio = (float) $articulo->precio;
                    $precioConDescuento = round($precio * 0.85, 2);
                @endphp
                <tr class="image-row">
                    <td class="center">{{ $loop->iteration }}</td>
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
                    <td>{{ $articulo->descripcion }}</td>
                    <td>{{ $articulo->codigo ?: '—' }}</td>
                    <td class="numeric">{{ number_format((float) $articulo->total_salida, 0, ',', '.') }}</td>
                    <td class="numeric">${{ number_format($precioConDescuento, 0, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
