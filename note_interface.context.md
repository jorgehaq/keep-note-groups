# Contexto de Feature: Note Interface UI/UX Refinement

## Propósito
Estandarizar y elevar la calidad visual de todos los puntos de acceso a notas y herramientas de edición, eliminando la pesadez visual (negritas, colores sólidos oscuros) en favor de un sistema de "iluminación suave" y ergonomía mejorada.

## Estado Local Manejado
- **Global Note Tray** (`App.tsx`): Controlado por `isGlobalNoteTrayOpen` y `focusedNoteId`. Sincroniza la visibilidad de la franja superior de pestañas con el estado de los acordeones.
- **Pizarrón Orientation** (`useUIStore`): `forcedPizarronOrientation` ('vertical' | 'horizontal') permite al usuario elegir la disposición del split-pane de forma global y persistente.
- **Auto-scroll Logic** (`App.tsx`): Un `useEffect` monitorea `activeNoteId` para centrar automáticamente la pestaña correspondiente en la bandeja superior usando `scrollIntoView`.
- **Note Maximization** (`AccordionItem.tsx`): `isMaximized` conmuta entre ancho contenido (max-w-6xl) y ancho total de pantalla.

## Dependencias de Supabase
- **Tabla `notes`**: Actualización de la columna `is_open` para persistir cuáles notas deben aparecer expandidas en la sesión del usuario.
- **Realtime**: Sincronización de los cambios de título y estado de las notas reflejados instantáneamente en la bandeja de accesos.

## Reglas de UI Estrictas (Design System)
- **Botones de Pestaña (Tabs)**:
    - **Fondo**: `bg-[color]-50` (Light) / `bg-[color]-500/10` (Dark).
    - **Texto**: `text-[color]-700` (Light) / `text-[color]-400` (Dark).
    - **Borde**: `border-[color]-500/40`.
    - **Tipografía**: `font-medium` obligatoria; prohibido el uso de `font-bold` en etiquetas de texto de botones.
- **Dimensiones y Forma**:
    - **Altura Toolbar**: `h-[32.5px]` para botones de utilidad internos de la nota.
    - **Radio de Borde**: `rounded-lg` para todos los elementos de la nueva interfaz.
- **Legibilidad**:
    - **Padding Editor**: El contenido de los editores y pizarrones debe usar `px-8 py-6` para evitar que el texto toque los bordes y mejorar el enfoque.
- **Colores por Función**:
    - **Original / App**: Índigo.
    - **Subnotas**: Esmeralda.
    - **AI / Pizarrón**: Violeta.
    - **Alertas**: Rojo.
