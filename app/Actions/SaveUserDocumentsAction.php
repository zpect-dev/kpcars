<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SaveUserDocumentsAction
{
    /**
     * Carpeta dentro del disco 'public' donde viven los documentos.
     */
    private const DISK = 'public';
    private const FOLDER = 'documentos';

    /**
     * Procesa la carga de documentos (licencia y DNI) de un usuario.
     *
     * Cada documento es opcional y mutuamente excluyente: o un PDF (con ambas
     * caras adentro) o dos imágenes (frente y dorso). La validación previa en
     * el controlador garantiza que no lleguen ambas modalidades a la vez y que,
     * si llega una imagen, lleguen las dos.
     */
    public function execute(User $user, Request $request): void
    {
        $updates = [];

        foreach (['licencia', 'dni'] as $tipo) {
            $updates += $this->procesarDocumento($user, $request, $tipo);
        }

        if ($updates !== []) {
            $user->update($updates);
        }
    }

    /**
     * @return array<string, string|null>
     */
    private function procesarDocumento(User $user, Request $request, string $tipo): array
    {
        $pdfKey    = "{$tipo}_pdf";
        $frenteKey = "{$tipo}_frente";
        $dorsoKey  = "{$tipo}_dorso";

        // Modalidad PDF: reemplaza por completo el documento (limpia imágenes).
        if ($request->hasFile($pdfKey)) {
            $this->delete($user->{"{$tipo}_pdf_path"});
            $this->delete($user->{"{$tipo}_frente_path"});
            $this->delete($user->{"{$tipo}_dorso_path"});

            return [
                "{$tipo}_pdf_path"    => $request->file($pdfKey)->store(self::FOLDER, self::DISK),
                "{$tipo}_frente_path" => null,
                "{$tipo}_dorso_path"  => null,
            ];
        }

        // Modalidad imágenes.
        if ($request->hasFile($frenteKey) || $request->hasFile($dorsoKey)) {
            $updates = [];

            // Al pasar a imágenes se descarta cualquier PDF previo.
            if ($user->{"{$tipo}_pdf_path"}) {
                $this->delete($user->{"{$tipo}_pdf_path"});
                $updates["{$tipo}_pdf_path"] = null;
            }

            if ($request->hasFile($frenteKey)) {
                $this->delete($user->{"{$tipo}_frente_path"});
                $updates["{$tipo}_frente_path"] = $request->file($frenteKey)->store(self::FOLDER, self::DISK);
            }

            if ($request->hasFile($dorsoKey)) {
                $this->delete($user->{"{$tipo}_dorso_path"});
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
