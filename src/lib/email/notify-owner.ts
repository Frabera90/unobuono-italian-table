import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/restaurant";

type EventType = "new_booking" | "new_preorder" | "cancellation";

type Args = {
  restaurantId: string;
  reservationId: string;
  eventType: EventType;
  customerName?: string | null;
  date?: string;
  time?: string;
  partySize?: number;
  details?: string;
};

/**
 * Invia all'owner del ristorante (notification_email in restaurant_settings)
 * una notifica per nuove prenotazioni / pre-ordini / disdette.
 * Fail-safe: non blocca mai il flusso utente.
 */
export async function notifyOwner(args: Args): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from("restaurant_settings")
      .select("notification_email, name")
      .eq("restaurant_id", args.restaurantId)
      .maybeSingle();

    const email = (settings as any)?.notification_email;
    if (!email || !/.+@.+\..+/.test(email)) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await fetch(`${origin}/api/public/email/booking-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "owner-notification",
        recipientEmail: email,
        reservationId: args.reservationId,
        idempotencyKey: `owner-${args.eventType}-${args.reservationId}`,
        templateData: {
          restaurantName: settings?.name,
          eventType: args.eventType,
          customerName: args.customerName,
          date: args.date ? fmtDate(args.date) : undefined,
          time: args.time,
          partySize: args.partySize,
          details: args.details,
          dashboardUrl: origin ? `${origin}/owner` : undefined,
        },
      }),
    });
  } catch (e) {
    console.warn("notifyOwner failed", e);
  }
}
