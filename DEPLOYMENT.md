# 🚀 Playwright Migration - Deployment Guide

**Status:** Phase 2 Complete - Ready for Testing
**Date:** 2025-11-02

---

## 📋 Pre-Deployment Checklist

### Local Testing (Before Server Deployment)

- [ ] **Install Playwright browsers**
  ```bash
  npx playwright install chromium
  ```

- [ ] **Run local shadow mode test**
  ```bash
  npm run reserve:test -- --target-date 2025-11-15 --shadow --debug --skip-court2
  ```

- [ ] **Verify build compiles**
  ```bash
  npm run build
  # Should complete with 0 errors
  ```

- [ ] **Test mock unlock mode**
  ```bash
  npm run reserve:mock-unlock -- --target-date 2025-11-15 --debug
  ```

- [ ] **Verify telemetry logging**
  - Check logs/reservation-*.log for performance timestamps
  - Confirm email includes telemetry breakdown
  - Verify T0, unlock, form ready, submit times

---

## 🚀 Production Server Setup (Quick Start)

**Actual production setup used (2025-11-03):**

### Server Info
- **Server**: stern9-web-nyc (DigitalOcean Ubuntu)
- **User**: stern9
- **Path**: `/home/stern9/tennis-reservation`
- **Node**: v22.20.0 (via nvm)
- **Cron config**: Uses `~/.env.cron` for environment variables

### Environment File Setup

```bash
# Edit environment file (used by cron)
nano ~/.env.cron

# Add these variables (in addition to existing ones):
export ALLOW_BOOKING=1          # 1 = real bookings, 0 = blocked
export SHADOW_MODE=0            # 0 = real, 1 = shadow mode
export SESSION_MODE=contexts    # contexts = sequential (recommended)
```

### Installation Commands

```bash
# 1. Navigate to project
cd /home/stern9/tennis-reservation

# 2. Discard any local changes and pull latest
git checkout -- package-lock.json
git pull origin main

# 3. Install dependencies
npm install

# 4. Install Playwright
npx playwright install chromium
npx playwright install-deps chromium

# 5. Build TypeScript
npm run build

# 6. Verify build
ls -la dist/src/engine.js dist/src/site-adapter.js dist/scripts/reserve.js
# All three files should exist with recent timestamps

# 7. Verify Playwright installed
npm list playwright
# Should show: playwright@1.56.1 or similar

# 8. Verify environment
grep -E "ALLOW_BOOKING|SHADOW_MODE|SESSION_MODE" ~/.env.cron
```

### Existing Cron Job (Already Configured)

```bash
# View cron
crontab -l

# Existing job (no changes needed):
58 5 * * * bash -c 'source ~/.env.cron && /home/stern9/.nvm/versions/node/v22.20.0/bin/node /home/stern9/tennis-reservation/dist/scripts/reserve.js' >> /home/stern9/tennis-reservation/logs/cron.log 2>&1
```

**Timing**: 5:58 AM UTC = 11:58 PM Costa Rica time (script waits for midnight)

### Verification After First Run

```bash
# Check today's log
tail -100 ~/tennis-reservation/logs/reservation-$(date +%Y-%m-%d).log

# Look for:
# - "🕛 Midnight reached!"
# - "Date unlocked at T+X.XXs"
# - "SUCCESS: Reserved..."
# - Performance telemetry

# Check cron output
tail -50 ~/tennis-reservation/logs/cron.log
```

---

## 🖥️ Server Requirements

### System Dependencies

Playwright requires additional system libraries on Linux servers:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0

# Or use Playwright's installer (recommended)
npx playwright install-deps chromium
```

### Node.js Version

- **Minimum:** Node.js 18.x
- **Recommended:** Node.js 20.x or later

Verify on server:
```bash
node --version
# Should be >= 18.0.0
```

### Disk Space

- Chromium browser: ~350 MB
- Node modules: ~500 MB
- Total: ~1 GB free space recommended

---

## 📦 Server Installation Steps

### 1. Backup Current System

```bash
# Create backup of current working setup
cd /path/to/tennis-reservation
tar -czf ../tennis-reservation-backup-$(date +%Y%m%d).tar.gz .
```

### 2. Pull Latest Code

```bash
git pull origin main
# Or if using different branch:
# git pull origin playwright-migration
```

### 3. Install Dependencies

```bash
# Install npm packages
npm install

# Install Playwright browsers
npx playwright install chromium

# Install system dependencies (Ubuntu/Debian)
npx playwright install-deps chromium
```

### 4. Build TypeScript

```bash
npm run build
# Verify dist/ directory is created with compiled .js files
```

### 5. Test Headless Mode

```bash
# Test that headless browser works on server
npm run reserve:test -- --target-date 2025-11-15 --shadow --skip-court2
```

---

## 🧪 Testing Workflow

### Phase 1: Local Testing (1-2 days)

**Goals:**
- Verify Playwright browsers install correctly
- Test shadow mode works end-to-end
- Confirm telemetry logging functions
- Validate parallel execution (both courts)

**Commands:**
```bash
# Single court test
npm run reserve:test -- --target-date 2025-11-15 --shadow --debug --skip-court2

# Both courts parallel test
npm run reserve:test -- --target-date 2025-11-15 --shadow --debug

# Mock unlock test
npm run reserve:mock-unlock -- --target-date 2025-11-15 --debug
```

**Success Criteria:**
- ✅ Script completes without errors
- ✅ Telemetry shows unlock < 15s
- ✅ Form ready < 10s from T0
- ✅ No browser crashes
- ✅ Email summary includes performance data

---

### Phase 2: Server Shadow Testing (3-5 nights)

**Goals:**
- Verify server environment works
- Monitor real midnight timing
- Detect any server-specific issues
- Collect performance baseline data

**Setup:**

1. **Disable real submissions** (set both flags for safety):
```bash
# Add to ~/.bashrc or ~/.profile
export SHADOW_MODE=1
export ALLOW_BOOKING=0
```

2. **Update cron job for shadow mode**:
```bash
crontab -e

# Change to shadow mode (add --shadow flag)
58 5 * * * cd /path/to/tennis-reservation && npm run reserve:shadow >> /path/to/tennis-reservation/logs/cron.log 2>&1
```

3. **Monitor for 3-5 nights**:
```bash
# Check logs daily
tail -100 logs/reservation-$(date +%Y-%m-%d).log

# Look for:
# - T0 timestamp
# - Unlock timing (should be < 15s)
# - Form ready timing
# - "SHADOW MODE" confirmation
# - Any errors or warnings
```

**Success Criteria:**
- ✅ Runs successfully 3+ nights in a row
- ✅ Telemetry shows consistent performance (< 10-15s)
- ✅ No session errors in parallel mode
- ✅ Email summaries arrive with telemetry
- ✅ No browser/memory issues

**Rollback Plan:**
If shadow testing fails:
```bash
# Restore backup
cd /path/to
tar -xzf tennis-reservation-backup-YYYYMMDD.tar.gz -C tennis-reservation/

# Revert cron job to old script
crontab -e
# Remove --shadow flag or revert to old command
```

---

### Phase 3: Canary Testing (1-2 nights)

**Goals:**
- Test real submissions on low-stakes slots
- Verify ALLOW_BOOKING switch works
- Confirm booking success detection

**Setup:**

1. **Enable real bookings** (remove shadow mode, add allow booking):
```bash
# Update environment
export SHADOW_MODE=0  # or unset
export ALLOW_BOOKING=1
```

2. **Test with lower priority slot** (optional):
```bash
# Temporarily modify CONFIG in reserve.ts to use less critical time slot
# Example: Test with a weekday afternoon slot first
```

3. **Monitor closely**:
- Watch for successful booking confirmation
- Verify email shows "SUCCESS" not "SHADOW"
- Check website to confirm booking appears

**Success Criteria:**
- ✅ Real booking succeeds
- ✅ Email shows success confirmation
- ✅ Booking visible on website
- ✅ Telemetry data accurate

---

### Phase 4: Full Production (Day 1+)

**Goals:**
- Enable both courts with real submissions
- Monitor performance vs. baseline
- Track success rate

**Setup:**

1. **Enable production mode**:
```bash
# Environment should have:
export ALLOW_BOOKING=1
unset SHADOW_MODE  # or SHADOW_MODE=0

# Or create flag file:
touch /tmp/allow_booking
```

2. **Update cron to production**:
```bash
crontab -e

# Remove --shadow flag
58 5 * * * cd /path/to/tennis-reservation && npm run reserve >> /path/to/tennis-reservation/logs/cron.log 2>&1
```

3. **Monitor first week**:
```bash
# Daily log review
grep "SUCCESS\|FAILED" logs/reservation-*.log

# Check telemetry trends
grep "Performance:" logs/reservation-*.log
```

**Success Criteria:**
- ✅ Both courts book successfully
- ✅ Total time < 15s (vs. 65-70s baseline)
- ✅ No increase in failures
- ✅ Email notifications work

---

## ⚙️ Environment Configuration

### Required Variables

```bash
# Existing (already configured)
export TENNIS_USERNAME="your_username"
export TENNIS_PASSWORD="your_password"
export EMAIL_TO="your_email@example.com"
export RESEND_API_KEY="re_xxxxxxxxxxxxx"

# New (Playwright migration)
export ALLOW_BOOKING=1           # Enable real submissions (default: 0)
export SHADOW_MODE=0             # Disable shadow mode (default: 0)
export SESSION_MODE=single       # Use parallel execution (default: single)
```

### Optional Tuning Variables

```bash
# Timing parameters (defaults work well, but can tune if needed)
export UNLOCK_MAX_MS=15000       # Max wait for unlock (default: 15s)
export UNLOCK_POLL_MS=180        # Poll interval (default: 180ms)
export NAV_MS=1500               # Navigation timeout (default: 1.5s)
export SEL_MS=1000               # Selector timeout (default: 1s)
```

---

## 🚨 Rollback Procedures

### If Shadow Testing Fails

```bash
# 1. Stop cron job
crontab -e
# Comment out the line

# 2. Restore backup
cd /path/to
tar -xzf tennis-reservation-backup-YYYYMMDD.tar.gz -C tennis-reservation/

# 3. Test old version
cd tennis-reservation
npm run reserve:test -- --target-date 2025-11-15

# 4. Re-enable cron with old version
crontab -e
# Uncomment and verify old command
```

### If Production Has Issues

**Quick disable:**
```bash
# Option 1: Remove flag file
rm /tmp/allow_booking

# Option 2: Set env var
export ALLOW_BOOKING=0

# Option 3: Enable shadow mode
export SHADOW_MODE=1
```

**Full rollback:**
```bash
# Restore old version (see above)
# Update cron job to old script
# Monitor for 1-2 nights
```

---

## 📊 Performance Monitoring

### Key Metrics to Track

**Timing (from telemetry):**
- T0 to unlock: Target < 5s, Max < 15s
- Unlock to form ready: Target < 3s
- Form ready to submit: Target < 2s
- Total T0 to submit: Target < 10-15s

**Success Rate:**
- Compare to baseline success rate
- Track SLOT_TAKEN vs. SUCCESS ratio
- Monitor DATE_NOT_AVAILABLE_YET errors

**System Resources:**
```bash
# Monitor during execution
top -u your_user

# Check memory usage
free -h

# Check disk space
df -h
```

### Logs to Monitor

```bash
# Main reservation log
tail -f logs/reservation-$(date +%Y-%m-%d).log

# Cron output
tail -f logs/cron.log

# System logs
sudo journalctl -u cron -f
```

---

## 🔧 Troubleshooting

### Playwright Browser Not Found

**Error:** `Executable doesn't exist at .../chromium...`

**Solution:**
```bash
npx playwright install chromium
npx playwright install-deps chromium
```

### Headless Browser Crashes

**Symptoms:** Browser exits unexpectedly, "Protocol error"

**Solutions:**
```bash
# Option 1: Install missing dependencies
npx playwright install-deps chromium

# Option 2: Add more memory to browser
# Edit reserve.ts launch options:
args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

# Option 3: Check available memory
free -h
# If low, consider increasing swap or server resources
```

### Session Errors in Parallel Mode

**Symptoms:** Court 2 fails with "login", "auth", or "session" errors

**Solution:**
```bash
# Switch to contexts mode (uses separate sessions)
export SESSION_MODE=contexts

# This is now the recommended default mode
# Optimized: No double login when only one court runs
# Only creates separate context when both courts run (to avoid modal conflicts)
```

### Slow Performance

**Symptoms:** Telemetry shows > 20s total time

**Check:**
1. Network latency to server
2. Server CPU/memory usage
3. Polling interval (might need to increase UNLOCK_POLL_MS)

### Date Not Unlocking

**Symptoms:** "Date not clickable after 15000ms"

**Common Causes:**
1. **Slots already taken by competitors** - Date becomes unclickable when all slots filled
   - Check debug logs for list of clickable dates
   - Verify arrival timing (should be < 10-12s from midnight)
   - If consistently late, check for double login issue

2. **Stale calendar from second login** - Separate context loaded old calendar state
   - Fixed in Nov 2025 - SESSION_MODE=contexts now optimized
   - Verify logs show "Reusing existing session" for single-court runs

**Solutions:**
1. Check debug logs to see which dates ARE clickable
2. Increase max wait: `export UNLOCK_MAX_MS=30000`
3. Review screenshot saved in `screenshots/polling-failure-*.png`
4. Test with `--mock-unlock` flag locally

---

## 📞 Support Checklist

**Before asking for help, verify:**

- [ ] `npm run build` completes successfully
- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] System dependencies installed (`npx playwright install-deps`)
- [ ] Node.js version >= 18.x (`node --version`)
- [ ] Environment variables set correctly
- [ ] Logs show actual error (check `logs/reservation-*.log`)
- [ ] Tested in shadow mode first

**Include in support request:**
- Error message from logs
- Output of `npm run build`
- Node version (`node --version`)
- OS/Server info (`uname -a`)
- Recent log file (`logs/reservation-*.log`)

---

## ✅ Go-Live Checklist

### Pre-Production

- [ ] Local testing passed (all test modes)
- [ ] Server shadow testing passed (3+ nights)
- [ ] Canary test succeeded (optional)
- [ ] Backup created
- [ ] Rollback procedure documented and tested
- [ ] ALLOW_BOOKING flag ready to enable

### Production Day

- [ ] Monitor first run in real-time
- [ ] Verify both courts book successfully
- [ ] Check email notification arrives
- [ ] Confirm bookings visible on website
- [ ] Review telemetry data
- [ ] Compare performance to baseline

### First Week

- [ ] Daily log review
- [ ] Track success rate
- [ ] Monitor system resources
- [ ] Review telemetry trends
- [ ] Address any issues promptly

---

## 📈 Expected Results

**Old System (Puppeteer):**
- Total time: 65-70 seconds
- Fixed delays: 38 seconds
- Re-login overhead: 10 seconds
- Sequential execution: 100% of time

**New System (Playwright):**
- Total time: 10-15 seconds (85% reduction)
- Fixed delays: 0 seconds
- Re-login overhead: 0 seconds (shared session)
- Parallel execution: 50% time reduction

**Success Rate:**
- Should maintain or improve current success rate
- Faster execution = better chance of getting slots
- More reliable unlock detection

---

**Last Updated:** 2025-11-02
**Migration Status:** Phase 2 Complete - Ready for Testing
