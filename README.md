# 🎾 Automated Tennis Court Reservation System

Automatically reserves tennis courts at Parques del Sol based on a rolling availability window.

## 🎯 What It Does

**Automatically reserves:**
- **Court 1** on Tuesdays & Fridays at 6:00 AM, Saturdays at 9:00 AM, Sundays at 9:00 AM
- **Court 2** on Tuesdays & Fridays at 7:00 AM

**How it works:**
- **11:58 PM Costa Rica time**: Script starts, waits for midnight
- **12:00 AM**: Logs in to get fresh calendar with new dates
- **12:00:05 AM**: Immediately reserves courts (no waiting for date propagation)
- **Court 1**: 9 days ahead
- **Court 2**: 8 days ahead
- Sends email confirmation via Resend API

**Technology:**
- Built with **TypeScript** for type safety and maintainability
- Uses **Puppeteer** for browser automation
- **Resend API** for email notifications
- Timezone-aware using Costa Rica time (UTC-6)

## 📚 Documentation Guide

This repository has multiple documentation files for different purposes:

- **README.md** (this file) - User-facing setup and usage guide
- **CLAUDE.md** - Comprehensive technical reference for developers and AI assistants
- **NEXT_STEPS.md** - Future improvements and enhancement roadmap
- **reservation_flow_documentation.md** - Website structure and navigation reference

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

The project is written in TypeScript and must be compiled to JavaScript before running:

```bash
npm run build
```

This compiles:
- `scripts/reserve.ts` → `dist/scripts/reserve.js`
- `src/*.ts` → `dist/*.js`

**Note:** You need to rebuild after any code changes.

### 3. Get Resend API Key

To send email notifications, you need a Resend API key:

1. Go to https://resend.com/api-keys
2. Click **Create API Key**
3. Give it a name (e.g., "Tennis Reservations")
4. Copy the API key (starts with `re_`)

### 4. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
TENNIS_USERNAME=your_username
TENNIS_PASSWORD=your_password
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
TO_EMAIL_ADDRESS=your@email.com
FROM_EMAIL_ADDRESS=contact@yourdomain.com
```

**Note:** Your Resend domain must be verified to send emails.

### 5. Test the Setup

Before going live, test with available dates:

```bash
# Dry run (shows what would be reserved without actually doing it)
npm run reserve:dry-run

# Test with specific date (debug mode with screenshots)
npm run reserve:debug -- --target-date 2025-10-15 --court1-time "06:00 AM - 07:00 AM" --skip-court2
```

This will:
- Build TypeScript automatically (via npm scripts)
- Take screenshots at each step (saved to `screenshots/`)
- Show detailed logs
- Send you an email with results

## 🚀 Usage

### Production Mode (Deployed on Server)

See **Server Deployment** section below for full setup instructions.

### Test Mode

```bash
# Test with specific date (requires --target-date)
npm run reserve:test -- --target-date 2025-10-15

# Test with custom times
npm run reserve:test -- --target-date 2025-10-15 \
  --court1-time "09:00 AM - 10:00 AM" \
  --court2-time "10:00 AM - 11:00 AM"

# Test only Court 1
npm run reserve:test -- --target-date 2025-10-15 --skip-court2

# Dry run (preview what would be reserved)
npm run reserve:dry-run
```

### Manual Reservation

```bash
npm run reserve:test -- --target-date 2025-10-20 \
  --court1-time "06:00 AM - 07:00 AM" \
  --skip-court2
```

### Debug Mode

Enable screenshots and detailed logging:

```bash
# Debug mode with visible browser
npm run reserve:watch -- --target-date 2025-10-15

# Debug mode with screenshots (headless)
npm run reserve:debug -- --target-date 2025-10-15
```

Screenshots are saved to `screenshots/{timestamp}/` and automatically deleted after email is sent.

## 🔧 Configuration

Edit `scripts/reserve.ts` to customize court schedules:

```typescript
courts: {
  court1: {
    areaId: '5',
    name: 'Cancha de Tenis 1',
    daysAhead: 9,
    slots: {
      'Tuesday': '06:00 AM - 07:00 AM',
      'Friday': '06:00 AM - 07:00 AM',
      'Saturday': '09:00 AM - 10:00 AM',
      'Sunday': '09:00 AM - 10:00 AM'
      // Add more days as needed
    }
  },
  court2: {
    areaId: '7',
    name: 'Cancha de Tenis 2',
    daysAhead: 8,
    slots: {
      'Tuesday': '07:00 AM - 08:00 AM',
      'Friday': '07:00 AM - 08:00 AM'
      // Add more days as needed
    }
  }
}
```

**After making changes, rebuild:**
```bash
npm run build
```

**Available days:** `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`

**Available time slots:**
```
06:00 AM - 07:00 AM
07:00 AM - 08:00 AM
08:00 AM - 09:00 AM
09:00 AM - 10:00 AM
10:00 AM - 11:00 AM
11:00 AM - 12:00 PM
12:00 PM - 01:00 PM
01:00 PM - 02:00 PM
02:00 PM - 03:00 PM
03:00 PM - 04:00 PM
04:00 PM - 05:00 PM
05:00 PM - 06:00 PM
06:00 PM - 07:00 PM
```

## 📊 Monitoring & Logs

### View Logs

Logs are saved to `logs/reservation-{date}.log`:

```bash
tail -f logs/reservation-$(date +%Y-%m-%d).log
```

### Email Notifications

You'll receive emails for:
- ✅ **Successful reservations** - with court, date, and time details
- ⚠️ **Partial success** - some courts reserved, others failed
- ❌ **Failed reservations** - with specific error messages:
  - `SUCCESS`: Reservation confirmed
  - `DATE_NOT_AVAILABLE`: Date not in booking window yet
  - `DATE_NOT_AVAILABLE_YET`: Date not open for reservations yet
  - `DATE_FULLY_BOOKED`: All time slots taken for that date
  - `DATE_NOT_CLICKABLE`: Date exists but not clickable (should not occur with current fix)
  - `SLOT_TAKEN`: Time slot already reserved by someone else
  - `RESERVATION_LIMIT`: You've exceeded your reservation limit
  - `TIME_SLOT_NOT_FOUND`: Requested time not available
  - `UNKNOWN_ERROR`: Could not classify the server response

### Debug Screenshots

When running with `--debug` flag, screenshots are taken at:
1. Login page
2. Logged in dashboard
3. Reservations modal
4. Calendar view
5. Day view with time slots
6. Form filled out
7. Submission result

Screenshots are automatically deleted after the email is sent to save storage.

## 🐛 Troubleshooting

### "Login failed"
- ✅ Check `TENNIS_USERNAME` and `TENNIS_PASSWORD` are correct
- ✅ Try logging in manually on the website to verify credentials

### "DATE_NOT_AVAILABLE"
- ✅ The date may not be within the booking window yet (Court 1: 9 days, Court 2: 8 days)
- ✅ Check the website manually to confirm booking window

### "SLOT_TAKEN"
- ✅ Someone else reserved the slot first
- ✅ Run the script closer to midnight (11:58 PM) to be first in line
- ✅ Consider using DigitalOcean droplet for more reliable timing

### "Email not sent" or "Resend API error"
- ✅ Verify your `RESEND_API_KEY` is correct (starts with `re_`)
- ✅ Check your Resend domain is verified at https://resend.com/domains
- ✅ Make sure `FROM_EMAIL_ADDRESS` uses your verified domain
- ✅ Check Resend logs at https://resend.com/emails for delivery status

### Script runs but doesn't reserve
- ✅ Run with `--debug --watch` flags to see browser interaction
- ✅ Check screenshots in `screenshots/` directory
- ✅ Review detailed logs for error messages

## 📁 File Structure

```
tennis-reservation/
├── src/                        # TypeScript source files
│   ├── types.ts                # Type definitions
│   ├── time-cr.ts              # Costa Rica timezone utilities
│   └── error-detection.ts      # Error detection logic
├── scripts/
│   ├── reserve.ts              # Main reservation script (TypeScript)
│   └── diagnose-dates.js       # Timezone diagnostic tool
├── dist/                       # Compiled JavaScript (gitignored)
│   ├── src/
│   │   ├── types.js
│   │   ├── time-cr.js
│   │   └── error-detection.js
│   └── scripts/
│       └── reserve.js          # Compiled from reserve.ts
├── logs/                       # Auto-generated log files
├── screenshots/                # Debug screenshots (auto-cleaned)
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment variables template
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and npm scripts
├── .gitignore                  # Git ignore rules
├── README.md                   # This file (user guide)
├── CLAUDE.md                   # Technical documentation for developers/AI
├── NEXT_STEPS.md               # Future improvements roadmap
└── reservation_flow_documentation.md  # Website navigation reference
```

## 🔒 Security

- ✅ All credentials in environment variables (never committed to git)
- ✅ `.env` file is gitignored and should have `chmod 600` permissions
- ✅ Passwords never appear in logs
- ✅ Browser runs in headless mode (no UI)
- ✅ Resend API for secure email delivery
- ✅ Screenshots auto-deleted after email sent
- ⚠️ **Production recommendation**: Use 1Password CLI or similar vault for secrets (see `NEXT_STEPS.md`)

## 💰 Cost

**Minimal cost:**
- DigitalOcean droplet: $6/month (for 24/7 reliability)
- Resend: Free tier (3,000 emails/month)
- Puppeteer/Node.js: Free and open source

## 🚀 Server Deployment

### Prerequisites

You'll need:
- Ubuntu server (tested on Ubuntu 24.04)
- Node.js installed
- Git installed
- sudo access

### Step 1: Install System Dependencies

Chrome/Puppeteer requires system libraries:

```bash
sudo apt-get update

sudo apt-get install -y \
  libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 \
  libc6 libcairo2 libcups2t64 libdbus-1-3 libexpat1 \
  libfontconfig1 libgcc-s1 libgdk-pixbuf2.0-0 \
  libglib2.0-0t64 libgtk-3-0t64 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
  libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
  libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  ca-certificates fonts-liberation libnss3 \
  lsb-release xdg-utils wget libgbm1
```

### Step 2: Clone and Setup

```bash
cd ~
git clone https://github.com/yourusername/tennis-reservation.git
cd tennis-reservation
npm install
npm run build  # Compile TypeScript
```

### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

Add your credentials:

```bash
TENNIS_USERNAME=your_username
TENNIS_PASSWORD=your_password
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
TO_EMAIL_ADDRESS=your@email.com
FROM_EMAIL_ADDRESS=contact@yourdomain.com
```

**Secure the file:**

```bash
chmod 600 .env  # Only owner can read/write
```

**Note:** The script reads `.env` automatically via `dotenv`. No need to add to `~/.bashrc`.

**For production:** Consider using 1Password CLI or similar vault instead of plain `.env` file (see `NEXT_STEPS.md`).

### Step 4: Test

```bash
npm run reserve:dry-run
```

You should see what would be reserved (if anything) without actually making reservations.

### Step 5: Setup Cron Jobs

```bash
crontab -e
```

Add these lines:

```bash
# Clean up old logs daily at 3 AM UTC (9 PM Costa Rica)
0 3 * * * find /home/yourusername/tennis-reservation/logs/ -name "reservation-*.log" -mtime +30 -delete && find /home/yourusername/tennis-reservation/logs/ -name "cron.log" -mtime +90 -delete

# Run reservation script at 11:58 PM Costa Rica time (5:58 AM UTC)
58 5 * * * /path/to/node /home/yourusername/tennis-reservation/dist/scripts/reserve.js >> /home/yourusername/tennis-reservation/logs/cron.log 2>&1
```

**Find your Node.js path:**
```bash
which node
# Example output: /home/yourusername/.nvm/versions/node/v22.20.0/bin/node
```

Use that full path in the cron job.

**Verify cron is set:**
```bash
crontab -l
```

### Monitoring

Check logs:

```bash
# Today's reservation log
tail -f ~/tennis-reservation/logs/reservation-$(date +%Y-%m-%d).log

# Cron execution log
tail -f ~/tennis-reservation/logs/cron.log
```

Check cron is running:

```bash
crontab -l
```

### Updating

To pull latest code:

```bash
cd ~/tennis-reservation
git pull
npm install  # if dependencies changed
npm run build  # rebuild TypeScript
```

No need to restart - cron will use updated compiled code on next run.

## 📝 Notes

- The script books **both courts back-to-back** on Tuesdays/Fridays for a 2-hour play window
- Saturday and Sunday book Court 1 at 9 AM
- Adjust schedules anytime by editing `scripts/reserve.ts` (remember to rebuild!)
- Timing is critical - script uses Costa Rica timezone (UTC-6)
- Built with TypeScript for maintainability and type safety

## 🙋 Support

If something goes wrong:
1. Check the `logs/` directory for detailed error messages
2. Run with `--debug --watch` flags to see what's happening
3. Review screenshots in `screenshots/` directory
4. Verify all environment variables are set correctly
5. Test with known available dates first

---

**Pro tip:** Use `--dry-run` to preview what would be reserved without actually booking!
