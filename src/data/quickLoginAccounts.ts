/**

 * Local/dev convenience accounts for one-click login.

 * Optional TRIKOMEX / pilot accounts come from VITE_DEMO_* env vars only.

 */



export type QuickLoginAccount = {

  id: string

  label: string

  description: string

  identifier: string

  password: string

  logoClass?: string

}



function readEnvAccount(

  id: string,

  label: string,

  identifierKey: string,

  passwordKey: string,

  descriptionFallback: string,

): QuickLoginAccount | null {

  const env = import.meta.env as Record<string, string | undefined>

  const identifier = env[identifierKey]?.trim()

  const password = env[passwordKey]?.trim()

  if (!identifier || !password) return null

  return {

    id,

    label,

    description: descriptionFallback.replace('{id}', identifier),

    identifier,

    password,

  }

}



/** Visible outside production builds (dev / pilot testing). Easy to delete later. */

export function isQuickLoginEnabled(): boolean {

  if (import.meta.env.PROD && import.meta.env.ENABLE_DEMO_MODE !== 'true') {

    return false

  }

  return true

}



export function getQuickLoginAccounts(): QuickLoginAccount[] {

  return [

    readEnvAccount(

      'trikomex-admin',

      'TRIKOMEX Admin',

      'VITE_DEMO_TRIKOMEX_EMAIL',

      'VITE_DEMO_TRIKOMEX_PASSWORD',

      '{id} · stabilizasyon',

    ),

    readEnvAccount(

      'asma',

      'Asma',

      'VITE_DEMO_ASMA_EMAIL',

      'VITE_DEMO_ASMA_PASSWORD',

      '{id} · muhasebe',

    ),

    readEnvAccount(

      'amel',

      'Amel',

      'VITE_DEMO_AMEL_EMAIL',

      'VITE_DEMO_AMEL_PASSWORD',

      '{id} · OWNER',

    ),

    readEnvAccount(

      'adem',

      'Adem',

      'VITE_DEMO_ADEM_LOGIN',

      'VITE_DEMO_ADEM_PASSWORD',

      '{id} · üretim',

    ),

  ].filter((account): account is QuickLoginAccount => account !== null)

}

