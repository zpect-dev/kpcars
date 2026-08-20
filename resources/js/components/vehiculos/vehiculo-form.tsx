import type { useForm } from '@inertiajs/react';
import { Check, FileText } from 'lucide-react';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { EstadoPatente } from '@/components/vehiculos/estado-vehiculo';
import {
    ESTADO_PATENTE_OPCIONES,
    estadoPatenteBadge,
} from '@/components/vehiculos/estado-vehiculo';
import { VtvMonthYearPicker } from '@/components/vehiculos/vtv-picker';
import { cn } from '@/lib/utils';
import type { Empresa, Inversion, User } from '@/types';

/** Formulario de vehículo, compartido por el alta y la edición. */
interface VehiculoFormProps {
    form: ReturnType<
        typeof useForm<{
            patente: string;
            marca: string;
            modelo: string;
            anio: string;
            propietario: string;
            precio: string;
            inversion_id: string;
            empresa_id: string;
            user_id: string;
            fecha_vencimiento_vtv: string;
            fecha_vencimiento_gnc: string;
            estado_patente: string;
        }>
    >;
    onSubmit: (e: React.FormEvent) => void;
    onCancel?: () => void;
    onDocumentos?: () => void;
    empresas: Pick<Empresa, 'id' | 'nombre'>[];
    inversiones: Pick<Inversion, 'id' | 'nombre'>[];
    users: Pick<User, 'id' | 'name'>[];
    submitLabel: string;
}

export function VehiculoForm({
    form,
    onSubmit,
    onCancel,
    onDocumentos,
    empresas,
    inversiones,
    users,
    submitLabel,
}: VehiculoFormProps) {
    const canSubmit =
        !form.processing &&
        form.data.patente.trim() !== '' &&
        form.data.marca.trim() !== '' &&
        form.data.modelo.trim() !== '' &&
        form.data.anio.trim() !== '' &&
        form.data.inversion_id !== '';

    const inversionOptions: ComboboxOption[] = inversiones.map((i) => ({
        value: String(i.id),
        label: i.nombre,
    }));

    const empresaOptions: ComboboxOption[] = empresas.map((e) => ({
        value: String(e.id),
        label: e.nombre,
    }));

    const userOptions: ComboboxOption[] = users.map((u) => ({
        value: String(u.id),
        label: u.name,
    }));

    return (
        <form onSubmit={onSubmit}>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="patente">Patente</Label>
                    <Input
                        id="patente"
                        type="text"
                        placeholder="Ej. ABC123"
                        value={form.data.patente}
                        onChange={(e) => form.setData('patente', e.target.value.toUpperCase())}
                    />
                    <InputError message={form.errors.patente} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="anio">Año</Label>
                    <Input
                        id="anio"
                        type="text"
                        placeholder="Ej. 2024"
                        value={form.data.anio}
                        onChange={(e) => form.setData('anio', e.target.value)}
                    />
                    <InputError message={form.errors.anio} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                        id="marca"
                        type="text"
                        placeholder="Ej. Toyota"
                        value={form.data.marca}
                        onChange={(e) => form.setData('marca', e.target.value)}
                    />
                    <InputError message={form.errors.marca} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                        id="modelo"
                        type="text"
                        placeholder="Ej. Corolla"
                        value={form.data.modelo}
                        onChange={(e) => form.setData('modelo', e.target.value)}
                    />
                    <InputError message={form.errors.modelo} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Estado de patente</Label>
                <Select
                    value={form.data.estado_patente || '__none__'}
                    onValueChange={(v) => form.setData('estado_patente', v === '__none__' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue>
                            {form.data.estado_patente ? (
                                <span className="flex items-center gap-2">
                                    <span className={cn('h-2 w-2 shrink-0 rounded-full', estadoPatenteBadge(form.data.estado_patente as EstadoPatente).dot)} />
                                    {estadoPatenteBadge(form.data.estado_patente as EstadoPatente).label}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">Sin estado</span>
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Sin estado</SelectItem>
                        {ESTADO_PATENTE_OPCIONES.map((opt) => {
                            const b = estadoPatenteBadge(opt.value);

                            return (
                                <SelectItem key={opt.value} value={opt.value}>
                                    <span className="flex items-center gap-2">
                                        <span className={cn('h-2 w-2 shrink-0 rounded-full', b.dot)} />
                                        {opt.label}
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                <InputError message={form.errors.estado_patente} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="propietario">Titular</Label>
                    <Input
                        id="propietario"
                        type="text"
                        placeholder="Nombre del titular"
                        value={form.data.propietario}
                        onChange={(e) => form.setData('propietario', e.target.value)}
                    />
                    <InputError message={form.errors.propietario} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="precio">Precio</Label>
                    <MoneyInput
                        id="precio"
                        placeholder="Ej. 360.000,00"
                        value={form.data.precio === '' ? null : Number(form.data.precio)}
                        onValueChange={(n) => form.setData('precio', n == null ? '' : String(n))}
                    />
                    <InputError message={form.errors.precio} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="inversion_id">Inversión</Label>
                <Combobox
                    id="inversion_id"
                    placeholder="Buscar inversión..."
                    options={inversionOptions}
                    value={form.data.inversion_id}
                    onSelect={(o) => form.setData('inversion_id', o.value)}
                />
                <InputError message={form.errors.inversion_id} />
            </div>

            {empresaOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="empresa_id">Empresa</Label>
                    <Combobox
                        id="empresa_id"
                        placeholder="Buscar empresa..."
                        options={empresaOptions}
                        value={form.data.empresa_id}
                        onSelect={(o) => form.setData('empresa_id', o.value)}
                    />
                    <InputError message={form.errors.empresa_id} />
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="user_id">Conductor asignado</Label>
                <Combobox
                    id="user_id"
                    placeholder="Buscar conductor..."
                    options={userOptions}
                    value={form.data.user_id}
                    onSelect={(o) => form.setData('user_id', o.value)}
                />
                <InputError message={form.errors.user_id} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label>Vencimiento VTV</Label>
                    <VtvMonthYearPicker
                        value={form.data.fecha_vencimiento_vtv}
                        onChange={(v) => form.setData('fecha_vencimiento_vtv', v)}
                    />
                    <InputError message={form.errors.fecha_vencimiento_vtv} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>Vencimiento GNC</Label>
                    <VtvMonthYearPicker
                        value={form.data.fecha_vencimiento_gnc}
                        onChange={(v) => form.setData('fecha_vencimiento_gnc', v)}
                    />
                    <InputError message={form.errors.fecha_vencimiento_gnc} />
                </div>
            </div>

        </div>
        <DialogFooter className="flex-row items-center border-t border-border px-5 py-4 sm:justify-between">
            {onDocumentos && (
                <Button type="button" variant="ghost" size="sm" onClick={onDocumentos}>
                    <FileText className="h-4 w-4" /> Documentos
                </Button>
            )}
            <div className="flex items-center gap-2">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" disabled={!canSubmit}>
                    {form.processing ? 'Procesando...' : <><Check className="h-4 w-4" /> {submitLabel}</>}
                </Button>
            </div>
        </DialogFooter>
        </form>
    );
}
