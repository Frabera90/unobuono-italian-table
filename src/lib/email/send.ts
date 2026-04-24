/**
 * Invia un'email transazionale tramite il route server /lovable/email/transactional/send.
 * Per trigger pubblici (senza utente autenticato) il route accetta comunque la chiamata
 * — l'email viene messa in coda e processata dal cron.
 */
export interface SendTransactionalEmailParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, any>
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  try {
    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      console.warn('sendTransactionalEmail failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.warn('sendTransactionalEmail error', e)
  }
}
