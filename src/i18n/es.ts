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

  /**
   * Auth errors are translated even though Spanish is only ~10% complete.
   * An error message is the one moment a user is stuck, and falling back to
   * English exactly then is the worst possible time to do it. These strings
   * carry no tax or legal weight, so the review rule above does not apply.
   */
  auth: {
    signUpTitle: 'Cree su cuenta',
    loginTitle: 'Bienvenido de nuevo',
    email: 'Correo electrónico',
    password: 'Contraseña',
    phone: 'Número de teléfono',
    ownerName: 'Su nombre',
    haveAccount: '¿Ya tiene una cuenta?',
    noAccount: '¿Es nuevo aquí?',
    phoneOptional: 'Opcional',
    passwordHint: 'Al menos 8 caracteres.',
    signingIn: 'Iniciando sesión…',
    creatingAccount: 'Creando su cuenta…',
    forgotPassword: '¿Olvidó su contraseña?',
    resetSent:
      'Si ese correo tiene una cuenta, le enviamos un enlace para restablecerla. Revise su bandeja de entrada.',
    confirmEmailTitle: 'Confirme su correo',
    confirmEmailBody:
      'Enviamos un enlace de confirmación a su correo. Ábralo para terminar de configurar su cuenta.',
    identityUnavailable:
      'No pudimos cargar su cuenta ahora mismo. Sus datos están seguros. Inténtelo de nuevo.',
    errors: {
      invalid_credentials: 'Ese correo y contraseña no coinciden. Inténtelo de nuevo.',
      email_not_confirmed: 'Confirme su correo primero. Busque el enlace en su bandeja de entrada.',
      email_taken: 'Ese correo ya está registrado. Intente iniciar sesión.',
      weak_password: 'Use una contraseña de al menos 8 caracteres.',
      invalid_email: 'Ingrese un correo electrónico válido.',
      rate_limited: 'Demasiados intentos. Espere un minuto e inténtelo de nuevo.',
      required_fields: 'Complete todos los campos obligatorios.',
      network: 'No pudimos conectar con nuestros servidores. Revise su conexión e inténtelo de nuevo.',
      not_configured: 'El inicio de sesión no está disponible en este entorno.',
      unknown: 'Algo salió mal. Inténtelo de nuevo.',
    },
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
