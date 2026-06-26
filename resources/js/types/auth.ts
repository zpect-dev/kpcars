export type UserRole = 'administrador' | 'administrativo' | 'mecanico' | 'inversor' | 'chofer';

export type User = {
    id: number;
    name: string;
    dni: string;
    correo?: string | null;
    role?: UserRole;
    empresa_id?: number | null;
    empresa_default_id?: number | null;
    profile_photo_url?: string;
    avatar?: string;
    two_factor_enabled?: boolean;
    created_at?: string;
    updated_at?: string;

    [key: string]: unknown;
};

/**
 * Empresa simplificada para auth.active_company / auth.empresas_disponibles.
 * El tipo completo (con timestamps) vive en `./models`.
 */
export type AuthEmpresa = {
    id: number;
    nombre: string;
};

/**
 * Diccionario de capacidades del usuario autenticado.
 *
 * Cada key se llena en HandleInertiaRequests::permissionsFor(); el listado
 * de Gates expuestos vive en HandleInertiaRequests::EXPOSED_GATES.
 */
export type Permissions = Partial<{
    can_switch_empresa: boolean;
    can_view_vehiculos: boolean;
    can_manage_vehiculos: boolean;
    can_view_inventario: boolean;
    can_manage_inventario: boolean;
    can_manage_precios: boolean;
    can_view_turnos: boolean;
    can_manage_turnos: boolean;
    can_view_revisiones: boolean;
    can_manage_revisiones: boolean;
    can_view_service: boolean;
    can_manage_service: boolean;
    can_view_personal: boolean;
    can_manage_users: boolean;
    can_view_historial: boolean;
    can_view_cobros: boolean;
    can_manage_cobros: boolean;
    can_view_recaudaciones: boolean;
    can_manage_recaudaciones: boolean;
    can_view_gastos: boolean;
    can_manage_gastos: boolean;
    can_view_inversiones: boolean;
    can_manage_inversiones: boolean;
    can_view_cierres_inversion: boolean;
    can_manage_cierres_inversion: boolean;
    can_annul_transactions: boolean;
    can_import_asignaciones: boolean;
    can_view_mi_cuenta: boolean;
}>;

export type Auth = {
    user: User | null;
    active_company: AuthEmpresa | null;
    empresas_disponibles: AuthEmpresa[];
    permissions: Permissions;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
