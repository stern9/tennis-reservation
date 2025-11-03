🎾 Playwright Migration & Performance Optimization Plan

---

## 🚧 MIGRATION STATUS (Updated: 2025-11-03 - Afternoon)

### ✅ Phase 1: Foundation — COMPLETE
### ✅ Phase 2: Integration — COMPLETE
### ✅ Phase 3: Production Diagnosis & Optimization — COMPLETE

**Completed Items:**
- ✅ Playwright dependencies installed (`package.json` updated)
- ✅ `src/site-adapter.ts` created (400+ lines)
  - Selectors mapped (login, calendar, forms)
  - Direct URL builder with cache-busting
  - Unlock polling helper (`pollForDateUnlock`)
  - Value-based slot selection (`selectTimeSlot` using TIME_SLOT_VALUES)
  - Login/navigation helpers
- ✅ `src/engine.ts` created (350+ lines)
  - Browser context creation with resource blocking
  - Server time skew correction (`getServerTime`)
  - Session fallback detection (`detectSessionFailure`)
  - Parallel execution framework (`executeInParallel`)
  - Mock unlock mode (`enableMockUnlock`)
- ✅ Environment variable parsing
  - SESSION_MODE, SHADOW_MODE, ALLOW_BOOKING, etc.
  - All timing knobs (UNLOCK_MAX_MS, UNLOCK_POLL_MS, NAV_MS, SEL_MS)
- ✅ Basic Puppeteer→Playwright API conversion in `scripts/reserve.ts`
  - Imports: `chromium` instead of `puppeteer`
  - Methods: `.fill()`, `.selectOption()`, `waitUntil: "networkidle"`
  - `src/error-detection.ts` updated for Playwright Frame API
- ✅ TypeScript compiles cleanly (0 errors)
- ✅ New npm scripts added
  - `reserve:shadow`, `reserve:canary`, `reserve:mock-unlock`

**Files Modified:**
- `package.json` — Playwright dependency, new scripts
- `src/types.ts` — Added new Args fields
- `scripts/reserve.ts` — Basic Playwright conversion (imports, launch, fill, select)
- `src/error-detection.ts` — Playwright Frame API

**Files Created:**
- `src/site-adapter.ts`
- `src/engine.ts`

---

### ✅ Phase 2: Integration — COMPLETE (2025-11-02 Evening)

**Completed Items:**

1. ✅ **Refactored `reservePhase()` in `scripts/reserve.ts`** (~360 lines)
   - ✅ Replaced manual iframe navigation with `SiteAdapter.openReservationsModal()`, `selectAreaAndContinue()`
   - ✅ Replaced all 3–5s fixed delays with `SiteAdapter.pollForDateUnlock()` (180ms polls)
   - ✅ Replaced text-based slot selection with `SiteAdapter.selectTimeSlot()` (value-based with text fallback)
   - ✅ Added `SiteAdapter.submitReservation()` with SHADOW_MODE support

2. ✅ **Added ALLOW_BOOKING dead-man switch**
   - ✅ Checks `ALLOW_BOOKING` env var or `/tmp/allow_booking` flag before submit
   - ✅ Logs clear warnings if submission is blocked
   - ✅ Works alongside SHADOW_MODE for multi-layer safety

3. ✅ **Integrated server time skew correction**
   - ✅ Calls `Engine.getServerTime()` at script start
   - ✅ Logs `serverSkewMs` for telemetry
   - ✅ Warns if skew > 1 second

4. ✅ **Replaced 5s post-midnight delay**
   - ✅ Removed fixed `setTimeout(5000)` after midnight
   - ✅ Added T0 timestamp marking instead
   - ✅ Polling handles unlock timing dynamically

5. ✅ **Added telemetry logging**
   - ✅ T-stamp: T0 reached (logged with ISO timestamp)
   - ✅ T-stamp: Date unlocked at T+X.XX s
   - ✅ T-stamp: Form ready at T+Y.YY s
   - ✅ T-stamp: Submit at T+Z.ZZ s
   - ✅ All telemetry included in email summary with performance breakdown

6. ✅ **Implemented parallel execution** (SESSION_MODE=single)
   - ✅ Single browser context with two pages executing simultaneously
   - ✅ Uses `Promise.allSettled()` for robust parallel execution
   - ✅ Session fallback detection warns if auth errors detected
   - ✅ Falls back to sequential mode (contexts) if needed

7. ✅ **Mock unlock mode** (--mock-unlock)
   - ✅ Calls `Engine.enableMockUnlock()` when flag set
   - ✅ Allows testing unlock polling at any time of day

8. ✅ **Updated types**
   - ✅ Added `telemetry` and `error` fields to `ReservationResult`
   - ✅ TypeScript compiles with zero errors

**Actual Effort:** ~4 hours
**Build Status:** ✅ Compiles cleanly (0 errors)

---

### ✅ Phase 3: Production Diagnosis & Optimization — COMPLETE (2025-11-03)

**Production Failure Analysis (Nov 3 midnight):**
- ❌ Court 1 (Nov 12, Wed): Skipped - No Wednesday slot configured
- ❌ Court 2 (Nov 11, Tue): Failed - "DATE_NOT_AVAILABLE_YET - Date not clickable after 15000ms"
- ⏱️  Timing: Login at +8s, Court 2 second login at +15s, clicked at +18s (TOO LATE)

**Root Cause Identified:**
- SESSION_MODE=contexts created separate browser context for Court 2
- Second login took 7+ seconds, delaying arrival at calendar
- By +18s, competitors had already booked slots (taken by +5-10s)
- Date became unclickable when all slots filled

**Fix Implemented:**
1. ✅ **Smart Context Reuse** (saves 7-10s)
   - Court 2 reuses existing session when running alone
   - Only creates separate context when BOTH courts run (avoid modal conflicts)
   - Logic: `if (shouldReserveCourt1 && sessionMode === "contexts") { ... }`

2. ✅ **Enhanced Debug Logging**
   - Dumps calendar HTML on first poll attempt
   - Lists all clickable dates found
   - Logs every 10 poll attempts (~1.8s intervals)
   - Takes screenshot on polling failure
   - Shows frame URL and selector being used

**Test Results (Nov 3 afternoon):**
- ✅ Nov 11 test: Date found instantly (0ms)
- ✅ No double login: "Reusing existing session for Court 2" confirmed
- ✅ Form ready at T+4.14s, would submit at T+4.15s
- ✅ Total timing: ~12.5s (vs 34s in production failure)
- ✅ **Improvement: 10+ seconds faster arrival at calendar**

**Expected Performance:**
- Old: +18s to reach calendar (login 8s + second login 7s + navigation 3s)
- New: +8-12s to reach calendar (login 8s + navigation 4s, no second login)

**Deployment:** Ready for Nov 4 midnight production test

---

### 🎯 Next Steps

**Tonight (Nov 4 midnight):**
- Monitor logs for debug output
- Verify no double login occurs
- Check arrival timing at calendar
- Confirm Court 2 books successfully

---

📊 Performance Overview
Metric Current Target
Total Execution ~65–70 s 10–15 s
Fixed Delays 38 s 0 s (auto-waits + polls)
Re-login (Court 2) 10 s 0 s (shared session)
Sequential Flow 30 s 0 s (parallel pages)
🎯 Implementation Phases & Gates
Phase 1 – Foundation (3–4 days)

Build

site-adapter.ts → direct day URL, unlock poll, open form, submit by value

engine.ts → Playwright contexts, resource blocking, cache-buster, server skew correction

Safety flags: SHADOW_MODE, ALLOW_BOOKING, SESSION_MODE, auto-fallback

T-stamp logging infrastructure

Gate: In shadow mode, both courts reach “form ready” ≤ 10 s for 2 nights.

Phase 2 – Single Context, Parallel Pages (3–4 days)

Build

Convert reserve.ts → Playwright; preserve outputs

Default SESSION_MODE=single (two pages in parallel)

Replace fixed sleeps → domcontentloaded waits + 180 ms poll

Use TIME_SLOT_VALUES (value-based selection) with optional text fallback

Gate: Shadow “would submit” ≤ 10 s on 2–3 nights; no session errors.
If session symptom occurs → verify auto-fallback.

Phase 3 – Context Isolation (2–3 days if needed)

Build

Flip SESSION_MODE=contexts only if auto-fallback triggered

Keep everything else identical

Gate: Shadow runs clean 2 nights; T-stamps ≤ 10 s.

Phase 4 – Testing Infrastructure (2–3 days)

Build

--mock-unlock (route interception)

--canary low-demand slot trials (real submit)

Unit tests for time-cr and error-detection

README updates + benchmark script

Gate: Canary submit succeeds; email summary unchanged.

Phase 5 – Production Enablement
Night Mode
1–2 Both courts shadow
3 Court 1 real, Court 2 shadow
4 + Both real (ALLOW_BOOKING=1)
⚙️ Environment Knobs (Tunable)
SESSION_MODE=single # or "contexts"
SHADOW_MODE=1 # skip submit
ALLOW_BOOKING=0 # gate real submits
UNLOCK_MAX_MS=15000 # max wait for unlock
UNLOCK_POLL_MS=180 # poll interval
NAV_MS=1500 # navigation timeout
SEL_MS=1000 # selector timeout
FALLBACK_NEXT_SLOT=0 # try next slot on SLOT_TAKEN
RETRY_NAV_ON_FAIL=1 # retry navigation once on failure

🔒 Must Preserve (Non-Negotiables)

CR timezone logic (crMidnight(), addDaysCR(), ymdCR())

Error patterns (error-detection.ts, Spanish strings)

Calendar URL format (from formatDateForUrl(), unpadded)

Email subject/body structure

CLI flags and behavior

Log path (logs/reservation-{date}.log)

🚨 Risk Table
Risk Mitigation
Server publishes late 180 ms poll up to UNLOCK_MAX_MS; no fixed sleeps
Shared session breaks Auto-fallback → per-court contexts + SESSION_MODE switch
Stale DOM Fresh pages at T0, cache-buster &ts=Date.now(), block assets
UI copy change Value-based selection + temporary text fallback
Network latency VPS near host + NTP sync + one retry on fail
Regression in outputs Preserve email/log format + snapshot comparison
📈 Expected Performance Gains
Phase Duration ↓ Notes
2 (Parallel Pages) 65 → 10–15 s –10 s (no re-login) –20 s (delays) –25 s (parallel) –5 s (Playwright)
3 (Context Isolation) Maintain 10–15 s Stability improvement only
✅ Acceptance Criteria

Both courts submit (or would submit) ≤ 10 s of server-aligned T0

Email / log format identical to current

Error taxonomy unchanged (SLOT_TAKEN, DATE_NOT_AVAILABLE_YET, etc.)

Shadow / Canary / Mock modes work and documented

No re-login for Court 2 (unless SESSION_MODE=contexts or auto-fallback applied)

🎓 Testing Modes
Flag Purpose
--shadow Full flow, skip submit (SHADOW_MODE)
--canary Real submit on low-demand slot
--mock-unlock Simulate date unlock at any time
--no-booking Enforces ALLOW_BOOKING check
(Existing) --test, --debug, --watch, --dry-run
🧩 Telemetry & Debug Additions

Log serverSkewMs and T0 for each night

If auto-fallback fires: SESSION_FALLBACK_APPLIED court=2 reason=LOGIN_REDIRECT

Optional: log each phase’s elapsed time for fine-grained benchmarking

🚀 Strategy Summary

Fast but safe.

Default: single context → parallel pages

Tight unlock polling replaces fixed delays

Auto-fallback to contexts if session breaks

Shadow first → gradual prod rollout

Maintain 100 % logic compatibility, only optimize the hot path.
