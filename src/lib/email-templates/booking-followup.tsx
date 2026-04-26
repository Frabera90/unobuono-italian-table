import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  customerName?: string
  restaurantName?: string
  reviewUrl?: string
}

const BookingFollowup = ({ customerName, restaurantName, reviewUrl }: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{`Come è andata${restaurantName ? ` da ${restaurantName}` : ''}?`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Com'è andata? 🌟</Heading>
        <Text style={text}>
          {customerName ? `Ciao ${customerName},` : 'Ciao,'} speriamo tu abbia trascorso una bellissima serata{restaurantName ? ` da ${restaurantName}` : ''}.
        </Text>
        <Section style={card}>
          <Text style={row}>La tua opinione ci aiuta a migliorare ogni giorno. Ci vogliono solo 30 secondi.</Text>
        </Section>
        {reviewUrl && (
          <Button href={reviewUrl} style={button}>Lascia una recensione ⭐</Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>Grazie per averci scelto{restaurantName ? ` — ${restaurantName}` : ''}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingFollowup,
  subject: (d: Record<string, any>) => `Com'è andata${d?.restaurantName ? ` da ${d.restaurantName}` : ''}?`,
  displayName: 'Follow-up post-cena',
  previewData: {
    customerName: 'Marta',
    restaurantName: 'Unobuono',
    reviewUrl: 'https://g.page/r/ristorante/review',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 14px' }
const card = { backgroundColor: '#fdf6e3', border: '1px solid #eee', borderRadius: '10px', padding: '14px 16px', margin: '12px 0 18px' }
const row = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const button = { backgroundColor: '#c0392b', color: '#fff', padding: '12px 18px', borderRadius: '8px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888' }
