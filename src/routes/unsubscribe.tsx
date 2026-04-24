import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({ meta: [{ title: 'Disiscrizione — Unobuono' }] }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const [state, setState] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'done' | 'error'>('loading')
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    if (!t) { setState('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState('valid')
        else if (d.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('error'))
  }, [])

  async function confirm() {
    if (!token) return
    const r = await fetch('/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const d = await r.json().catch(() => ({}))
    if (d.success || d.reason === 'already_unsubscribed') setState('done')
    else setState('error')
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border-2 border-ink bg-paper p-7 text-center">
        <h1 className="font-display text-3xl uppercase">Disiscrizione email</h1>
        {state === 'loading' && <p className="mt-4 text-sm text-ink/70">Verifica in corso…</p>}
        {state === 'valid' && (
          <>
            <p className="mt-4 text-sm text-ink/70">Confermi di voler smettere di ricevere email da noi?</p>
            <button onClick={confirm} className="mt-5 w-full rounded-lg border-2 border-ink bg-yellow py-3 text-sm font-bold uppercase tracking-wider">
              Conferma disiscrizione
            </button>
          </>
        )}
        {state === 'already' && <p className="mt-4 text-sm text-ink/70">Sei già disiscritto.</p>}
        {state === 'invalid' && <p className="mt-4 text-sm text-ink/70">Link non valido o scaduto.</p>}
        {state === 'done' && <p className="mt-4 text-sm text-ink/70">Disiscrizione completata. Non riceverai più email.</p>}
        {state === 'error' && <p className="mt-4 text-sm text-destructive">Errore. Riprova più tardi.</p>}
      </div>
    </main>
  )
}
