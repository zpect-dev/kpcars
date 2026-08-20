import { Form } from '@inertiajs/react';
import { useRef } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function DeleteUser() {
    const passwordInput = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Eliminar cuenta"
                description="Eliminá tu cuenta y todos sus datos asociados"
            />
            <div className="space-y-4 rounded-lg border border-destructive/20 bg-destructive-soft p-4">
                <div className="relative space-y-0.5 text-destructive-soft-foreground">
                    <p className="font-medium">Atención</p>
                    <p className="text-sm">
                        Esta acción no se puede deshacer.
                    </p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="destructive"
                            data-test="delete-user-button"
                        >
                            Eliminar cuenta
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>
                            ¿Seguro que querés eliminar tu cuenta?
                        </DialogTitle>
                        <DialogDescription>
                            Al eliminar la cuenta se borran de forma
                            permanente todos sus datos. Ingresá tu contraseña
                            para confirmar.
                        </DialogDescription>

                        <Form
                            {...ProfileController.destroy.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            onError={() => passwordInput.current?.focus()}
                            resetOnSuccess
                            className="space-y-6"
                        >
                            {({ resetAndClearErrors, processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor="password"
                                            className="sr-only"
                                        >
                                            Contraseña
                                        </Label>

                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            ref={passwordInput}
                                            placeholder="Contraseña"
                                            autoComplete="current-password"
                                        />

                                        <InputError message={errors.password} />
                                    </div>

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="secondary"
                                                onClick={() =>
                                                    resetAndClearErrors()
                                                }
                                            >
                                                Cancelar
                                            </Button>
                                        </DialogClose>

                                        <Button
                                            variant="destructive"
                                            disabled={processing}
                                            asChild
                                        >
                                            <button
                                                type="submit"
                                                data-test="confirm-delete-user-button"
                                            >
                                                Eliminar cuenta
                                            </button>
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
