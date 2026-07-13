import { useState, useMemo } from 'react';
import { Camera, Copy, Crop, Download, FileText, Share2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import InputError from '@/components/input-error';
import { useImageCropper, type CropInput } from '@/components/image-cropper';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export interface DocUrls {
    pdf: string | null;
    frente: string | null;
    dorso: string | null;
}

export type DocMode = 'pdf' | 'imagenes';

export interface DocPreview {
    url: string;
    name: string;
    type?: 'image' | 'pdf';
}

export type OnDocPreview = (url: string, name: string, type: 'image' | 'pdf') => void;

const IMG_ACCEPT = { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] };
const PDF_ACCEPT = { 'application/pdf': ['.pdf'] };

async function shareDoc(url: string, name: string) {
    if (!navigator.share) {
        await navigator.clipboard.writeText(url);
        return 'copied';
    }
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : '.jpg';
        const file = new File([blob], `${name}${ext}`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: name });
            return 'shared';
        }
    } catch {
        // si falla el fetch o el canShare, intento con URL
    }
    try {
        await navigator.share({ url, title: name });
        return 'shared';
    } catch {
        // usuario canceló
    }
    return null;
}

function ShareButton({ url, name, className }: { url: string; name: string; className?: string }) {
    const [state, setState] = useState<'idle' | 'copied'>('idle');

    async function handleShare() {
        const result = await shareDoc(url, name);
        if (result === 'copied') {
            setState('copied');
            setTimeout(() => setState('idle'), 2000);
        }
    }

    return (
        <button
            type="button"
            onClick={handleShare}
            className={cn(
                'inline-flex items-center gap-1 text-xs font-medium transition-colors',
                state === 'copied'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground hover:text-foreground',
                className,
            )}
        >
            {state === 'copied'
                ? <><Copy className="h-3.5 w-3.5" /> Copiado</>
                : <><Share2 className="h-3.5 w-3.5" /> Compartir</>
            }
        </button>
    );
}

export function DocImageDropzone({
    label,
    file,
    existingUrl,
    onDrop,
    onPreview,
}: {
    label: string;
    file: File | null;
    existingUrl?: string | null;
    onDrop: (files: File[]) => void;
    onPreview: OnDocPreview;
}) {
    const { cropImage, cropperElement } = useImageCropper();

    async function handleCropDrop(files: File[]) {
        const f = files[0];
        if (!f) return;
        try {
            onDrop([await cropImage(f)]);
        } catch {
            // recorte cancelado: no cambia nada
        }
    }

    async function recropCurrent() {
        const input: CropInput | null = file
            ? file
            : existingUrl
              ? { url: existingUrl, name: label }
              : null;
        if (!input) return;
        try {
            onDrop([await cropImage(input)]);
        } catch {
            // recorte cancelado: no cambia nada
        }
    }

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: handleCropDrop,
        accept: IMG_ACCEPT,
        maxFiles: 1,
        multiple: false,
        noClick: true,
    });

    const previewUrl = useMemo(
        () => (file ? URL.createObjectURL(file) : existingUrl),
        [file, existingUrl],
    );

    const isExisting = !file && !!existingUrl;

    return (
        <div className="flex flex-col gap-1">
            {cropperElement}
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <div
                {...getRootProps()}
                className={cn(
                    'group relative flex aspect-[3/2] items-center justify-center overflow-hidden rounded-md border-2 transition-colors',
                    isDragActive ? 'border-solid border-primary bg-primary/10' : 'border-dashed border-border bg-muted',
                )}
            >
                <input {...getInputProps()} />
                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt={label}
                            onClick={() => onPreview(previewUrl, label, 'image')}
                            className="h-full w-full cursor-zoom-in object-cover"
                        />
                        <div className="absolute right-1 bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                                type="button"
                                onClick={recropCurrent}
                                className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                            >
                                <Crop className="h-3 w-3" /> Recortar
                            </button>
                            <button
                                type="button"
                                onClick={open}
                                className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                            >
                                <Camera className="h-3 w-3" /> Reemplazar
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={open}
                        className="flex h-full w-full flex-col items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                        <Camera className="mb-1 h-5 w-5 opacity-50" />
                        <span className="text-[10px] font-medium uppercase opacity-70">Subir</span>
                    </button>
                )}
            </div>
            {isExisting && (
                <div className="flex items-center gap-3">
                    <a
                        href={existingUrl!}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                        <Download className="h-3 w-3" /> Descargar
                    </a>
                    <ShareButton url={existingUrl!} name={label} className="text-[11px]" />
                </div>
            )}
        </div>
    );
}

export function DocPdfDropzone({
    title,
    file,
    existingUrl,
    onDrop,
    onPreview,
}: {
    title: string;
    file: File | null;
    existingUrl?: string | null;
    onDrop: (files: File[]) => void;
    onPreview: OnDocPreview;
}) {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: PDF_ACCEPT,
        maxFiles: 1,
        multiple: false,
        noClick: true,
    });

    const previewUrl = useMemo(
        () => (file ? URL.createObjectURL(file) : existingUrl),
        [file, existingUrl],
    );

    const isExisting = !file && !!existingUrl;

    return (
        <div
            {...getRootProps()}
            className={cn(
                'flex flex-col gap-2 rounded-md border-2 p-2 transition-colors',
                isDragActive ? 'border-solid border-primary bg-primary/10' : 'border-dashed border-border bg-muted',
            )}
        >
            <input {...getInputProps()} />
            {previewUrl ? (
                <>
                    <div
                        onClick={() => onPreview(previewUrl, title, 'pdf')}
                        className="group relative h-36 cursor-zoom-in overflow-hidden rounded border border-border bg-white"
                    >
                        <iframe
                            src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                            title={title}
                            className="pointer-events-none h-full w-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-black">Ampliar</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <a
                                href={previewUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                            >
                                <Download className="h-3.5 w-3.5" /> Descargar
                            </a>
                            {isExisting && <ShareButton url={existingUrl!} name={title} />}
                        </div>
                        <button
                            type="button"
                            onClick={open}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            <FileText className="h-3.5 w-3.5" /> Reemplazar
                        </button>
                    </div>
                </>
            ) : (
                <button
                    type="button"
                    onClick={open}
                    className="flex items-center gap-3 px-1 py-2 text-left"
                >
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        Arrastrá un PDF (ambas caras) o hacé clic
                    </span>
                </button>
            )}
        </div>
    );
}

export function DocumentSection({
    title,
    mode,
    onModeChange,
    pdfFile,
    onPdfDrop,
    frenteFile,
    onFrenteDrop,
    dorsoFile,
    onDorsoDrop,
    existing,
    onPreview,
    error,
}: {
    title: string;
    mode: DocMode;
    onModeChange: (mode: DocMode) => void;
    pdfFile: File | null;
    onPdfDrop: (files: File[]) => void;
    frenteFile: File | null;
    onFrenteDrop: (files: File[]) => void;
    dorsoFile: File | null;
    onDorsoDrop: (files: File[]) => void;
    existing?: DocUrls;
    onPreview: OnDocPreview;
    error?: string;
}) {
    return (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <div className="inline-flex rounded-md border border-border p-0.5">
                    {(['pdf', 'imagenes'] as DocMode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => onModeChange(m)}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                                mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {m === 'pdf' ? 'PDF' : 'Imágenes'}
                        </button>
                    ))}
                </div>
            </div>

            {mode === 'pdf' ? (
                <DocPdfDropzone title={title} file={pdfFile} existingUrl={existing?.pdf} onDrop={onPdfDrop} onPreview={onPreview} />
            ) : (
                <div className="grid grid-cols-2 gap-2.5">
                    <DocImageDropzone label="Frente" file={frenteFile} existingUrl={existing?.frente} onDrop={onFrenteDrop} onPreview={onPreview} />
                    <DocImageDropzone label="Dorso" file={dorsoFile} existingUrl={existing?.dorso} onDrop={onDorsoDrop} onPreview={onPreview} />
                </div>
            )}

            {mode === 'imagenes' && (
                <p className="text-[11px] text-muted-foreground">Podés subir el frente y el dorso por separado (una cara ahora y la otra más adelante).</p>
            )}

            <InputError message={error} />
        </div>
    );
}

/**
 * Dropzone para un documento de un único archivo (PDF o imagen).
 */
export function DocSingleDropzone({
    title,
    file,
    existingUrl,
    existingIsPdf,
    onDrop,
    onPreview,
}: {
    title: string;
    file: File | null;
    existingUrl?: string | null;
    existingIsPdf?: boolean;
    onDrop: (files: File[]) => void;
    onPreview: OnDocPreview;
}) {
    const { cropImage, cropperElement } = useImageCropper();

    async function handleDrop(files: File[]) {
        const f = files[0];
        if (!f) return;
        // Solo las imágenes pasan por el editor de recorte; los PDF van directo.
        if (f.type.startsWith('image/')) {
            try {
                onDrop([await cropImage(f)]);
            } catch {
                // recorte cancelado
            }
            return;
        }
        onDrop(files);
    }

    async function recropCurrent() {
        const input: CropInput | null = file
            ? file
            : existingUrl
              ? { url: existingUrl, name: title }
              : null;
        if (!input) return;
        try {
            onDrop([await cropImage(input)]);
        } catch {
            // recorte cancelado
        }
    }

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: handleDrop,
        accept: { ...PDF_ACCEPT, ...IMG_ACCEPT },
        maxFiles: 1,
        multiple: false,
        noClick: true,
    });

    const previewUrl = useMemo(
        () => (file ? URL.createObjectURL(file) : existingUrl),
        [file, existingUrl],
    );
    const isPdf = file ? file.type === 'application/pdf' : !!existingIsPdf;
    const isExisting = !file && !!existingUrl;

    return (
        <div
            {...getRootProps()}
            className={cn(
                'flex flex-col gap-2 rounded-md border-2 p-2 transition-colors',
                isDragActive ? 'border-solid border-primary bg-primary/10' : 'border-dashed border-border bg-muted',
            )}
        >
            {cropperElement}
            <input {...getInputProps()} />
            {previewUrl ? (
                <>
                    <div
                        onClick={() => onPreview(previewUrl, title, isPdf ? 'pdf' : 'image')}
                        className="group relative h-36 cursor-zoom-in overflow-hidden rounded border border-border bg-white"
                    >
                        {isPdf ? (
                            <iframe
                                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                                title={title}
                                className="pointer-events-none h-full w-full"
                            />
                        ) : (
                            <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-black">Ampliar</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <a
                                href={previewUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                            >
                                <Download className="h-3.5 w-3.5" /> Descargar
                            </a>
                            {isExisting && <ShareButton url={existingUrl!} name={title} />}
                        </div>
                        <div className="flex items-center gap-3">
                            {!isPdf && (
                                <button
                                    type="button"
                                    onClick={recropCurrent}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    <Crop className="h-3.5 w-3.5" /> Recortar
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={open}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                <FileText className="h-3.5 w-3.5" /> Reemplazar
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <button
                    type="button"
                    onClick={open}
                    className="flex items-center gap-3 px-1 py-2 text-left"
                >
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        Arrastrá un PDF o imagen, o hacé clic
                    </span>
                </button>
            )}
        </div>
    );
}

/**
 * Modal de previsualización ampliada de un documento (imagen o PDF).
 */
export function DocPreviewDialog({
    preview,
    onClose,
}: {
    preview: DocPreview | null;
    onClose: () => void;
}) {
    return (
        <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn('border-none bg-transparent p-0 shadow-none', preview?.type === 'pdf' ? 'max-w-5xl' : 'max-w-3xl')}>
                <DialogHeader className="sr-only">
                    <DialogTitle>{preview?.name ?? 'Documento'}</DialogTitle>
                </DialogHeader>
                {preview && (
                    preview.type === 'pdf' ? (
                        <iframe
                            src={preview.url}
                            title={preview.name}
                            className="h-[85vh] w-full rounded-lg bg-white"
                        />
                    ) : (
                        <img
                            src={preview.url}
                            alt={preview.name}
                            className="max-h-[85vh] w-full rounded-lg object-contain"
                        />
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
