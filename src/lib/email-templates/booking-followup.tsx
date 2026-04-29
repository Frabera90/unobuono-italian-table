import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  customerName?: string
  restaurantName?: string
}

const BookingFollowup = ({ customerName, restaurantName }: Props) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>{`Grazie${restaurantName ? ` da ${restaurantName}` : ''} — speriamo di rivederti presto!`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Grazie per la tua visita 🙏</Heading>
        <Text style={text}>
          {customerName ? `Ciao ${customerName},` : 'Ciao,'} speriamo tu abbia trascorso una bellissima serata{restaurantName ? ` da ${restaurantName}` : ''}.
        </Text>
        <Text style={text}>
          È stato un piacere averti con noi. Ti aspettiamo presto!
        </Text>
        <Hr style={hr} />
        <Text style={footer}>A presto{restaurantName ? ` — ${restaurantName}` : ''}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingFollowup,
  subject: (d: Record<string, any>) => `Grazie per la tua visita${d?.restaurantName ? ` da ${d.restaurantName}` : ''}!`,
  displayName: 'Follow-up post-cena',
  previewData: {
    customerName: 'Marta',
    restaurantName: 'Unobuono',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.55', margin: '0 0 14px' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#888' }
