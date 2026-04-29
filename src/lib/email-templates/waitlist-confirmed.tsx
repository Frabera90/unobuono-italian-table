import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  customerName?: string
  restaurantName?: string
  date?: string
  time?: string
  partySize?: number
  manageUrl?: string
  bookingCode?: string
}

const WaitlistConfirmed = ({ customerName, restaurantName, date, time, partySize, manageUrl, bookingCode }: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{`Buone notizie! Si è liberato un posto${restaurantName ? ` da ${restaurantName}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🎉 Si è liberato un posto!</Heading>
        <Text style={text}>
          {customerName ? `Ciao ${customerName},` : 'Ciao,'} la tua attesa è finita.
          La tua prenotazione{restaurantName ? ` da ${restaurantName}` : ''} è confermata!
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Quando:</strong> {date} alle {time}</Text>
          <Text style={row}><strong>Persone:</strong> {partySize}</Text>
          {bookingCode && (
            <Text style={codeRow}><strong>Codice:</strong> <span style={codeSpan}>{bookingCode}</span></Text>
          )}
        </Section>
        {manageUrl && (
          <>
            <Text style={text}>Puoi modificare il pre-ordine o disdire qui:</Text>
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
  component: WaitlistConfirmed,
  subject: (d: Record<string, any>) => `Posto confermato${d?.date ? ` per ${d.date}` : ''} — ci vediamo!`,
  displayName: 'Waitlist confermata',
  previewData: {
    customerName: 'Marta',
    restaurantName: 'Unobuono',
    date: 'venerdì 25 aprile',
    time: '20:30',
    partySize: 2,
    manageUrl: 'https://unobuono.xyz/manage/abc123',
    bookingCode: 'A3F7K2',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 14px' }
const card = { backgroundColor: '#fdf6e3', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', margin: '12px 0 18px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffe66d', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const codeRow = { fontSize: '14px', color: '#0a0a0a', margin: '8px 0 0', borderTop: '1px solid #eee', paddingTop: '8px' }
const codeSpan = { fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.25em', color: '#c0392b' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888' }
