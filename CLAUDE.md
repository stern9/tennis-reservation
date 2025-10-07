# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated tennis court reservation system for Parques del Sol using Puppeteer. The system uses a **two-phase execution strategy**: login at 11:58 PM Costa Rica time, then race to reserve courts exactly at midnight when new dates become available.

## Key Commands

```bash
# Production (waits for midnight)
node scripts/reserve.js

# Test mode (requires --target-date)
npm run reserve:test -- --target-date 2025-10-15

# Debug with screenshots
npm run reserve:debug -- --target-date 2025-10-15

# Watch mode (visible browser)
npm run reserve:watch -- --target-date 2025-10-15

# Dry run (preview only)
npm run reserve:dry-run

# Interactive test script
./test-local.sh

# Manual reservation
./manual-reserve.sh
```

## Architecture & Flow

### Two-Phase Execution Strategy

**Phase 1: Login (11:58 PM Costa Rica time)**
- Start script 2 minutes before midnight
- Navigate to `parquesdelsol.sasweb.net`
- Authenticate and wait on dashboard
- Keep session alive

**Phase 2: Reserve (exactly 12:00 AM)**
- Wait until Costa Rica time hits `00:00:00`
- Navigate to Reservaciones → select area → click date → fill form → submit
- Race to complete before others (slots taken in seconds)

### Multi-Iframe Navigation Flow

The website uses **nested iframes** (iframe within iframe):

1. **Main page** → Dashboard (after login)
2. **First iframe** → Area selection (`pre_reservations.php`) & Calendar (`reservations.php`)
3. **Nested iframe** → Day view & Reservation form (`new_reservation.php`)

**Critical:** Must switch iframe context appropriately using Puppeteer's `page.frames()` API.

### Configuration System

Located at top of `scripts/reserve.js` for easy editing:

```javascript
courts: {
  court1: {
    areaId: '5',                  // Form dropdown value
    name: 'Cancha de Tenis 1',    // Display name
    daysAhead: 9,                 // Becomes available 9 days ahead
    slots: {                      // Day of week → time slot mapping
      'Tuesday': '06:00 AM - 07:00 AM',
      'Friday': '06:00 AM - 07:00 AM',
      'Saturday': '09:00 AM - 10:00 AM'
    }
  },
  court2: { ... }
}
```

**Days ahead logic:**
- Court 1: 9 days ahead (e.g., if today is Oct 7, can book for Oct 16)
- Court 2: 8 days ahead (e.g., if today is Oct 7, can book for Oct 15)
- Script calculates target date using `addDays(today, court.daysAhead)`

### Command Line Arguments

All arguments are parsed in `ARGS` object:

- `--test` - Test mode (doesn't wait for midnight, requires `--target-date`)
- `--target-date YYYY-MM-DD` - Override target date for testing
- `--court1-time "HH:MM AM - HH:MM AM"` - Override Court 1 time slot
- `--court2-time "HH:MM AM - HH:MM AM"` - Override Court 2 time slot
- `--skip-court1` - Skip Court 1 reservation
- `--skip-court2` - Skip Court 2 reservation
- `--debug` - Enable screenshot capture
- `--watch` - Keep browser visible (for debugging)
- `--dry-run` - Preview what would be reserved without executing

### Environment Variables

**Required:**
- `TENNIS_USERNAME` - Login username
- `TENNIS_PASSWORD` - Login password
- `EMAIL_TO` - Notification email address
- `GMAIL_USER` - Gmail address for sending
- `GMAIL_PASSWORD` - Gmail App Password (16-char, NOT regular password)

**Optional:**
- `DEBUG_MODE=true` - Enable screenshots (equivalent to `--debug`)
- `WATCH_MODE=true` - Keep browser visible (equivalent to `--watch`)

## Costa Rica Timezone Handling

**Critical:** Website operates on Costa Rica time (UTC-6, no DST).

```javascript
function getCostaRicaTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const costaRicaTime = new Date(utc + (-6 * 3600000));
  return costaRicaTime;
}
```

**Midnight detection:**
- `waitUntilMidnight()` polls every second checking for `hours === 0 && minutes === 0 && seconds === 0`
- Only used in production mode (skipped in `--test` mode)

**Cron scheduling:**
```bash
# 11:58 PM Costa Rica time = 5:58 AM UTC (next day)
58 5 * * * cd /path/to/tennis-reservation && node scripts/reserve.js
```

## Error Handling & Messages

**Error types with clear prefixes:**
- `DATE_NOT_AVAILABLE` - Date not found in calendar (not in booking window)
- `DATE_NOT_CLICKABLE` - Date exists but not clickable (fully booked or not yet available)
- `SLOT_TAKEN` - "excede la cantidad máxima de personas"
- `RESERVATION_LIMIT` - "sobrepasado el limite" / "límite permitido"
- `SLOT_OCCUPIED` - "ocupado" / "no disponible"
- `TIME_SLOT_NOT_FOUND` - Requested time slot not in form dropdown
- `UNKNOWN_ERROR` - No success message found after submission

**Spanish success indicators:**
- "se ha realizado con éxito"
- "aprobada"
- "reservación" + "éxito"

**No retry logic:** Slots are taken in seconds, so failed attempts are immediately reported.

## Screenshot Debugging

**When enabled (`--debug` or `DEBUG_MODE=true`):**

Screenshots saved to `screenshots/{timestamp}/`:
1. `1-login-page.png` - Login form
2. `2-logged-in-dashboard.png` - After successful login
3. `3-reservations-modal.png` - Area selection modal
4. `4-calendar-view.png` - Calendar with dates
5. `5-day-view.png` - Day view with time slots
6. `6-form-filled.png` - Reservation form filled out
7. `7-submission-result.png` - Final result
8. `error-*.png` - Screenshots taken on errors

**Auto-cleanup:** Screenshots deleted after email sent via `cleanupScreenshots()`.

## Email Notifications

Uses `nodemailer` with Gmail SMTP:

**Subject format:**
- Success: `🎾 Reservations Confirmed ✅ (2/2)`
- Partial: `🎾 Partial Success ⚠️ (1/2)`
- Failure: `🎾 Reservation Failed ❌`
- Error: `🎾 Reservation Script Error ❌`

**Body includes:**
- Success/failure details for each court
- Error messages with prefixes
- Run timestamp
- Log file path

## Testing Strategy

**Test scenarios to validate:**

1. **Successful reservation** - Use available date/time
2. **Date not available** - Use future date beyond booking window
3. **Slot already taken** - Use date with occupied slot
4. **Both courts scenarios** - Mix success/failure

**Before testing:**
- Check website for available dates/times
- Use `--dry-run` first to preview
- Run with `--debug --watch` to see browser interaction
- Test one court at a time with `--skip-court1` or `--skip-court2`

**Example test commands:**
```bash
# Test Court 1 with known available slot
npm run reserve:debug -- --target-date 2025-10-15 \
  --court1-time "06:00 AM - 07:00 AM" \
  --skip-court2

# Test "slot taken" scenario
npm run reserve:debug -- --target-date 2025-10-10 \
  --court1-time "06:00 AM - 07:00 AM" \
  --skip-court2

# Test both courts
npm run reserve:debug -- --target-date 2025-10-15 \
  --court1-time "06:00 AM - 07:00 AM" \
  --court2-time "07:00 AM - 08:00 AM"
```

## Important Implementation Details

### Time Slot Database IDs

The form uses database IDs for time slots (not display text). Mapping in `TIME_SLOT_VALUES` (currently unused, kept for reference):

```javascript
'06:00 AM - 07:00 AM': '243'
'07:00 AM - 08:00 AM': '250'
// etc...
```

**Note:** Script selects by text matching (`option.text.includes(startTime)`), not by value.

### Session Management

- Login creates session cookie
- Dashboard URL includes session parameter: `?w={session_id}`
- Session stays alive between Phase 1 and Phase 2
- For multiple courts, requires fresh login per court (session issues)

### Shadowbox Modal

Website uses Shadowbox library:
- Links have `rel="shadowbox;height=X;width=Y"` attribute
- Content loads in iframe within modal
- Must wait for iframe to load before interacting

### Key Selectors

```javascript
// Login page
'input[type="text"]'          // Username (or first input)
'input[type="password"]'      // Password (or second input)
'button, input[type="submit"]' // Login button

// Dashboard
'a[href="pre_reservations.php"]' // Reservations link

// Pre-Reservation Modal (iframe)
'#area'                       // Area dropdown
'input#btn_cont'              // Continue button

// Calendar (iframe)
`td.calendar-day_clickable[onclick*="${formattedDate}"]` // Clickable date

// Day View (nested iframe)
'a[href*="new_reservation.php"]' // "Solicitar Reserva" link

// Reservation Form (nested iframe)
'#schedule'                   // Time slot dropdown
'#save_btn'                   // Submit button
```

## Deployment to DigitalOcean

**Cron setup:**
```bash
# Edit crontab
crontab -e

# Add line (5:58 AM UTC = 11:58 PM Costa Rica)
58 5 * * * cd /path/to/tennis-reservation && /usr/bin/node scripts/reserve.js >> /path/to/tennis-reservation/logs/cron.log 2>&1
```

**Environment variables:**
```bash
# Add to ~/.bashrc or ~/.profile
export TENNIS_USERNAME='...'
export TENNIS_PASSWORD='...'
export EMAIL_TO='...'
export GMAIL_USER='...'
export GMAIL_PASSWORD='...'
```

**Manual trigger:**
```bash
ssh user@droplet
cd /path/to/tennis-reservation
./manual-reserve.sh
```

## File Structure

```
tennis-reservation/
├── scripts/
│   └── reserve.js          # Main script (720 lines)
├── logs/                   # Auto-generated logs
│   └── reservation-{date}.log
├── screenshots/            # Debug screenshots (auto-cleaned)
│   └── {timestamp}/
├── test-local.sh           # Interactive test script
├── manual-reserve.sh       # Manual reservation trigger
├── package.json            # Dependencies & npm scripts
├── .gitignore              # Excludes logs, screenshots, node_modules
├── README.md               # User documentation
├── CLAUDE.md               # This file
└── reservation_flow_documentation.md  # Detailed navigation flow with screenshots
```

## Common Modifications

### Add new court
1. Get area ID from `reservation_flow_documentation.md`
2. Add to `CONFIG.courts` with `areaId`, `name`, `daysAhead`, `slots`
3. Update main execution logic if needed

### Change reservation schedule
Edit `CONFIG.courts.court1.slots` or `CONFIG.courts.court2.slots`:
```javascript
slots: {
  'Monday': '07:00 AM - 08:00 AM',    // Add new day
  'Tuesday': '06:00 AM - 07:00 AM',   // Modify existing
  // Remove day by deleting line
}
```

### Add new time slot
Ensure time format matches exactly: `HH:MM AM - HH:MM AM`

### Debug login issues
Run with `--watch` to see browser:
```bash
npm run reserve:watch -- --target-date 2025-10-15
```

## Logs

Located at `logs/reservation-{date}.log`:
```
[2025-10-07T23:58:00.123Z] [INFO] === Tennis Court Reservation Script Started ===
[2025-10-07T23:58:00.456Z] [INFO] Mode: PRODUCTION
[2025-10-07T23:58:01.789Z] [INFO] 🔐 Phase 1: Logging in...
[2025-10-08T00:00:00.012Z] [INFO] 🕛 Midnight reached! Starting reservation phase...
[2025-10-08T00:00:05.345Z] [SUCCESS] ✅ SUCCESS: Reserved Cancha de Tenis 1 on ...
```

Log levels: `INFO`, `WARN`, `ERROR`, `SUCCESS`, `DEBUG`
