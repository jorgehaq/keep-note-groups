# Contexto del Proyecto (PROJECT_CONTEXT.md)

Este documento sirve como memoria técnica y auditoría del estado actual del proyecto `keep-note-groups`.

## 1. Estructura de Componentes

La aplicación sigue una estructura jerárquica simple centrada en `App.tsx`.

*   **`App.tsx` (Root)**: Contenedor principal que maneja todo el estado global, efectos y lógica de negocio.
    *   **`Sidebar`** (`components/Sidebar.tsx`): Panel lateral para la gestión y selección de grupos de notas.
    *   **`SettingsWindow`** (`components/SettingsWindow.tsx`): Modal para configuración (actualmente solo tema).
    *   **`AccordionItem`** (`components/AccordionItem.tsx`): Renderiza cada nota individualmente dentro del área principal.
        *   Probablemente interactúa con `LinkifiedText` (`components/LinkifiedText.tsx`) para el contenido.

**Relación:** `App` pasa props (estado y funciones dispatch/handlers) directamente a sus hijos. No hay "prop drilling" profundo detectado dado que la estructura es plana (solo 1 nivel de profundidad mayormente).

## 2. Estado (State Management)
El estado es **local y centralizado en `App.tsx`** usando React Hooks estándar (`useState`).

*   **`groups`**: Array de objetos `Group` que contiene toda la información (grupos y sus notas).
*   **`activeGroupId`**: ID del grupo actualmente seleccionado.
*   **`searchQuery`**: Texto para el filtrado de notas.
*   **`theme`**: Preferencia de tema ('light', 'dark', 'system').
*   **`isSettingsOpen`**: Visibilidad del modal de configuración.

**No se utilizan librerías externas** como Redux, Zustand o Context API. Todo el flujo de datos es unidireccional (Parent -> Child).

## 3. Persistencia de Datos
La persistencia se maneja manualmente con `localStorage` en `App.tsx`.

*   **Clave Principal:** `'accordion-notes-app-v2'`
*   **Ubicación de Lectura:** `App.tsx` (líneas 34-52) - Se lee al inicializar el estado `groups`. Incluye lógica de migración automática desde la clave antigua `'accordion-notes-app'`.
*   **Ubicación de Escritura:** `App.tsx` (líneas 62-64) - `useEffect` que guarda el estado `groups` cada vez que cambia.

## 4. Estilos
La aplicación utiliza **Tailwind CSS** cargado vía CDN.

*   **Fuente:** `<script src="https://cdn.tailwindcss.com"></script>` en `index.html` (línea 7).
*   **Configuración:** Objeto `tailwind.config` inyectado directamente en un script en `index.html` (líneas 8-23), definiendo modo oscuro ('class') y colores personalizados (`slate`).
*   **Iconos:** Librería `lucide-react` importada en los componentes.
*   **CSS Adicional:** Bloque `<style>` en `index.html` para scrollbars personalizados y utilidades de texto vertical. No existe un archivo CSS global (`index.css` o similares) importado en el JS.

## 5. Dependencias Clave (package.json)
*   **Framework:** React 19 (`react`, `react-dom`).
*   **Build Tool:** Vite (`vite`, `@vitejs/plugin-react`).
*   **Lenguaje:** TypeScript (`typescript`).
*   **Iconos:** `lucide-react`.
*   *Nota:* Tailwind NO está en `package.json`, se depende puramente del CDN.
