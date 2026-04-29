import * as React from 'react'
import { render } from '@react-email/components'
import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { fmtDate } from '@/lib/restaurant'

/**
 * Server-side email automation cron endpoint.
 * Called every hour by pg_cron — sends reminders (24h before) and follow-ups (day after).
 * Auth: requires Bearer <service_role_key> header.
 */
export const Route = createFileRoute('/api/cron/email-automation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseServiceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7).trim() !== supabaseServiceKey) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = supabaseAdmin
        const origin = request.headers.get('origin') || 'https://www.unobuono.xyz'

        const now = new Date()
        const tomorrow = new Date(now.getTime() + 86400e3).toISOString().slice(0, 10)
        const yesterday = new Date(now.getTime() - 86400e3).toISOString().slice(0, 10)

        let remindersQueued = 0
        let followupsQueued = 0

        // Load all restaurants with their settings
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('id, name')

        for (const restaurant of restaurants || []) {
          const { data: settings } = await supabase
            .from('restaurant_settings')
            .select('name, reminder_24h, followup_enabled, google_maps_url')
            .eq('restaurant_id', restaurant.id)
            .maybeSingle()

          if (!settings) continue

          // ── Reminder 24h ──────────────────────────────────────────────
          if (settings.reminder_24h) {
            const { data: toRemind } = await supabase
              .from('reservations')
              .select('id, customer_name, customer_email, date, time, party_size, manage_token')
              .eq('restaurant_id', restaurant.id)
              .eq('date', tomorrow)
              .eq('reminder_sent', false)
              .neq('status', 'cancelled')
              .not('customer_email', 'is', null)

            for (const r of toRemind || []) {
              if (!r.customer_email) continue
              try {
                const manageUrl = r.manage_token ? `${origin}/manage/${r.manage_token}` : undefined
                await enqueueEmail(supabase, {
                  templateName: 'booking-reminder',
                  recipientEmail: r.customer_email,
                  reservationId: r.id,
                  templateData: {
                    customerName: r.customer_name,
                    restaurantName: settings.name,
                    date: fmtDate(r.date),
                    time: r.time,
                    partySize: r.party_size,
                    manageUrl,
                  },
                })
                await supabase.from('reservations').update({ reminder_sent: true }).eq('id', r.id)
                remindersQueued++
              } catch (e) {
                console.error('Failed to queue reminder', r.id, e)
              }
            }
          }

          // ── Follow-up post-cena ────────────────────────────────────────
          if (settings.followup_enabled) {
            const { data: toFollowup } = await supabase
              .from('reservations')
              .select('id, customer_name, customer_email')
              .eq('restaurant_id', restaurant.id)
              .eq('date', yesterday)
              .eq('followup_sent', false)
              .eq('arrived', true)
              .not('customer_email', 'is', null)

            for (const r of toFollowup || []) {
              if (!r.customer_email) continue
              try {
                await enqueueEmail(supabase, {
                  templateName: 'booking-followup',
                  recipientEmail: r.customer_email,
                  reservationId: r.id,
                  templateData: {
                    customerName: r.customer_name,
                    restaurantName: settings.name,
                    reviewUrl: settings.google_maps_url || undefined,
                  },
                })
                await supabase.from('reservations').update({ followup_sent: true }).eq('id', r.id)
                followupsQueued++
              } catch (e) {
                console.error('Failed to queue followup', r.id, e)
              }
            }
          }
        }

        console.log('email-automation cron', { remindersQueued, followupsQueued })
        return Response.json({ ok: true, remindersQueued, followupsQueued })
      },
    },
  },
})

const SENDER_DOMAIN = 'notify.unobuono.xyz'
const SITE_NAME = 'Unobuono'

async function enqueueEmail(
  supabase: typeof supabaseAdmin,
  opts: {
    templateName: string
    recipientEmail: string
    reservationId: string
    templateData: Record<string, any>
  }
) {
  const template = TEMPLATES[opts.templateName]
  if (!template) throw new Error(`Template not found: ${opts.templateName}`)

  const normalizedEmail = opts.recipientEmail.toLowerCase()

  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (suppressed) return

  const messageId = crypto.randomUUID()
  const idempotencyKey = `cron-${opts.templateName}-${opts.reservationId}`

  const element = React.createElement(template.component, opts.templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject = typeof template.subject === 'function' ? template.subject(opts.templateData) : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: opts.recipientEmail,
    status: 'pending',
  })

  await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: opts.recipientEmail,
      from: `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.templateName,
      idempotency_key: idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  })
}
