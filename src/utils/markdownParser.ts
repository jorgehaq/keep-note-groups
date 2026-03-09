/**
 * Sanitiza contenido Markdown para evitar colisiones por bloques de código anidados.
 * Convierte los ``` internos en texto plano (ej. \`\`\`).
 */
export const sanitizeNestedCodeBlocks = (text: string): string => {
    if (!text.includes("```")) return text;

    const lines = text.split("\n");
    let isCodeBlockOpen = false;

    return lines.map((line) => {
        const hasBackticks = line.trim().startsWith("```");

        if (hasBackticks) {
            if (!isCodeBlockOpen) {
                isCodeBlockOpen = true; // Abre el bloque principal
                return line;
            } else {
                // Si ya está abierto, revisamos si es un cierre válido o anidamiento
                // Asumimos que si tiene texto inmediatamente después, es un intento de anidar (ej: ```javascript)
                if (line.trim().length > 3) {
                    return line.replace(/```/g, "\\`\\`\\`"); // Escapa backticks anidados
                } else {
                    isCodeBlockOpen = false; // Cierra el bloque principal
                    return line;
                }
            }
        }

        // Si contiene ``` inline dentro de un bloque de código, escápalo
        if (isCodeBlockOpen && line.includes("```")) {
            return line.replace(/```/g, "\\`\\`\\`");
        }

        return line;
    }).join("\n");
};
