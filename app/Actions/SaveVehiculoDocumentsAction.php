<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Vehiculo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SaveVehiculoDocumentsAction
{
    private const DISK = 'public';
    private const FOLDER = 'documentos-vehiculos';

    /**
     * Procesa la carga de documentos del vehículo.
     *
     * - Cédula y Título: o un PDF (con ambas caras) o dos imágenes (frente y
     *   dorso), nunca ambas modalidades a la vez. La validación previa lo
     *   garantiza, igual que en los documentos de usuario.
     * - Seguro: un único archivo (PDF o imagen).
     *
     * La fecha de vencimiento del seguro NO se maneja aquí: es un campo simple
     * que persiste el controlador.
     */
    public function execute(Vehiculo $vehiculo, Request $request): void
    {
        $updates = [];

        foreach (['cedula', 'titulo'] as $tipo) {
            $updates += $this->procesarDual($vehiculo, $request, $tipo);
        }

        if ($request->hasFile('seguro')) {
            $this->delete($vehiculo->seguro_path);
            $updates['seguro_path'] = $request->file('seguro')->store(self::FOLDER, self::DISK);
        }

        if ($updates !== []) {
            $vehiculo->update($updates);
        }
    }

    /**
     * Documento de doble cara (cédula / título): PDF o frente+dorso.
     *
     * @return array<string, string|null>
     */
    private function procesarDual(Vehiculo $vehiculo, Request $request, string $tipo): array
    {
        $pdfKey    = "{$tipo}_pdf";
        $frenteKey = "{$tipo}_frente";
        $dorsoKey  = "{$tipo}_dorso";

        // Modalidad PDF: reemplaza por completo el documento (limpia imágenes).
        if ($request->hasFile($pdfKey)) {
            $this->delete($vehiculo->{"{$tipo}_pdf_path"});
            $this->delete($vehiculo->{"{$tipo}_frente_path"});
            $this->delete($vehiculo->{"{$tipo}_dorso_path"});

            return [
                "{$tipo}_pdf_path"    => $request->file($pdfKey)->store(self::FOLDER, self::DISK),
                "{$tipo}_frente_path" => null,
                "{$tipo}_dorso_path"  => null,
            ];
        }

        // Modalidad imágenes.
        if ($request->hasFile($frenteKey) || $request->hasFile($dorsoKey)) {
            $updates = [];

            if ($vehiculo->{"{$tipo}_pdf_path"}) {
                $this->delete($vehiculo->{"{$tipo}_pdf_path"});
                $updates["{$tipo}_pdf_path"] = null;
            }

            if ($request->hasFile($frenteKey)) {
                $this->delete($vehiculo->{"{$tipo}_frente_path"});
                $updates["{$tipo}_frente_path"] = $request->file($frenteKey)->store(self::FOLDER, self::DISK);
            }

            if ($request->hasFile($dorsoKey)) {
                $this->delete($vehiculo->{"{$tipo}_dorso_path"});
                $updates["{$tipo}_dorso_path"] = $request->file($dorsoKey)->store(self::FOLDER, self::DISK);
            }

            return $updates;
        }

        return [];
    }

    private function delete(?string $path): void
    {
        if ($path) {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
