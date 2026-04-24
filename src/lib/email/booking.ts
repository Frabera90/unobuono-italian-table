import { fmtDate } from "@/lib/restaurant";

type SendParams = {
  templateName: 'booking-confirmation' | 'booking-cancellation';
  recipientEmail: string;
  reservationId: string;
  templateData?: Record<string, any>;
  idempotencyKey?: string;
};

export async function sendBookingEmail({ templateName, recipientEmail, reservationId, templateData, idempotencyKey }: SendParams): Promise<void> {
  try {
    const res = await fetch('/api/public/email/booking-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName,
        recipientEmail,
        reservationId,
        idempotencyKey: idempotencyKey || `${templateName}-${reservationId}`,
        templateData,
      }),
    });
    if (!res.ok) console.warn('booking email failed', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.warn('booking email error', e);
  }
}

export function buildBookingEmailData(opts: {
  customerName?: string | null;
  restaurantName?: string | null;
  date: string;          // ISO YYYY-MM-DD
  time: string;
  partySize: number;
  manageUrl?: string;
  reason?: string;
}): Record<string, any> {
  return {
    customerName: opts.customerName || undefined,
    restaurantName: opts.restaurantName || undefined,
    date: fmtDate(opts.date),
    time: opts.time,
    partySize: opts.partySize,
    manageUrl: opts.manageUrl,
    reason: opts.reason,
  };
}
