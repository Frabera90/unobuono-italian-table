import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  restaurantName?: string
  eventType?: 'new_booking' | 'new_preorder' | 'cancellation'
  customerName?: string
  date?: string
  time?: string
  partySize?: number
  details?: string
  dashboardUrl?: string
}

const LABELS: Record<string, { emoji: string; title: string }> = {
  new_booking: { emoji: '📅', title: 'Nuova prenotazione' },
  new_preorder: { emoji: '🛵', title: 'Nuovo pre-ordine' },
  cancellation: { emoji: '❌', title: 'Disdetta prenotazione' },
}

const OwnerNotification = ({ restaurantName, eventType = 'new_booking', customerName, date, time, partySize, details, dashboardUrl }: Props) => {
  const label = LABELS[eventType] || LABELS.new_booking
  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>{`${label.emoji} ${label.title}${customerName ? ` — ${customerName}` : ''}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{label.emoji} {label.title}</Heading>
          {restaurantName && <Text style={subtle}>{restaurantName}</Text>}
          <Section style={card}>
            {customerName && <Text style={row}><strong>Cliente:</strong> {customerName}</Text>}
            {date && <Text style={row}><strong>Quando:</strong> {date}{time ? ` alle ${time}` : ''}</Text>}
            {partySize !== undefined && <Text style={row}><strong>Persone:</strong> {partySize}</Text>}
            {details && <Text style={row}>{details}</Text>}
          </Section>
          {dashboardUrl
            ? <Button href={dashboardUrl} style={button}>Apri la dashboard</Button>
            : <Text style={text}>Apri la dashboard per gestire questo evento.</Text>
          }
          <Hr style={hr} />
          <Text style={footer}>Notifica automatica — Unobuono</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OwnerNotification,
  subject: (d: Record<string, any>) => {
    const l = LABELS[d?.eventType as string] || LABELS.new_booking
    return `${l.emoji} ${l.title}${d?.customerName ? ` — ${d.customerName}` : ''}`
  },
  displayName: 'Notifica proprietario',
  previewData: {
    restaurantName: 'Unobuono',
    eventType: 'new_booking',
    customerName: 'Marta Rossi',
    date: 'venerdì 25 aprile',
    time: '20:30',
    partySize: 2,
    dashboardUrl: 'https://unobuono.xyz/owner',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 6px' }
const subtle = { fontSize: '12px', color: '#888', margin: '0 0 14px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 14px' }
const card = { backgroundColor: '#fdf6e3', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', margin: '8px 0 18px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffe66d', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '0 0 14px' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888' }
