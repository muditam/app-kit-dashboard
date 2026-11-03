# Muditam Kit Studio

Interactive React dashboard for managing metabolic kits.

## Run locally

1. Start the backend in `../muditam-app-backend` with `MONGO_URI` configured.
2. Run `npm install` in this folder.
3. Run `npm run dev` and open `http://localhost:5173`.

The dashboard API base URL is configured in `.env` with `VITE_API_BASE_URL`.

The Video Library tab uses `VITE_ADMIN_API_BASE_URL`. It appends
`/video-library` for the backend module endpoints and uploads video bytes
directly to the presigned Wasabi URL returned by the backend.


## Notifications

The sidebar's Notifications page uses `/api/push` on the same backend as
`VITE_API_BASE_URL`, authenticated with the existing Shiptrack dashboard token.
Existing mobile staff authentication remains supported; patient sessions cannot
administer campaigns.

Features: selected Indian phone numbers or all app users, title/message/link,
preview and registered-device counts, test sends, immediate or one-time scheduled
campaigns, scheduled editing/cancellation, paginated history and 30-second refresh.
The composer defaults to selected users. Actual campaigns require a final review
of message, audience count and time. Test sends target only the test numbers.

## Deployment

Deploy both app-kit-dashboard and the changed Muditam backend. Preserve the
existing Shiptrack shared token secret and Expo push credentials. The existing
`pushCampaignCron` must run (`server.js` starts it when `ENABLE_CRON_JOBS=true`); it claims
due jobs once per minute. All stored schedule timestamps are UTC. The form uses
the browser's timezone, clearly labelled; review/history display Asia/Kolkata.

Ensure MongoDB creates the new unique sparse `requestId` index on `pushcampaigns`
before enabling sends (Mongoose declares it in `models/PushCampaign.js`). Where
auto-indexing is disabled, apply the equivalent index in your normal migration
workflow. Request IDs prevent a lost response/retry from creating another
campaign. Cancellation and editing use conditional atomic updates so a claimed
campaign cannot be changed mid-send. Device tokens are deduplicated before send.

## Status and limits

`sent` means the provider accepted at least one notification; history labels the
count **Accepted**, not delivered. Partial errors remain visible beside accepted
counts. No accepted devices means failed. Interrupted campaigns are failed with
an explicit review message; do not automatically retry since part of the audience
may have received the message. The provider itself does not guarantee exactly-once
device delivery. See [Expo push tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

The existing service checks receipts immediately; later delivery failures are
not a durable per-device delivery report. Registered devices also do not prove
current OS notification permission. Users need valid app push registrations and
production APNs/FCM credentials must already be configured. Existing historic
campaigns used attempted counts; their stored figures are not retroactively changed.

Validation: 100-character titles, 500-character messages, HTTPS or muditam links,
up to 1,000 explicit numbers. All-user sends are not capped at 1,000 devices.

## Verification

Dashboard: `npm run build` and `node --test test/*.test.*`.
Backend: `node --test test/pushAuthorization.test.js test/pushTokenOwnership.test.js test/pushDashboard.test.js`.
Tests mock the push provider and do not send real notifications. Verify one
explicitly chosen test device after deployment before a real audience campaign.

### Notification Studio enhancements

- Built-in welcome, class, routine and care templates; campaign duplication opens
  a fresh composer and never sends automatically.
- `{{firstName}}` is expanded from the saved profile at send time; missing names
  fall back to “there”. iOS/Android previews are illustrations, not OS screenshots.
- Audience segments use stored purchase status, preferred language, or signup
  date (rolling seven days). Preview, scheduled sends and immediate sends share
  the same query builder. Segment membership is recalculated at send time.
- Single-column CSV/text import accepts Indian phone numbers, removes duplicates,
  and validates up to 1,000 recipients. No file is uploaded to a third party.
- Private server-saved drafts are scoped by authentication source and author ID.
  Draft updates require the saved revision; another tab cannot silently overwrite
  newer work. Saving or opening a draft never sends a notification. Sending keeps
  the draft until the author explicitly deletes it.
- Campaign search/status filters are server-side and paginated. CSV export covers
  the displayed page, escapes spreadsheet formula cells, and excludes phone lists.
- Seven-day analytics show recorded provider acceptance/errors, never invented
  opens, clicks or confirmed delivery. The review dialog shows the message,
  audience reach, destination and time before the final send action.

Deploy the new `PushDraft` model and backend endpoints together with the frontend.
Run the notification tests above and `node --test test/notificationComposer.test.mjs`.


### Users directory

The Users icon directly above Notifications opens a searchable, paginated member directory. Open a profile for account details, assessments, diet preferences and plans, meal logs, health reports/readings, purchase confirmations, saved cart, care program/points, daily routine, fitness, reminders, class progress, attendance, games, bookings, calls, and retained AI conversations. Record sections load on demand, 20 at a time. Purchase confirmations reflect saved backend records, not a fresh Shopify order sync.

The read-only `/api/admin/users` endpoints use Shiptrack dashboard authentication and require ADMIN access. Explicit field projections omit authentication/device tokens, private storage keys, and call access URLs. Deleted reports and deleted/expired AI conversations are excluded. Device registration is shown as a boolean; it does not guarantee notification permission. Deploy/restart the app backend alongside the dashboard to register the new route.

Backend verification: `node --test test/dashboardUsers.test.js`.
