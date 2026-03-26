-- Agregar el campo subtitle a la tabla de notas
ALTER TABLE notes 
ADD COLUMN subtitle TEXT;

COMMENT ON COLUMN notes.subtitle IS 'Subtítulo o título secundario editable para la nota principal, subnotas y resúmenes AI.';
