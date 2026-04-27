import type { ComponentType } from 'react'
import { template as bookingConfirmation } from './booking-confirmation'
import { template as bookingCancellation } from './booking-cancellation'
import { template as bookingReminder } from './booking-reminder'
import { template as bookingFollowup } from './booking-followup'
import { template as ownerNotification } from './owner-notification'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'booking-cancellation': bookingCancellation,
  'booking-reminder': bookingReminder,
  'booking-followup': bookingFollowup,
  'owner-notification': ownerNotification,
}
