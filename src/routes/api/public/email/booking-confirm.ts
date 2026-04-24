import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Unobuono'
const SENDER_DOMAIN = 'notify.unobuono.xyz'
const FROM_DOMAIN = 'notify.unobuono.xyz'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [l, d] = email.split('@')
  if (!l || !d) return '***'
  return `${l[0]}***@${d}`
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Public, unauthenticated trigger for transactional emails (e.g. booking
 * confirmations sent to anonymous guests). Whitelisted templates only.
 */
const PUBLIC_TEMPLATES = new Set(['booking-confirmation'])

export const Route = createFileRoute('/api/public/email/booking-confirm')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let templateName: string
        let recipientEmail: string
        let idempotencyKey: string
        let templateData: Record<string, any> = {}
        let reservationId: string | undefined
        try {
          const body = await request.json()
          templateName = body.templateName
          recipientEmail = body.recipientEmail
          reservationId = body.reservationId
          idempotencyKey = body.idempotencyKey || crypto.randomUUID()
          if (body.templateData && typeof body.templateData === 'object') templateData = body.templateData
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        if (!templateName || !PUBLIC_TEMPLATES.has(templateName)) {
          return Response.json({ error: 'Template not allowed' }, { status: 403 })
        }
        if (!recipientEmail || !reservationId) {
          return Response.json({ error: 'recipientEmail and reservationId required' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Validate reservation exists (anti-spam: must reference a real reservation)
        const { data: resv } = await supabase
          .from('reservations')
          .select('id')
          .eq('id', reservationId)
          .maybeSingle()
        if (!resv) {
          return Response.json({ error: 'Reservation not found' }, { status: 404 })
        }

        const template = TEMPLATES[templateName]
        if (!template) return Response.json({ error: 'Template not found' }, { status: 404 })

        const messageId = crypto.randomUUID()
        const normalizedEmail = recipientEmail.toLowerCase()

        // Suppression check
        const { data: suppressed } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (suppressed) {
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // Unsubscribe token (one per email)
        let unsubscribeToken: string
        const { data: existingToken } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()
        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          unsubscribeToken = generateToken()
          await supabase
            .from('email_unsubscribe_tokens')
            .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })
          const { data: stored } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()
          unsubscribeToken = stored?.token || unsubscribeToken
        } else {
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })
        const subject =
          typeof template.subject === 'function' ? template.subject(templateData) : template.subject

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: recipientEmail,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: recipientEmail,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue', enqueueError)
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: recipientEmail,
            status: 'failed',
            error_message: 'Failed to enqueue',
          })
          return Response.json({ error: 'Failed to enqueue' }, { status: 500 })
        }

        console.log('Public booking-confirm enqueued', { recipient: redactEmail(recipientEmail) })
        return Response.json({ success: true, queued: true })
      },
    },
  },
})
