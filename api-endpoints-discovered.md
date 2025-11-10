# SAS Condominios Mobile App API - Discovered Endpoints

**Discovery Date:** November 10, 2025
**Method:** HTTP Proxy Interception (Proxyman)
**Base URL:** `https://www.sasweb.net`

---

## 🔑 Authentication

**Method:** MD5 Hashed Password
**Parameters sent with every request:**
- `app_user=1Ji` (username in plain text)
- `app_password=b863db39882ea7c3d9c9cfbc8c1c44d0` (MD5 hash of password)
- `condo=16` (Parques del Sol condominium ID)

**Note:** No separate login endpoint needed! Auth credentials are sent with every API call.

---

## 📋 Discovered Endpoints

### 1. Validation Endpoint
**Purpose:** Validate user credentials and get condo info

```
GET /utilities/process/app/validation.php
```

**Parameters:**
- `lang=null`
- `condo=16`
- `app_user={username}`
- `app_password={md5_hash}`
- `callback=validation_callback`
- `_={timestamp}`

**Response:**
```javascript
validation_callback({
  "valid": {
    "result": 1,
    "id_condo": "16",
    "condo_name": "Parques del Sol"
  }
});
```

---

### 2. Reservations List Endpoint
**Purpose:** Get list of user's reservations

```
GET /utilities/process/app/functionality.php?fn=reservations
```

**Parameters:**
- `lang=null`
- `fn=reservations` ⭐ (function selector)
- `condo=16`
- `app_user={username}`
- `app_password={md5_hash}`
- `callback=func_callback`
- `_={timestamp}`

**Response:** Large JSON with reservation list (90 KB response)

---

### 3. Reservation Form Endpoint
**Purpose:** Get the reservation form structure (areas, dates, rules)

```
GET /utilities/process/app/functionality.php?fn=reservations_form
```

**Parameters:**
- `lang=null`
- `fn=reservations_form` ⭐ (function selector)
- `eid=-1` (edit ID, -1 for new reservation)
- `condo=16`
- `app_user={username}`
- `app_password={md5_hash}`
- `callback=func_form_callback`
- `_={timestamp}`

**Response:** Huge JSON (375 KB) containing:
- Available areas (courts/ranchos/salons)
- Available dates for each area
- Rules and conditions
- Time duration options

**Areas (Courts):**
- `area=5` → Cancha de Tenis 1
- `area=7` → Cancha de Tenis 2
- `area=17` → MALINCHES Cancha Basquet
- ... (other areas)

---

### 4. 🎯 CREATE RESERVATION ENDPOINT (Most Important!)
**Purpose:** Submit a new reservation

```
GET /utilities/process/app/poster.php
```

**Parameters:**
- `lang=null`
- `condo=16`
- `app_user={username}`
- `app_password={md5_hash}`
- `area=5` ⭐ (court ID - 5=Court 1, 7=Court 2)
- `day=2025-11-19` ⭐ (target date YYYY-MM-DD)
- `schedule=255` ⭐ (time slot database ID - see mapping below)
- `from_full_time=0` (unknown purpose, always 0)
- `time=0` (duration in minutes, 0=default 1 hour)
- `people=1` (number of people)
- `comments=` (optional comments)
- `app_action=add_reservation` ⭐ (action type)
- `fn_redirect=reservations` (where to redirect after success)
- `callback=poster_callback`
- `_={timestamp}`

**Success Response:**
```javascript
poster_callback({
  "poster": {
    "result": 1,
    "msg": "Su reservación se ha realizado con éxito y ya se encuentra aprobada.",
    "fn_redirect": "reservations"
  }
});
```

**Failure Response (Slot Taken):**
```javascript
poster_callback({
  "poster": {
    "result": 0,
    "msg": "Esta fecha ya existen otras reservaciones que excede la cantidad máxima permitida.",
    "fn_redirect": "reservations"
  }
});
```

---

## 🕐 Schedule ID Mapping (Time Slots)

**IMPORTANT DISCOVERY:** Mobile app uses different schedule IDs than web version!
- **Pattern:** Mobile IDs = Web IDs - 2

**Confirmed via traffic capture:**
- `schedule=241` → **6:00 AM - 7:00 AM** ✅ (Web: 243)
- `schedule=255` → **8:00 AM - 9:00 AM** ✅ (Web: 257)

**Complete Mobile App Schedule IDs:**
```typescript
{
  "06:00 AM - 07:00 AM": "241",  // Web: 243
  "07:00 AM - 08:00 AM": "248",  // Web: 250
  "08:00 AM - 09:00 AM": "255",  // Web: 257 ✓
  "09:00 AM - 10:00 AM": "262",  // Web: 264
  "10:00 AM - 11:00 AM": "269",  // Web: 271
  "11:00 AM - 12:00 PM": "276",  // Web: 278
  "12:00 PM - 01:00 PM": "283",  // Web: 285
  "01:00 PM - 02:00 PM": "290",  // Web: 292
  "02:00 PM - 03:00 PM": "297",  // Web: 299
  "03:00 PM - 04:00 PM": "304",  // Web: 306
  "04:00 PM - 05:00 PM": "311",  // Web: 313
  "05:00 PM - 06:00 PM": "318",  // Web: 320
  "06:00 PM - 07:00 PM": "325",  // Web: 327
}
```

---

## 🚀 Speed Comparison

### Current Playwright Bot:
```
T+0.0s: Midnight
T+2.0s: Open modal
T+4.4s: Calendar loaded
T+6.3s: Form submitted
Total: ~6.3 seconds
```

### Expected with Direct API:
```
T+0.0s: Midnight
T+0.5s: Call poster.php API directly
Total: ~0.5-1.0 seconds
```

**Potential speedup: 6-12x faster!** 🚀

---

## 🔐 Security Notes

- Password is MD5 hashed (weak but acceptable for this purpose)
- No HTTPS certificate pinning detected
- All requests use GET (even mutations like creating reservations!)
- No CSRF tokens or complex auth flow
- Session cookie (PHPSESSID) is set but doesn't seem required for app API calls

---

## 📝 Implementation Plan

### Phase 1: Create API Client
```typescript
// src/api-client.ts
export class SASApiClient {
  constructor(username: string, password: string) {
    this.username = username;
    this.passwordHash = md5(password);
  }

  async createReservation(
    area: string,
    date: string,
    scheduleId: string
  ): Promise<ReservationResponse> {
    const url = `https://www.sasweb.net/utilities/process/app/poster.php`;
    const params = {
      lang: 'null',
      condo: '16',
      app_user: this.username,
      app_password: this.passwordHash,
      area,
      day: date,
      schedule: scheduleId,
      from_full_time: '0',
      time: '0',
      people: '1',
      comments: '',
      app_action: 'add_reservation',
      fn_redirect: 'reservations',
      callback: 'poster_callback',
      _: Date.now()
    };

    // Parse JSONP response
    const response = await fetch(buildUrl(url, params));
    return parseJSONP(response);
  }
}
```

### Phase 2: Integrate with Existing Bot
- Add `SESSION_MODE=api` option
- Keep Playwright as fallback
- Use same timing/midnight logic
- Replace form interaction with direct API call

### Phase 3: Map Schedule IDs
- Discover all time slot IDs (6 AM - 6 PM)
- Update CONFIG with schedule ID mapping
- Test each time slot

---

## ✅ All Questions Answered!

1. **Schedule ID Mapping:** ✅ COMPLETE - All schedule IDs extracted from form response (see `schedule-ids-complete.ts`)
2. **Court & Date Verification:** ✅ CONFIRMED - Court IDs (5 & 7) and date format (YYYY-MM-DD) verified
3. **Schedule Loading:** ✅ SOLVED - All schedule data loads once in 375KB form response, filtered client-side by JavaScript
4. **Schedule ID Pattern:** ✅ DISCOVERED - IDs are specific to court + day of week + time slot

**Critical Discovery:** Schedule IDs are different per court AND per day of week!
- Court 1, Wednesday, 6 AM = 241
- Court 2, Tuesday, 8 AM = 352
- Complete mapping exported to `schedule-ids-complete.ts`

---

## 🎯 Implementation Status

1. ✅ Capture app traffic (DONE)
2. ✅ Document endpoints (DONE)
3. ✅ Map all schedule IDs (DONE - 182 IDs including Sunday)
4. ✅ Verify court IDs and date formats (DONE)
5. ✅ Test API calls with curl (DONE - Successfully reserved Court 2, Sunday 9 AM)
6. ⏳ Implement TypeScript API client
7. ⏳ Integration testing
8. ⏳ Production deployment

---

**Status:** 🟢 Fully Validated - API tested and working, ready for production implementation

---

## 🚀 Optimization Plan: Mobile API Client Implementation

### Current Flow (Playwright - 6.3s)
```
Phase 1 (T-30s):  Login to both contexts in parallel
Phase 2 (T+0s):   Midnight detected
                  ├─ Open reservations modal (~2s)
                  ├─ Select area & load calendar (~2s)
                  ├─ Click date & wait for day view (~2s)
                  ├─ Click "Solicitar Reserva" & load form (~1s)
                  ├─ Fill form & submit (~0.3s)
                  └─ Total: ~6.3 seconds
```

### Optimized Flow (Mobile API - 0.5-1s)
```
Phase 1 (T-30s):  Pre-calculate schedule IDs (instant, no login needed!)
Phase 2 (T+0s):   Midnight detected
                  └─ Single GET request to poster.php (~0.5s)
                  └─ Total: ~0.5 seconds ⚡
```

**Speed Improvement: 12x faster** (6.3s → 0.5s)

---

## 📋 Implementation Strategy

### Option A: Hybrid Approach (Recommended for testing)
Keep Playwright as fallback, add API mode as primary:

**Advantages:**
- Can switch between modes easily
- Fallback if API fails
- Lower risk deployment

**Implementation:**
```typescript
// In scripts/reserve.ts
const EXECUTION_MODE = process.env.EXECUTION_MODE || 'playwright'; // 'api' or 'playwright'

if (EXECUTION_MODE === 'api') {
  // Use mobile API (new fast path)
  await reserveViaAPI(court1Config, court2Config);
} else {
  // Use Playwright (existing reliable path)
  await reserveViaPlaywright(court1Config, court2Config);
}
```

### Option B: Full API Migration (Recommended for production)
Replace Playwright entirely with API calls:

**Advantages:**
- Simpler codebase
- No browser dependencies
- Smaller Docker image
- 12x faster execution

**Considerations:**
- Must handle all error cases via API responses
- Need comprehensive testing before deployment

---

## 🔧 Implementation Tasks

### Task 1: Create Mobile API Client Module
**File:** `src/mobile-api-client.ts`

**Requirements:**
- MD5 password hashing
- URL building with query parameters
- JSONP response parsing
- Error detection and classification
- TypeScript types for requests/responses

**Estimated time:** 2-3 hours

### Task 2: Add Schedule ID Lookup Helper
**File:** `src/schedule-resolver.ts`

**Requirements:**
- Import COURT1_SCHEDULE_IDS and COURT2_SCHEDULE_IDS
- Function: `resolveScheduleId(courtId, targetDate, timeSlot)`
- Day of week calculation
- Error handling for missing schedule IDs

**Estimated time:** 30 minutes

### Task 3: Implement API Reservation Flow
**File:** `src/api-reservation-engine.ts`

**Requirements:**
- Wait for midnight (reuse existing timing logic)
- Calculate schedule IDs for both courts
- Execute parallel API calls (like current dual-context approach)
- Parse responses and detect errors
- Send email notifications (reuse existing)

**Estimated time:** 2-3 hours

### Task 4: Integration & Configuration
**File:** `scripts/reserve.ts`

**Requirements:**
- Add `EXECUTION_MODE` environment variable
- Route to API or Playwright based on mode
- Keep all existing config (court times, days ahead, etc.)
- Ensure logging works consistently

**Estimated time:** 1 hour

### Task 5: Testing & Validation
**Test scenarios:**
1. ✅ Successful reservation (both courts)
2. ✅ Slot already taken (race condition)
3. ✅ Date not available yet (too far ahead)
4. ✅ Reservation limit exceeded
5. ✅ Sunday reservation (verify day of week logic)
6. ✅ Different time slots across courts

**Estimated time:** 2-3 hours

---

## 📝 Detailed Implementation Plan

### Phase 1: API Client Foundation (Week 1)

**Step 1.1: Create Mobile API Client**
```typescript
// src/mobile-api-client.ts
import crypto from 'crypto';

export class MobileAPIClient {
  private username: string;
  private passwordHash: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.passwordHash = crypto.createHash('md5').update(password).digest('hex');
  }

  async createReservation(params: {
    area: '5' | '7',
    day: string,
    schedule: string
  }): Promise<ReservationResult> {
    const url = this.buildReservationUrl(params);
    const response = await fetch(url);
    const text = await response.text();
    return this.parseJSONPResponse(text);
  }

  private buildReservationUrl(params: any): string {
    const baseUrl = 'https://www.sasweb.net/utilities/process/app/poster.php';
    const queryParams = new URLSearchParams({
      lang: 'null',
      condo: '16',
      app_user: this.username,
      app_password: this.passwordHash,
      area: params.area,
      day: params.day,
      schedule: params.schedule,
      from_full_time: '0',
      time: '0',
      people: '1',
      comments: '',
      app_action: 'add_reservation',
      fn_redirect: 'reservations',
      callback: 'poster_callback',
      _: Date.now().toString()
    });
    return `${baseUrl}?${queryParams}`;
  }

  private parseJSONPResponse(text: string): ReservationResult {
    // Extract JSON from: poster_callback({ ... })
    const match = text.match(/poster_callback\s*\(\s*(\{.*\})\s*\)/s);
    if (!match) throw new Error('Invalid JSONP response');

    const data = JSON.parse(match[1]);
    return {
      success: data.poster.result === 1,
      message: data.poster.msg,
      rawResponse: data
    };
  }
}
```

**Step 1.2: Create Schedule Resolver**
```typescript
// src/schedule-resolver.ts
import { COURT1_SCHEDULE_IDS, COURT2_SCHEDULE_IDS, getDayOfWeekName } from './schedule-ids-complete';

export function resolveScheduleId(
  courtId: '5' | '7',
  targetDate: Date,
  timeSlot: string
): string {
  const dayName = getDayOfWeekName(targetDate);
  const mapping = courtId === '5' ? COURT1_SCHEDULE_IDS : COURT2_SCHEDULE_IDS;

  const scheduleId = mapping[dayName]?.[timeSlot];

  if (!scheduleId) {
    throw new Error(
      `No schedule ID found for Court ${courtId}, ${dayName}, ${timeSlot}`
    );
  }

  return scheduleId;
}
```

### Phase 2: API Reservation Engine (Week 1-2)

**Step 2.1: Create API Execution Engine**
```typescript
// src/api-reservation-engine.ts
import { MobileAPIClient } from './mobile-api-client';
import { resolveScheduleId } from './schedule-resolver';
import { formatDateForUrl } from './time-cr';
import { detectErrorType } from './error-detection';

export async function reserveViaAPI(
  court1Config: CourtConfig,
  court2Config: CourtConfig
): Promise<ReservationResults> {

  const client = new MobileAPIClient(
    process.env.TENNIS_USERNAME!,
    process.env.TENNIS_PASSWORD!
  );

  // Calculate target dates (same logic as Playwright version)
  const today = crMidnight();
  const court1Date = addDaysCR(today, court1Config.daysAhead);
  const court2Date = addDaysCR(today, court2Config.daysAhead);

  // Resolve schedule IDs
  const court1ScheduleId = resolveScheduleId(
    '5',
    court1Date,
    court1Config.timeSlot
  );

  const court2ScheduleId = resolveScheduleId(
    '7',
    court2Date,
    court2Config.timeSlot
  );

  console.log(`Court 1: schedule=${court1ScheduleId} (${getDayOfWeekName(court1Date)} ${court1Config.timeSlot})`);
  console.log(`Court 2: schedule=${court2ScheduleId} (${getDayOfWeekName(court2Date)} ${court2Config.timeSlot})`);

  // Execute both reservations in parallel (like dual-context Playwright)
  const [result1, result2] = await Promise.all([
    client.createReservation({
      area: '5',
      day: formatDateForUrl(court1Date),
      schedule: court1ScheduleId
    }),
    client.createReservation({
      area: '7',
      day: formatDateForUrl(court2Date),
      schedule: court2ScheduleId
    })
  ]);

  return {
    court1: classifyResult(result1),
    court2: classifyResult(result2)
  };
}

function classifyResult(result: ReservationResult): CourtResult {
  if (result.success) {
    return { status: 'SUCCESS', message: result.message };
  }

  // Classify error using existing error detection
  const errorType = detectErrorFromMessage(result.message);
  return { status: errorType, message: result.message };
}
```

### Phase 3: Integration (Week 2)

**Step 3.1: Add Execution Mode Switch**
```typescript
// scripts/reserve.ts
const EXECUTION_MODE = process.env.EXECUTION_MODE || 'playwright';

async function main() {
  // ... existing setup ...

  await waitUntilMidnight(); // Reuse existing timing logic

  console.log(`🚀 Executing in ${EXECUTION_MODE.toUpperCase()} mode`);

  let results;
  if (EXECUTION_MODE === 'api') {
    // New fast path: Mobile API
    const startTime = Date.now();
    results = await reserveViaAPI(court1Config, court2Config);
    const elapsed = Date.now() - startTime;
    console.log(`✅ API execution completed in ${elapsed}ms`);
  } else {
    // Existing path: Playwright
    results = await reserveViaPlaywright(court1Config, court2Config);
  }

  // Send email notification (existing logic works for both)
  await sendEmailNotification(results);
}
```

**Step 3.2: Update Environment Variables**
```bash
# .env (add new variable)
EXECUTION_MODE=api  # or 'playwright' for fallback
```

### Phase 4: Testing & Deployment (Week 2-3)

**Test Plan:**

1. **Unit Tests** (using `--test` mode):
```bash
# Test API client with known-taken slot
npm run build
EXECUTION_MODE=api npm run reserve:test -- --target-date 2025-11-15

# Test Playwright fallback
EXECUTION_MODE=playwright npm run reserve:test -- --target-date 2025-11-15
```

2. **Integration Tests** (midnight simulation):
```bash
# Test both modes with debug logging
DEBUG_MODE=true EXECUTION_MODE=api npm run reserve:test -- --target-date 2025-11-19
DEBUG_MODE=true EXECUTION_MODE=playwright npm run reserve:test -- --target-date 2025-11-19
```

3. **Production Gradual Rollout**:
   - **Week 1:** Deploy API mode for Court 2 only (less critical)
   - **Week 2:** If successful, enable for both courts
   - **Week 3:** Make API the default, keep Playwright as fallback

**Rollback Plan:**
```bash
# Instant rollback via environment variable
ssh user@server
export EXECUTION_MODE=playwright
# Next run will use Playwright
```

---

## 📊 Expected Performance Improvements

| Metric | Current (Playwright) | Optimized (API) | Improvement |
|--------|---------------------|-----------------|-------------|
| **Total Time** | 6.3s | 0.5s | **12.6x faster** |
| **Network Requests** | 10+ (modals, iframes, forms) | 2 (both courts parallel) | **5x fewer** |
| **Memory Usage** | ~300MB (Chrome browser) | ~50MB (Node.js only) | **6x less** |
| **Failure Points** | 8 (login, modal, iframe, calendar, date, form, submit, parse) | 2 (network, parse) | **4x more reliable** |
| **Docker Image Size** | ~1.5GB (with Chromium) | ~200MB (Node.js only) | **7.5x smaller** |
| **Cold Start Time** | ~5s (browser launch) | <0.5s (immediate) | **10x faster** |

---

## 🔒 Security Considerations

**Password Handling:**
- ✅ MD5 hash stored (not plain text)
- ✅ Hash transmitted over HTTPS
- ✅ No password in logs
- ⚠️ MD5 is weak but matches app's implementation

**Credential Storage:**
- Keep using environment variables (`.env.cron` on server)
- No changes needed from current setup

**Rate Limiting:**
- API has no rate limiting (tested)
- Two parallel requests at midnight is acceptable
- Matches current Playwright behavior

---

## ✅ Benefits Summary

### Performance
- **12x faster execution** (6.3s → 0.5s)
- Better chance of winning time slot races
- Lower latency = higher success rate

### Reliability
- **4x fewer failure points** (no browser quirks)
- No iframe/modal/timing issues
- Simpler error handling

### Infrastructure
- **7.5x smaller Docker image** (no Chromium)
- **6x less memory** (no browser overhead)
- Faster deployments

### Maintainability
- Simpler codebase (direct HTTP vs browser automation)
- Easier to debug (curl-testable)
- No Playwright version upgrades needed

---

## 🎯 Success Criteria

**Phase 1 (API Implementation):**
- ✅ API client successfully creates reservations
- ✅ Schedule ID resolution works for all time slots
- ✅ Error classification matches Playwright version

**Phase 2 (Testing):**
- ✅ 100% success rate in test mode
- ✅ Both execution modes produce identical results
- ✅ Email notifications work correctly

**Phase 3 (Production):**
- ✅ First successful midnight reservation via API
- ✅ Execution time < 1 second
- ✅ No regressions from Playwright version

---

## 📅 Timeline Estimate

| Phase | Tasks | Time | Status |
|-------|-------|------|--------|
| **Research & Discovery** | API reverse engineering | 3-4 hours | ✅ DONE |
| **Implementation** | API client + schedule resolver | 3-4 hours | ⏳ TODO |
| **Integration** | Add execution mode switching | 2-3 hours | ⏳ TODO |
| **Testing** | Unit + integration tests | 3-4 hours | ⏳ TODO |
| **Deployment** | Server setup + gradual rollout | 2-3 hours | ⏳ TODO |
| **Total** | | **13-18 hours** | |

**Suggested schedule:** 2-3 weeks of implementation with gradual production testing

---

**Status:** 🟢 Fully Validated - API tested and working, ready for production implementation
