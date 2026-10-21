// English and Spanish for the AI Reviewer screens. Browser-safe: nothing server-only in this file.
// English is the key. A phrase with no Spanish entry shows in English, so nothing ever goes blank.
import type { Verdict } from './aiShared';

export type Lang = 'en' | 'es';
export const LANG_COOKIE = 'ai_lang';
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'es';

const ES: Record<string, string> = {
  // header, tabs, status
  'AI Reviewer': 'Revisor IA',
  'AI Review': 'Revisión IA',
  History: 'Historial',
  Clients: 'Clientes',
  'Checking…': 'Comprobando…',
  'AI active': 'IA activa',
  'AI slow': 'IA lenta',
  'AI down': 'IA caída',
  'AI status': 'Estado de la IA',
  'Check again': 'Comprobar de nuevo',
  'Click to check again.': 'Haz clic para comprobar de nuevo.',
  'Language': 'Idioma',
  // review page
  'Check images against a checklist before they go to proofing.': 'Revisa las imágenes con una lista de verificación antes de enviarlas a revisión.',
  'The Anthropic API key is not set on this server, so reviews will fail. Add': 'La clave de la API de Anthropic no está configurada en este servidor, así que las revisiones fallarán. Agrega',
  'to': 'a',
  'and restart.': 'y reinicia.',
  Client: 'Cliente',
  'No client (ad hoc checklist)': 'Sin cliente (lista temporal)',
  'Image type': 'Tipo de imagen',
  'Choose a type…': 'Elige un tipo…',
  'No clients yet. Add one under Clients to save a checklist per client.': 'Aún no hay clientes. Agrega uno en Clientes para guardar una lista por cliente.',
  Checklist: 'Lista de verificación',
  'No criteria. The AI will judge general image quality.': 'Sin criterios. La IA juzgará la calidad general de la imagen.',
  'Add a criterion': 'Agregar un criterio',
  Add: 'Agregar',
  'Changes here apply to this batch only. Save them for good under Clients.': 'Los cambios aquí solo valen para este lote. Guárdalos de forma permanente en Clientes.',
  'This session': 'Esta sesión',
  Reviews: 'Revisiones',
  'Tokens in / out': 'Tokens de entrada / salida',
  'Estimated cost': 'Costo estimado',
  Model: 'Modelo',
  'Drop images or a whole folder here': 'Suelta imágenes o una carpeta completa aquí',
  'JPG, PNG, WebP or GIF, up to {n} MB each': 'JPG, PNG, WebP o GIF, hasta {n} MB cada una',
  'Choose images': 'Elegir imágenes',
  'Choose a folder': 'Elegir una carpeta',
  'Reviewing…': 'Revisando…',
  'Review {n} image': 'Revisar {n} imagen',
  'Review {n} images': 'Revisar {n} imágenes',
  'All reviewed': 'Todo revisado',
  '{a} of {b}': '{a} de {b}',
  Clear: 'Limpiar',
  All: 'Todos',
  Ready: 'Listo',
  'Needs revisions': 'Necesita cambios',
  Fails: 'No cumple',
  Waiting: 'En espera',
  Retry: 'Reintentar',
  'Nothing here yet. Pick a client and image type to load their checklist, then drop the images to review.': 'Todavía no hay nada. Elige un cliente y un tipo de imagen para cargar su lista, y luego suelta las imágenes para revisarlas.',
  Review: 'Revisión',
  Close: 'Cerrar',
  'Review detail': 'Detalle de la revisión',
  'Remove {c}': 'Quitar {c}',
  'Over {n} MB. Export a smaller copy.': 'Pesa más de {n} MB. Exporta una copia más pequeña.',
  'Only JPG, PNG, WebP and GIF images are reviewed.': 'Solo se revisan imágenes JPG, PNG, WebP y GIF.',
  '{n} file skipped': '{n} archivo omitido',
  '{n} files skipped': '{n} archivos omitidos',
  // verdicts
  'Ready for proofing': 'Listo para revisión',
  // review detail
  Copied: 'Copiado',
  'Copy list': 'Copiar lista',
  'What to fix': 'Qué corregir',
  '{a} of {b} passed': '{a} de {b} aprobados',
  "Markers are the AI's best estimate of where a problem is. Treat them as a pointer, not a measurement.": 'Los marcadores son la mejor estimación de la IA sobre dónde está un problema. Tómalos como una pista, no como una medida.',
  'No client': 'Sin cliente',
  'Translating…': 'Traduciendo…',
  'Showing the original English. The translation is not available right now.': 'Se muestra el inglés original. La traducción no está disponible en este momento.',
  // history
  'Every review is saved with the checklist it used.': 'Cada revisión se guarda con la lista que usó.',
  'Filter by result': 'Filtrar por resultado',
  'All clients': 'Todos los clientes',
  'All image types': 'Todos los tipos de imagen',
  'Search file names': 'Buscar nombres de archivo',
  'No reviews yet': 'Aún no hay revisiones',
  'Reviews you run on the AI Review page are saved here.': 'Las revisiones que hagas en la página Revisión IA se guardan aquí.',
  'No reviews match these filters.': 'Ninguna revisión coincide con estos filtros.',
  Today: 'Hoy',
  Yesterday: 'Ayer',
  'Change the result': 'Cambiar el resultado',
  'Deleting…': 'Eliminando…',
  'Delete review': 'Eliminar revisión',
  // clients
  'Save a checklist per client and image type. These clients are separate from your proofing clients.': 'Guarda una lista por cliente y tipo de imagen. Estos clientes son independientes de tus clientes de pruebas.',
  '+ Add client': '+ Agregar cliente',
  '{n} types · {m} criteria': '{n} tipos · {m} criterios',
  'No clients yet.': 'Aún no hay clientes.',
  'Add your first client': 'Agrega tu primer cliente',
  'Each client gets six image types to start (Reel, Flyer, Photo Resize, Carousel, Story, Profile Logo). Add checklists to each.': 'Cada cliente empieza con seis tipos de imagen (Reel, Flyer, Redimensionar foto, Carrusel, Historia, Logo de perfil). Agrega listas a cada uno.',
  'Client icon': 'Ícono del cliente',
  'PNG, JPG, WebP or GIF, up to 2 MB. It is cropped to a square.': 'PNG, JPG, WebP o GIF, hasta 2 MB. Se recorta en forma cuadrada.',
  'Replace icon': 'Cambiar ícono',
  'Upload icon': 'Subir ícono',
  Remove: 'Quitar',
  'That image is over 2 MB. Please choose a smaller one.': 'Esa imagen pesa más de 2 MB. Elige una más pequeña.',
  'Client name': 'Nombre del cliente',
  'Notes (optional)': 'Notas (opcional)',
  'Saving…': 'Guardando…',
  Save: 'Guardar',
  'Checked in every image type': 'Se revisa en todos los tipos de imagen',
  'Add a criterion for all types': 'Agregar un criterio para todos los tipos',
  'Image type name': 'Nombre del tipo de imagen',
  'Delete type': 'Eliminar tipo',
  'Delete the "{name}" type and its criteria?': '¿Eliminar el tipo "{name}" y sus criterios?',
  'Add a criterion for {name}': 'Agregar un criterio para {name}',
  Criterion: 'Criterio',
  'Move up': 'Subir',
  'Move down': 'Bajar',
  'Delete criterion': 'Eliminar criterio',
  '+ Add an image type (for example Menu or Banner)': '+ Agregar un tipo de imagen (por ejemplo Menú o Banner)',
  'New image type': 'Nuevo tipo de imagen',
  'Add type': 'Agregar tipo',
  'Danger zone': 'Zona de riesgo',
  'Delete "{name}" and all their saved checklists? Past reviews stay in History.': '¿Eliminar a "{name}" y todas sus listas guardadas? Las revisiones pasadas se quedan en el Historial.',
  'Delete client…': 'Eliminar cliente…',
  'Add client': 'Agregar cliente',
  Cancel: 'Cancelar',
  'Adding…': 'Agregando…',
};

// Messages that come from the server in English. Exact ones first, then patterns that carry a number or detail.
const SERVER: Record<string, string> = {
  'Checking the AI connection…': 'Comprobando la conexión con la IA…',
  'Cannot reach the app. Check your connection.': 'No se puede conectar con la app. Revisa tu conexión.',
  'No Anthropic API key is set on the server.': 'No hay una clave de la API de Anthropic en el servidor.',
  'Connected to Anthropic.': 'Conectado con Anthropic.',
  'Anthropic rejected the API key. Check the key in .env.': 'Anthropic rechazó la clave de la API. Revisa la clave en .env.',
  'This API key is not allowed to use the API.': 'Esta clave no tiene permiso para usar la API.',
  'Anthropic is rate limiting requests. Reviews may be slow.': 'Anthropic está limitando las solicitudes. Las revisiones pueden tardar.',
  'Anthropic is having problems right now.': 'Anthropic tiene problemas en este momento.',
  'The server cannot reach Anthropic.': 'El servidor no puede conectarse con Anthropic.',
  'The check could not complete.': 'No se pudo completar la comprobación.',
  'Out of API credits. Add credits in the Anthropic console.': 'Sin créditos de la API. Agrega créditos en la consola de Anthropic.',
  'No image received.': 'No se recibió ninguna imagen.',
  'Use a JPG, PNG, WebP or GIF image.': 'Usa una imagen JPG, PNG, WebP o GIF.',
  'Something went wrong while reviewing this image.': 'Algo salió mal al revisar esta imagen.',
  'ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart.': 'ANTHROPIC_API_KEY no está configurada en el servidor. Agrégala a .env y reinicia.',
  'The AI response could not be parsed as JSON. Try reviewing again.': 'No se pudo leer la respuesta de la IA. Intenta revisar de nuevo.',
  'Could not reach the server. Check your connection and try again.': 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  'Only JPG, PNG, WebP and GIF images are reviewed.': 'Solo se revisan imágenes JPG, PNG, WebP y GIF.',
};
const SERVER_RE: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Anthropic answered with an error \((\d+)\)\.$/, (m) => `Anthropic respondió con un error (${m[1]}).`],
  [/^The last review failed: ([\s\S]*)$/, (m) => `La última revisión falló: ${m[1]}`],
  [/^Images can be up to (\d+) MB\.$/, (m) => `Las imágenes pueden pesar hasta ${m[1]} MB.`],
  [/^Over (\d+) MB\. Export a smaller copy\.$/, (m) => `Pesa más de ${m[1]} MB. Exporta una copia más pequeña.`],
  [/^Claude API error \((.*?)\): ([\s\S]*)$/, (m) => `Error de la API de Claude (${m[1]}): ${m[2]}`],
  [/^Claude's response was cut off before finishing/, () => 'La respuesta de Claude se cortó antes de terminar. Sube AI_REVIEWER_MAX_TOKENS o baja AI_REVIEWER_EFFORT.'],
  [/^Unexpected error calling Claude: ([\s\S]*)$/, (m) => `Error inesperado al llamar a Claude: ${m[1]}`],
];

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s);

/** Translates an interface phrase. English is the key, so English passes straight through. */
export function tr(lang: Lang, s: string, vars?: Record<string, string | number>) {
  return fill(lang === 'es' ? ES[s] ?? s : s, vars);
}

/** Translates a message the server produced (status reasons, review errors). Unknown text stays as it is. */
export function serverMsg(lang: Lang, s: string) {
  if (lang !== 'es' || !s) return s;
  if (SERVER[s]) return SERVER[s];
  for (const [re, f] of SERVER_RE) { const m = re.exec(s); if (m) return f(m); }
  return s;
}

const VERDICT_EN: Record<Verdict, { label: string; short: string }> = {
  approved: { label: 'Ready for proofing', short: 'Ready' },
  needs_review: { label: 'Needs revisions', short: 'Needs revisions' },
  rejected: { label: 'Fails', short: 'Fails' },
};
export const verdictText = (lang: Lang, v: Verdict) => ({ label: tr(lang, VERDICT_EN[v].label), short: tr(lang, VERDICT_EN[v].short) });

export const locale = (lang: Lang) => (lang === 'es' ? 'es-US' : 'en-US');
