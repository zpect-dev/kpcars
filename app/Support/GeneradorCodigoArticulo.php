<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Genera un código corto y mnemónico para un artículo a partir de su nombre:
 * familia (3 primeras letras de la 1ª palabra) + iniciales de las demás.
 *
 *   "Amortiguador Delantero Derecho Corolla" -> AMO-DDC
 *   "Pastillas Freno Delantero Cruze"        -> PAS-FDC
 *   "Filtro Aceite"                          -> FIL-A
 *   "Aceite"                                 -> ACE
 *
 * La unicidad se resuelve con un sufijo numérico (AMO-DDC, AMO-DDC2, ...).
 */
class GeneradorCodigoArticulo
{
    /** Palabras que no aportan al código. */
    private const STOPWORDS = ['DE', 'DEL', 'PARA', 'CON', 'Y', 'LA', 'EL', 'LOS', 'LAS', 'A', 'AL'];

    /**
     * Código base (sin resolver unicidad) para un nombre.
     */
    public static function base(string $nombre): string
    {
        $normal = (string) Str::of($nombre)->ascii()->upper();
        // Los decimales se pegan (1.8 -> 18); el resto de la puntuación separa.
        $normal = preg_replace('/(?<=\d)[.,](?=\d)/', '', $normal) ?? $normal;
        $normal = preg_replace('/[^A-Z0-9 ]+/', ' ', $normal) ?? '';

        $tokens = array_values(array_filter(
            preg_split('/\s+/', trim($normal)) ?: [],
            fn (string $t) => $t !== '' && ! in_array($t, self::STOPWORDS, true),
        ));

        if ($tokens === []) {
            return 'ART';
        }

        $familia = substr($tokens[0], 0, 3);

        // Palabra -> inicial; token con dígito (medida/año/modelo: R14, 1.8, 16V)
        // -> se guarda entero para no perder la distinción.
        $partes = [];
        foreach (array_slice($tokens, 1) as $t) {
            $partes[] = preg_match('/\d/', $t) ? $t : substr($t, 0, 1);
        }

        // Agrupa las iniciales sueltas y mantiene los tokens numéricos aparte,
        // acotando el largo para que el código no se dispare.
        $iniciales = '';
        $extras = [];
        foreach ($partes as $p) {
            if (strlen($p) === 1) {
                $iniciales .= $p;
            } else {
                $extras[] = $p;
            }
        }

        $segmentos = array_filter([$familia, $iniciales, ...array_slice($extras, 0, 2)]);

        return implode('-', $segmentos);
    }

    /**
     * Código único: parte del base y agrega sufijo numérico si ya está tomado.
     * `$existe(string $codigo): bool` decide si un código ya está en uso.
     */
    public static function unico(string $nombre, callable $existe): string
    {
        $base = self::base($nombre);

        if (! $existe($base)) {
            return $base;
        }

        $i = 2;
        while ($existe($base.$i)) {
            $i++;
        }

        return $base.$i;
    }

    /**
     * Familia del artículo: 3 primeras letras de la primera palabra útil.
     *
     *   "Amortiguador Delantero Derecho Corolla" -> AMO
     *   "Filtro Aceite Etios 13/16"              -> FIL
     */
    public static function familia(string $nombre): string
    {
        $normal = (string) Str::of($nombre)->ascii()->upper();
        $normal = preg_replace('/[^A-Z0-9 ]+/', ' ', $normal) ?? '';

        $tokens = array_values(array_filter(
            preg_split('/\s+/', trim($normal)) ?: [],
            fn (string $t) => $t !== '' && ! in_array($t, self::STOPWORDS, true),
        ));

        return $tokens === [] ? 'ART' : substr($tokens[0], 0, 3);
    }

    /**
     * Código corto: familia + correlativo de 2 dígitos dentro de esa familia
     * (AMO-01, AMO-02, FIL-01). Largo fijo de 6 caracteres.
     *
     * `$existe(string $codigo): bool` decide si un código ya está en uso.
     */
    public static function corto(string $nombre, callable $existe): string
    {
        $familia = self::familia($nombre);

        $i = 1;
        while ($existe($codigo = $familia.'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT))) {
            $i++;
        }

        return $codigo;
    }
}
