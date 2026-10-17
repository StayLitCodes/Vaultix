# Notification preferences and daily digest

## Preferences
Each user has one `notification_preference` row per channel (`email`, `webhook`) holding `enabled`, the subscribed `eventTypes`, `soundEnabled` and `digestEnabled`.

- `GET /notifications/preferences` returns the preferences (defaults are seeded on first call).
- `PUT` or `PATCH /notifications/preferences` accepts an array of `{ channel, enabled, eventTypes, soundEnabled?, digestEnabled? }`.

`NotificationService` checks these before creating and dispatching a notification: disabled channels and unsubscribed event types are never sent.

## Daily email digest
When `digestEnabled: true` on the user's email preference, per-event emails are not sent. Instead `DigestService` runs once a day, collects the user's unread, not-yet-digested notifications (subscribed event types only, max 100 per run), sends one summary email, and stamps `digestedAt` so nothing is sent twice. If the send fails, nothing is stamped and the next run retries.

Config: `NOTIFICATION_DIGEST_CRON` (cron expression, default `0 8 * * *`, server time).

Migration: `1790800000000-AddDigestToNotifications` adds `notification_preference.digestEnabled` and `notification.digestedAt`.
