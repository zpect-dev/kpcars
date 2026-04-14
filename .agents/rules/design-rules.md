---
trigger: always_on
---

## Reglas Estrictas de Diseño y UI (Laravel React Starter Kit)
Fidelidad Absoluta al Starter Kit:

El diseño DEBE usar exclusivamente los componentes, la estructura y la estética predeterminada de Laravel Breeze (React).

Paleta de Colores Restringida (Monocromática):

Estás OBLIGADO a utilizar únicamente la paleta neutra predeterminada de Tailwind CSS.

Colores permitidos: Fondos blancos (bg-white), fondos grises muy claros (bg-gray-50, bg-gray-100), textos negros (text-black, text-gray-900) y grises secundarios para textos menores y bordes (text-gray-500, border-gray-200).

Prohibición estricta: NO introduzcas colores primarios (nada de azules, índigos, verdes, etc.) en botones, enlaces o fondos. Los botones principales deben ser negros (bg-gray-900 o bg-black con texto blanco) como viene en el kit original.

Única excepción de color: Se permite usar el estándar semántico de Tailwind ÚNICAMENTE para las alertas (Flash Data) y validaciones: rojo para errores/stock bajo (text-red-600, bg-red-100) y amarillo para advertencias.

NUNCA edites el archivo tailwind.config.js para agregar colores personalizados.

Reutilización de Componentes:

Antes de maquetar cualquier vista, escanea obligatoriamente la carpeta resources/js/Components.

Tienes que usar <PrimaryButton>, <SecondaryButton>, <TextInput>, <InputLabel>, <InputError> y <Modal> exactamente como vienen de fábrica.

Tipografía y Sombras:

Usa solo las fuentes y sombras por defecto del Starter Kit (shadow-sm para tarjetas, sin bordes redondeados exagerados, máximo rounded-md).