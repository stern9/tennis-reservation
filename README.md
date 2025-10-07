# 🎾 Automated Tennis Court Reservation System

Automatically reserves tennis courts at Parques del Sol based on a rolling availability window.

## 🎯 What It Does

**Automatically reserves:**
- **Court 1** on Tuesdays & Fridays at 6:00 AM, Saturdays at 9:00 AM
- **Court 2** on Tuesdays & Fridays at 7:00 AM

**How it works:**
- **11:58 PM Costa Rica time**: Script starts and logs in
- **12:00 AM**: New dates become available, script immediately reserves
- **Court 1**: 9 days ahead
- **Court 2**: 8 days ahead
- Sends email confirmation via Gmail

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Gmail App Password

To send email notifications, you need a Gmail App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Enable **2-Step Verification** (if not already enabled)
4. Scroll down to **App passwords**
5. Click **App passwords**
6. Select app: **Mail**
7. Select device: **Other (Custom name)** → type "Tennis Reservation"
8. Click **Generate**
9. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### 3. Configure Environment Variables

Create a `.env` file or export these variables:

```bash
export TENNIS_USERNAME='your_username'
export TENNIS_PASSWORD='your_password'
export EMAIL_TO='your@email.com'
export GMAIL_USER='your_gmail@gmail.com'
export GMAIL_PASSWORD='your_16_char_app_password'
```

**Important:** Use the 16-character App Password, NOT your regular Gmail password!

### 4. Test the Setup

Before going live, test with available dates:

```bash
# Using the test script (interactive)
./test-local.sh

# Or manually with npm
npm run reserve:debug -- --target-date 2025-10-15 --court1-time "06:00 AM - 07:00 AM"
```

This will:
- Take screenshots at each step (saved to `screenshots/`)
- Show detailed logs
- Send you an email with results

## 🚀 Usage

### Production Mode (Auto-schedule)

Run at 11:58 PM to be ready for midnight:

```bash
# Schedule with cron (for DigitalOcean droplet)
# Run at 11:58 PM Costa Rica time (5:58 AM UTC)
58 5 * * * cd /path/to/tennis-reservation && node scripts/reserve.js
```

The script will:
1. Login at 11:58 PM
2. Wait until exactly 12:00 AM
3. Reserve courts as soon as dates become available

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

Use the interactive script:

```bash
./manual-reserve.sh
```

Or directly:

```bash
npm run reserve:test -- --target-date 2025-10-20 \
  --court1-time "06:00 AM - 07:00 AM"
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

Edit `scripts/reserve.js` to customize court schedules:

```javascript
courts: {
  court1: {
    areaId: '5',
    name: 'Cancha de Tenis 1',
    daysAhead: 9,
    slots: {
      'Tuesday': '06:00 AM - 07:00 AM',
      'Friday': '06:00 AM - 07:00 AM',
      'Saturday': '09:00 AM - 10:00 AM'
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
  - `DATE_NOT_AVAILABLE`: Date not in booking window yet
  - `DATE_NOT_CLICKABLE`: Date exists but not clickable (fully booked)
  - `SLOT_TAKEN`: Time slot already reserved by someone else
  - `RESERVATION_LIMIT`: You've exceeded your reservation limit
  - `TIME_SLOT_NOT_FOUND`: Requested time not available

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

### "Email not sent" or "Authentication failed"
- ✅ Verify you're using the **App Password**, not your regular Gmail password
- ✅ Make sure `GMAIL_USER` is your full Gmail address
- ✅ Confirm 2-Step Verification is enabled on your Google account
- ✅ Try generating a new App Password

### Script runs but doesn't reserve
- ✅ Run with `--debug --watch` flags to see browser interaction
- ✅ Check screenshots in `screenshots/` directory
- ✅ Review detailed logs for error messages

## 📁 File Structure

```
tennis-reservation/
├── scripts/
│   └── reserve.js              # Main reservation script
├── logs/                       # Auto-generated log files
├── screenshots/                # Debug screenshots (auto-cleaned)
├── test-local.sh               # Interactive test script
├── manual-reserve.sh           # Manual reservation trigger
├── package.json                # Dependencies and npm scripts
├── .gitignore                  # Git ignore file
├── README.md                   # This file
├── CLAUDE.md                   # Developer documentation
└── reservation_flow_documentation.md  # Complete navigation flow reference
```

## 🔒 Security

- ✅ All credentials in environment variables (never committed)
- ✅ Passwords never appear in logs
- ✅ Browser runs in headless mode (no UI)
- ✅ Gmail App Password is safer than using your main password
- ✅ Screenshots auto-deleted after email sent

## 💰 Cost

**100% FREE!**
- No subscriptions
- No server costs (if run locally)
- Optional: DigitalOcean droplet ($6/month for 24/7 reliability)

## 🎯 Next Steps

1. **Test locally**: Use `./test-local.sh` with available dates
2. **Verify all scenarios**:
   - ✅ Successful reservation
   - ❌ Date not available
   - ❌ Slot already taken
3. **Deploy to DigitalOcean** (optional):
   - Set up cron job at 11:58 PM Costa Rica time
   - More reliable than running from laptop
   - Details in deployment guide (coming soon)

## 📝 Notes

- The script books **both courts back-to-back** on Tuesdays/Fridays for a 2-hour play window
- Saturday only books Court 1 at 9 AM
- Adjust schedules anytime by editing `scripts/reserve.js`
- Timing is critical - script uses Costa Rica timezone (UTC-6)

## 🙋 Support

If something goes wrong:
1. Check the `logs/` directory for detailed error messages
2. Run with `--debug --watch` flags to see what's happening
3. Review screenshots in `screenshots/` directory
4. Verify all environment variables are set correctly
5. Test with known available dates first

---

**Pro tip:** Use `--dry-run` to preview what would be reserved without actually booking!
