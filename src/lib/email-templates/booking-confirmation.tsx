import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  customerName?: string
  restaurantName?: string
  date?: string
  time?: string
  partySize?: number
  manageUrl?: string
}

const BookingConfirmation = ({ customerName, restaurantName, date, time, partySize, manageUrl }: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{`Prenotazione confermata${restaurantName ? ` da ${restaurantName}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Prenotazione confermata ✓</Heading>
        <Text style={text}>
          {customerName ? `Ciao ${customerName}, ` : 'Ciao, '}
          la tua prenotazione{restaurantName ? ` da ${restaurantName}` : ''} è confermata.
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Quando:</strong> {date} alle {time}</Text>
          <Text style={row}><strong>Persone:</strong> {partySize}</Text>
        </Section>
        {manageUrl && (
          <>
            <Text style={text}>Puoi modificare, pre-ordinare o disdire qui:</Text>
            <Button href={manageUrl} style={button}>Gestisci prenotazione</Button>
          </>
        )}
        <Hr style={hr} />
        <Text style={footer}>A presto!{restaurantName ? ` — ${restaurantName}` : ''}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmation,
  subject: (d: Record<string, any>) => `Prenotazione confermata${d?.date ? ` per ${d.date}` : ''}`,
  displayName: 'Conferma prenotazione',
  previewData: {
    customerName: 'Marta',
    restaurantName: 'Unobuono',
    date: 'venerdì 25 aprile',
    time: '20:30',
    partySize: 2,
    manageUrl: 'https://unobuono.xyz/manage/abc123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 14px' }
const card = { backgroundColor: '#fdf6e3', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', margin: '12px 0 18px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffe66d', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888' }
