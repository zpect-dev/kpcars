import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { cropToCanvas, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Crop as CropIcon, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * Convierte un canvas ya recortado en un File, preservando el formato de origen
 * cuando es PNG/WebP y usando JPEG en el resto de los casos.
 */
async function canvasToFile(
    canvas: HTMLCanvasElement,
    sourceName: string,
    sourceType: string,
): Promise<File> {
    const type =
        sourceType === 'image/png' || sourceType === 'image/webp'
            ? sourceType
            : 'image/jpeg';
    const quality = type === 'image/jpeg' ? 0.92 : undefined;

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, quality),
    );

    if (!blob) {
        throw new Error('No se pudo generar la imagen recortada.');
    }

    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const base = sourceName.replace(/\.[^.]+$/, '') || 'imagen';

    return new File([blob], `${base}.${ext}`, { type });
}

/**
 * Rota una imagen (múltiplos de 90°) redibujándola en un canvas con las
 * dimensiones intercambiadas y devuelve un objectURL. Así la imagen rotada
 * ocupa realmente su nuevo tamaño (vertical -> horizontal) y el área de
 * recorte deja de estar limitada al ancho original.
 */
function rotateImage(src: string, degrees: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const swap = degrees === 90 || degrees === 270;
            const canvas = document.createElement('canvas');
            canvas.width = swap ? image.naturalHeight : image.naturalWidth;
            canvas.height = swap ? image.naturalWidth : image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('No 2d context'));
                return;
            }
            ctx.imageSmoothingQuality = 'high';
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((degrees * Math.PI) / 180);
            ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('No se pudo rotar la imagen.'));
                    return;
                }
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        };
        image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
        image.src = src;
    });
}

interface PendingCrop {
    src: string;
    name: string;
    type: string;
    /** Archivo original (null cuando se re-recorta una imagen ya existente por URL). */
    file: File | null;
    /** Si `src` es un objectURL creado por nosotros y hay que revocarlo al cerrar. */
    isObjectUrl: boolean;
}

/** Entrada al editor: un archivo nuevo o una imagen existente por URL. */
export type CropInput = File | { url: string; name?: string };

/**
 * Hook que centraliza el flujo de recorte. Devuelve:
 * - `cropImage(input)`: abre el editor y resuelve con el File recortado
 *   (o el original si el usuario elige "Usar original"). Rechaza si cancela.
 * - `cropperElement`: el modal a renderizar una sola vez en el árbol.
 */
export function useImageCropper() {
    const [pending, setPending] = useState<PendingCrop | null>(null);
    const resolverRef = useRef<{
        resolve: (file: File) => void;
        reject: (reason?: unknown) => void;
    } | null>(null);

    const settle = useCallback(() => {
        setPending((prev) => {
            if (prev?.isObjectUrl) {
                URL.revokeObjectURL(prev.src);
            }

            return null;
        });
    }, []);

    const cropImage = useCallback(
        (input: CropInput) =>
            new Promise<File>((resolve, reject) => {
                resolverRef.current = { resolve, reject };

                if (input instanceof File) {
                    setPending({
                        src: URL.createObjectURL(input),
                        name: input.name,
                        type: input.type,
                        file: input,
                        isObjectUrl: true,
                    });
                } else {
                    const name = input.name || input.url.split('/').pop() || 'imagen';
                    setPending({
                        src: input.url,
                        name,
                        type: '',
                        file: null,
                        isObjectUrl: false,
                    });
                }
            }),
        [],
    );

    const handleConfirm = useCallback(
        (file: File) => {
            resolverRef.current?.resolve(file);
            resolverRef.current = null;
            settle();
        },
        [settle],
    );

    const handleCancel = useCallback(() => {
        resolverRef.current?.reject(new Error('cancelled'));
        resolverRef.current = null;
        settle();
    }, [settle]);

    const cropperElement = pending ? (
        <ImageCropperDialog
            pending={pending}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return { cropImage, cropperElement };
}

function ImageCropperDialog({
    pending,
    onConfirm,
    onCancel,
}: {
    pending: PendingCrop;
    onConfirm: (file: File) => void;
    onCancel: () => void;
}) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [scale, setScale] = useState(1);
    const [rotate, setRotate] = useState(0);
    const [displaySrc, setDisplaySrc] = useState(pending.src);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Al rotar (múltiplos de 90°) generamos una imagen realmente rotada para que
    // el recorte use las nuevas dimensiones. Reseteamos el recorte porque el
    // encuadre anterior deja de ser válido con la orientación nueva.
    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;

        if (rotate === 0) {
            setDisplaySrc(pending.src);
        } else {
            rotateImage(pending.src, rotate)
                .then((url) => {
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    objectUrl = url;
                    setDisplaySrc(url);
                })
                .catch(() => {
                    if (!cancelled) {
                        setError('No se pudo rotar la imagen.');
                    }
                });
        }

        setCrop(undefined);
        setCompletedCrop(null);

        return () => {
            cancelled = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [rotate, pending.src]);

    const rotateBy = (delta: number) =>
        setRotate((r) => ((r + delta) % 360 + 360) % 360);

    async function applyCrop() {
        const img = imgRef.current;
        if (!img) return;
        setBusy(true);
        setError(null);
        try {
            // La rotación ya está aplicada en `displaySrc`, por eso pasamos 0.
            const pixelCrop: PixelCrop =
                completedCrop && completedCrop.width && completedCrop.height
                    ? completedCrop
                    : {
                          unit: 'px',
                          x: 0,
                          y: 0,
                          width: img.width,
                          height: img.height,
                      };
            const canvas = document.createElement('canvas');
            await cropToCanvas(img, canvas, pixelCrop, scale, 0);
            const file = await canvasToFile(canvas, pending.name, pending.type);
            onConfirm(file);
        } catch {
            setError('No se pudo procesar la imagen. Probá con otra o usá el original.');
            setBusy(false);
        }
    }

    function useOriginal() {
        if (pending.file) {
            onConfirm(pending.file);
        } else {
            // Imagen ya existente: "usar original" equivale a no cambiar nada.
            onCancel();
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Recortar imagen</DialogTitle>
                </DialogHeader>

                <div className="flex max-h-[60vh] items-center justify-center overflow-auto rounded-md border border-border bg-muted/40 p-2">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-[56vh]"
                    >
                        <img
                            ref={imgRef}
                            src={displaySrc}
                            alt="Imagen a recortar"
                            style={{
                                transform: `scale(${scale})`,
                                maxHeight: '56vh',
                                maxWidth: '100%',
                            }}
                        />
                    </ReactCrop>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                            Zoom
                        </span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={scale}
                            onChange={(e) => setScale(Number(e.target.value))}
                            className="h-1 w-full cursor-pointer appearance-none rounded bg-border accent-foreground"
                        />
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {scale.toFixed(1)}x
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                            Girar
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => rotateBy(-90)}
                        >
                            <RotateCcw className="h-4 w-4" /> 90°
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => rotateBy(90)}
                        >
                            <RotateCw className="h-4 w-4" /> 90°
                        </Button>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                            {rotate}°
                        </span>
                    </div>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={useOriginal}
                        disabled={busy}
                    >
                        Usar original
                    </Button>
                    <Button type="button" onClick={applyCrop} disabled={busy}>
                        <CropIcon className="h-4 w-4" />
                        {busy ? 'Procesando…' : 'Recortar y usar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
