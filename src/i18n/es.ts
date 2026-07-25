import type { Dict } from './en';
import type { DeepPartial } from './merge';

/**
 * SPANISH — partial. Untranslated keys fall back to English (see merge.ts).
 *
 * Translation policy, the same standard applied to Vietnamese:
 *   - Marketing and UI copy: translated here.
 *   - Tax-critical strings (IRS form names, filing statuses, legal
 *     disclosures) are NOT machine-translated. They stay English until a
 *     qualified bilingual preparer reviews them, matched against IRS
 *     Publication 17 (Spanish). Those keys are intentionally absent so they
 *     fall back rather than render an unreviewed translation of language that
 *     carries legal weight.
 *
 * Coverage is roughly 10%. Commission a translator before launch.
 */
export const es: DeepPartial<Dict> = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    save: 'Guardar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    change: 'Cambiar',
    upload: 'Subir',
    download: 'Descargar',
    search: 'Buscar',
    filter: 'Filtrar',
    all: 'Todo',
    loading: 'Cargando',
    retry: 'Reintentar',
    errorTitle: 'Algo salió mal',
    errorBody: 'Vuelva a intentarlo. Si el problema continúa, contáctenos.',
    of: 'de',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    signOut: 'Cerrar sesión',
    language: 'Idioma',
    english: 'Inglés',
    vietnamese: 'Vietnamita',
    spanish: 'Español',
  },

  nav: {
    dashboard: 'Panel',
    transactions: 'Transacciones',
    receipts: 'Recibos',
    deductions: 'Deducciones',
    documents: 'Documentos',
    settings: 'Configuración',
  },

  marketing: {
    ctaPrimary: 'Comenzar',
    ctaSecondary: 'Programar una consulta',
    pickIndustry: 'Elija su tipo de negocio',
    howTitle: 'Cómo funciona',
    faqTitle: 'Preguntas frecuentes',
    finalCta: 'Organice su contabilidad',
  },

  states: {
    emptyGeneric: 'Todavía no hay nada aquí',
  },
};
