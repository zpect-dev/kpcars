import { Camera, Crop } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useImageCropper } from '@/components/image-cropper';
import type { CropInput } from '@/components/image-cropper';
import { cn } from '@/lib/utils';

/** Foto de perfil con arrastrar-y-soltar y recorte previo. */
export function AvatarDropzone({
    file,
    currentUrl,
    onDrop,
}: {
    file: File | null;
    currentUrl?: string | null;
    onDrop: (files: File[]) => void;
}) {
    const { cropImage, cropperElement } = useImageCropper();

    async function handleDrop(files: File[]) {
        const f = files[0];

        if (!f) {
            return;
        }

        try {
            onDrop([await cropImage(f)]);
        } catch {
            // recorte cancelado: no cambia nada
        }
    }

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: handleDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
        },
        maxFiles: 1,
        multiple: false,
        noClick: true,
    });

    const previewUrl = useMemo(
        () => (file ? URL.createObjectURL(file) : currentUrl),
        [file, currentUrl],
    );

    async function recropCurrent(e: MouseEvent) {
        e.stopPropagation();
        const input: CropInput | null = file
            ? file
            : currentUrl
              ? { url: currentUrl, name: 'avatar' }
              : null;

        if (!input) {
            return;
        }

        try {
            onDrop([await cropImage(input)]);
        } catch {
            // recorte cancelado: no cambia nada
        }
    }

    return (
        <>
            {cropperElement}
            <div
                {...getRootProps()}
                onClick={open}
                className={cn(
                    'group relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-colors',
                    isDragActive
                        ? 'border-solid border-primary bg-primary/10'
                        : 'border-dashed border-border bg-muted hover:border-primary/50',
                )}
            >
                <input {...getInputProps()} />
                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt="Foto de perfil"
                            className="size-full bg-muted object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <span title="Reemplazar" className="text-white">
                                <Camera aria-hidden="true" className="size-5" />
                            </span>
                            <button
                                type="button"
                                onClick={recropCurrent}
                                title="Recortar"
                                aria-label="Recortar la foto actual"
                                className="rounded text-white transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Crop aria-hidden="true" className="size-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-muted-foreground outline-none">
                        <Camera
                            aria-hidden="true"
                            className="mb-1 size-6 opacity-50 transition-opacity group-hover:opacity-100"
                        />
                        <span className="text-xs font-medium uppercase opacity-70 group-hover:opacity-100">
                            Subir
                        </span>
                    </div>
                )}
            </div>
        </>
    );
}
