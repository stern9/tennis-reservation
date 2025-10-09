# Next Steps & Future Improvements

This file tracks potential enhancements and security improvements for the tennis reservation system.

## High Priority

### 1. Secure Environment Variables with 1Password CLI

**Current Issue:**
- `.env` file exists on server but contains **plain text secrets on disk**
- If server is compromised, all secrets are exposed
- Need vault-based solution for production-grade security

**Recommended Solution: 1Password CLI**

**Why 1Password CLI:**
- ✅ Secrets never stored on server in plain text
- ✅ Encrypted vault, accessed only at runtime
- ✅ Audit logs of secret access
- ✅ Easy secret rotation without touching server
- ✅ Can revoke access instantly if server compromised
- ✅ Enterprise-grade security

**Implementation Steps:**

#### Step 1: Set up 1Password vault
```bash
# Create a vault item in 1Password (via app or CLI)
# Item name: "Tennis Reservation Secrets"
# Fields:
#   - username (TENNIS_USERNAME)
#   - password (TENNIS_PASSWORD)
#   - resend_api_key (RESEND_API_KEY)
#   - to_email (TO_EMAIL_ADDRESS)
#   - from_email (FROM_EMAIL_ADDRESS)
```

#### Step 2: Install 1Password CLI on server
```bash
# On server (Ubuntu/Debian)
curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
  sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | \
  sudo tee /etc/apt/sources.list.d/1password.list

sudo apt update && sudo apt install 1password-cli

# Verify installation
op --version
```

#### Step 3: Authenticate 1Password CLI
```bash
# Sign in (one-time setup)
op account add --address my.1password.com --email your-email@example.com

# Create service account token (recommended for cron)
# Via 1Password web: Settings > Developer > Service Accounts
# Set token as environment variable
export OP_SERVICE_ACCOUNT_TOKEN="ops_your_token_here"
```

#### Step 4: Update cron job to fetch secrets at runtime
```bash
# Edit crontab
crontab -e

# Replace existing reservation cron with:
58 5 * * * cd /home/stern9/tennis-reservation && \
  export OP_SERVICE_ACCOUNT_TOKEN="ops_your_token_here" && \
  export TENNIS_USERNAME=$(op read "op://Private/Tennis Reservation Secrets/username") && \
  export TENNIS_PASSWORD=$(op read "op://Private/Tennis Reservation Secrets/password") && \
  export RESEND_API_KEY=$(op read "op://Private/Tennis Reservation Secrets/resend_api_key") && \
  export TO_EMAIL_ADDRESS=$(op read "op://Private/Tennis Reservation Secrets/to_email") && \
  export FROM_EMAIL_ADDRESS=$(op read "op://Private/Tennis Reservation Secrets/from_email") && \
  /home/stern9/.nvm/versions/node/v22.20.0/bin/node dist/scripts/reserve.js >> logs/cron.log 2>&1
```

#### Step 5: Clean up old secrets
```bash
# On server: Check for secrets in shell configs
grep -i "TENNIS_USERNAME\|GMAIL\|RESEND" ~/.bashrc ~/.profile ~/.bash_profile 2>/dev/null

# If found, remove them:
nano ~/.bashrc   # Delete the export lines
nano ~/.profile  # Delete the export lines

# Remove .env file (secrets now in 1Password)
rm /home/stern9/tennis-reservation/.env

# Reload shell
source ~/.bashrc
```

#### Step 6: Test the setup
```bash
# Test fetching a secret
op read "op://Private/Tennis Reservation Secrets/username"

# Test running the script with 1Password secrets
cd /home/stern9/tennis-reservation
export OP_SERVICE_ACCOUNT_TOKEN="ops_your_token_here"
export TENNIS_USERNAME=$(op read "op://Private/Tennis Reservation Secrets/username")
# ... export other vars ...
npm run reserve:test -- --target-date 2025-10-20 --skip-court2
```

**Tasks:**
- [ ] Create 1Password vault item with all secrets
- [ ] Install `op` CLI on server
- [ ] Set up service account token
- [ ] Update cron job to use `op read` commands
- [ ] Test secret retrieval
- [ ] Verify server `~/.bashrc` and `~/.profile` don't contain secrets
- [ ] Remove `.env` file from server
- [ ] Test full reservation flow with new secret management

**Alternative Options (if 1Password not available):**

#### Option B: Doppler
- Free tier available
- Similar workflow to 1Password
- https://doppler.com

#### Option C: Infisical
- Open source, can self-host
- https://infisical.com

---

## Medium Priority

### 2. Weekly Reservation Summary Email

**Feature:** Automated weekly email showing all upcoming reservations scraped from the website

**Implementation:**
- New script: `scripts/weekly-summary.ts`
- Logs into website
- Scrapes "My Reservations" or "Mis Reservaciones" page
- Sends formatted email every Monday morning

**Email Format:**
```
🎾 Tennis Reservations - Week of Oct 14-20

CONFIRMED RESERVATIONS:
✅ Tue Oct 15 - Court 1 - 6:00 AM - 7:00 AM
✅ Fri Oct 18 - Court 2 - 7:00 AM - 8:00 AM
✅ Sat Oct 19 - Court 1 - 9:00 AM - 10:00 AM

UPCOMING:
📅 Next reservation attempt: Tonight at 11:58 PM CR
```

**Cron Schedule:**
```bash
# Every Monday at 8 AM CR (2 PM UTC)
0 14 * * 1 cd /home/stern9/tennis-reservation && \
  /home/stern9/.nvm/versions/node/v22.20.0/bin/node dist/scripts/weekly-summary.js >> logs/cron.log 2>&1
```

**Tasks:**
- [ ] Research "My Reservations" page on website
  - [ ] Find URL/navigation path
  - [ ] Identify HTML selectors for reservation list
  - [ ] Document data structure
- [ ] Create `scripts/weekly-summary.ts`
  - [ ] Reuse login logic from `reserve.ts`
  - [ ] Navigate to reservations page
  - [ ] Parse reservation data (date, time, court)
  - [ ] Filter to next 7 days
  - [ ] Format email body
  - [ ] Send email via Resend API
- [ ] Add npm script to `package.json`
  ```json
  "weekly-summary": "node dist/scripts/weekly-summary.js"
  ```
- [ ] Test locally with various scenarios
  - [ ] No reservations
  - [ ] Multiple reservations across different courts
  - [ ] Edge cases (past reservations, cancelled, etc.)
- [ ] Build and deploy to server
- [ ] Add to cron
- [ ] Monitor first few runs

---

### 3. Convert diagnose-dates.js to TypeScript

**Current State:**
- `scripts/diagnose-dates.js` is standalone JavaScript file
- Not part of TypeScript build pipeline
- Uses inline timezone utilities (duplicates logic)

**Goal:**
- Convert to `scripts/diagnose-dates.ts` for consistency
- Import shared utilities from `src/time-cr.ts`
- Include in TypeScript compilation

**Implementation:**
```typescript
// scripts/diagnose-dates.ts
import { crMidnight, addDaysCR, formatDateForUrl, getDayOfWeek, nowInCR, ymdCR } from '../src/time-cr';

console.log('=== Costa Rica Timezone Diagnostics ===\n');

const systemNow = new Date();
const crNow = nowInCR();
const today = crMidnight();

console.log('System Time:', systemNow.toISOString());
console.log('CR Time:', crNow.toISOString());
console.log('CR Midnight Today:', today.toISOString());

// ... rest of diagnostics
```

**Add to package.json:**
```json
"diagnose": "npm run build && node dist/scripts/diagnose-dates.js"
```

**Tasks:**
- [ ] Create `scripts/diagnose-dates.ts`
- [ ] Import timezone utilities from `src/time-cr.ts`
- [ ] Remove duplicate timezone logic
- [ ] Update `package.json` scripts
- [ ] Test locally: `npm run diagnose`
- [ ] Delete old `scripts/diagnose-dates.js`
- [ ] Update `.gitignore` if needed (should already ignore compiled .js)
- [ ] Rebuild and test on server

---

## Low Priority

### 4. Improve Midnight Wait Flow

**Current Implementation:**
- Script uses `waitUntilMidnight()` which polls every second
- Checks if `hours === 0 && minutes === 0 && seconds === 0`
- Works but could be more elegant

**Potential Issues:**
- Polling is inefficient (checks every second)
- Could miss midnight if check happens at 00:00:01
- No graceful handling if script starts after midnight

**Potential Improvements:**

#### Option A: Calculate exact delay
```typescript
function waitUntilMidnight(): Promise<void> {
  const crNow = nowInCR();
  const nextMidnight = crMidnight();
  nextMidnight.setDate(nextMidnight.getDate() + 1); // Tomorrow midnight

  const msUntilMidnight = nextMidnight.getTime() - crNow.getTime();

  if (msUntilMidnight < 0) {
    log('Already past midnight, proceeding immediately');
    return Promise.resolve();
  }

  log(`Waiting ${Math.round(msUntilMidnight / 1000)}s until midnight...`);
  return new Promise(resolve => setTimeout(resolve, msUntilMidnight));
}
```

**Pros:**
- No polling
- Single setTimeout
- More efficient

**Cons:**
- No periodic status updates
- If clock skew occurs, could be off

#### Option B: Hybrid approach (calculate + periodic logging)
```typescript
function waitUntilMidnight(): Promise<void> {
  const crNow = nowInCR();
  const nextMidnight = crMidnight();
  nextMidnight.setDate(nextMidnight.getDate() + 1);

  const msUntilMidnight = nextMidnight.getTime() - crNow.getTime();

  return new Promise(resolve => {
    // Log every 30 seconds
    const logInterval = setInterval(() => {
      const remaining = nextMidnight.getTime() - nowInCR().getTime();
      log(`⏰ ${Math.round(remaining / 1000)}s until midnight...`);
    }, 30000);

    setTimeout(() => {
      clearInterval(logInterval);
      log('🕛 Midnight reached!');
      resolve();
    }, msUntilMidnight);
  });
}
```

**Pros:**
- Efficient (single setTimeout)
- Periodic status updates
- Better logging

**Cons:**
- Slightly more complex

**Decision:** Keep current implementation (works reliably) or upgrade to Option B for cleaner code?

**Tasks:**
- [ ] Review current midnight wait implementation
- [ ] Decide on improvement approach (if any)
- [ ] Test edge cases (script starts at 11:59:59, 00:00:01, etc.)
- [ ] Update if needed

---

### 5. Unit Tests for Timezone Utilities

**Goal:** Ensure timezone calculations remain correct across different environments

**Test Cases:**
- `crMidnight()` returns midnight in CR timezone
- `addDaysCR()` handles month boundaries correctly
- `getDayOfWeek()` returns correct day name
- Date calculations work correctly when running from different timezones

**Framework:** Jest or Vitest

---

### 6. Monitoring & Alerting

**Goal:** Get notified if cron job fails to run (separate from reservation failure emails)

**Use Case:**
- Current email notifications only sent if script runs successfully
- If cron fails entirely (permissions, Node.js crash, etc.), no notification
- Need external monitoring to detect "silent failures"

**Options:**

#### Option A: Healthchecks.io (Recommended)
- **Free tier:** 20 checks
- Open source
- Simple heartbeat URL
- https://healthchecks.io

**Implementation:**
```typescript
// At end of main() in reserve.ts
async function pingHealthcheck() {
  try {
    await fetch('https://hc-ping.com/your-unique-id');
    log('Healthcheck ping sent', 'DEBUG');
  } catch (error) {
    log(`Failed to ping healthcheck: ${error}`, 'WARN');
  }
}

// Call after email is sent
await pingHealthcheck();
```

#### Option B: Cronitor
- Free tier available
- Built for cron monitoring
- https://cronitor.io

#### Option C: UptimeRobot
- Free tier for HTTP monitoring
- Simple uptime checks
- https://uptimerobot.com

**Tasks:**
- [ ] Sign up for monitoring service (Healthchecks.io recommended)
- [ ] Create new check/monitor
- [ ] Get heartbeat URL
- [ ] Add `pingHealthcheck()` function to `reserve.ts`
- [ ] Call at end of successful run
- [ ] Test: Run script and verify ping received
- [ ] Test: Skip a night and verify alert email received
- [ ] Document in CLAUDE.md

---

### 7. Reservation History Dashboard

**Status:** Not needed - weekly email summary is sufficient

---

## Completed ✅

- [x] TypeScript migration
- [x] Timezone bug fix (use Costa Rica time, not system time)
- [x] Error detection improvements (APP marker parsing)
- [x] Automated log cleanup (cron job)
- [x] Documentation updates (CLAUDE.md)
- [x] Server deployment
- [x] Cron configuration

---

## Notes

- Always test changes locally with `--test --debug --target-date` before deploying
- Remember to rebuild after TypeScript changes: `npm run build`
- Check logs after deployment: `tail -f /home/stern9/tennis-reservation/logs/reservation-*.log`
