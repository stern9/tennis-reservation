# 🎾 Automated Tennis Court Reservation System

Automatically reserves tennis courts at Parques del Sol based on a rolling availability window.

## 🎯 What It Does

**Automatically reserves:**
- **Court 1** on Tuesdays & Fridays at 6:00 AM
- **Court 2** on Tuesdays & Fridays at 7:00 AM
- **Court 1** on Saturdays at 9:00 AM

**How it works:**
- Runs every day at 23:59 (11:59 PM)
- Checks if new dates become available (Court 1: 9 days ahead, Court 2: 8 days ahead)
- If the new date is a Tuesday/Friday/Saturday, makes the reservation
- Sends you an email confirmation via Gmail

## 📋 Setup Instructions

### 1. Create GitHub Repository

1. Create a new **private** repository on GitHub (e.g., `tennis-reservation`)
2. Clone or initialize this code in that repo
3. Push the files to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tennis-reservation.git
   git push -u origin main
   ```

### 2. Setup Gmail App Password

To send email notifications, you need a Gmail App Password:

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Enable **2-Step Verification** (if not already enabled)
4. Once 2FA is enabled, scroll down to **App passwords**
5. Click **App passwords**
6. Select app: **Mail**
7. Select device: **Other (Custom name)** → type "Tennis Reservation"
8. Click **Generate**
9. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### 3. Configure GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these **5 secrets**:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `TENNIS_USERNAME` | Your tennis account username | `1Ji` |
| `TENNIS_PASSWORD` | Your tennis account password | `12345` |
| `EMAIL_TO` | Email where you want notifications | `your.email@gmail.com` |
| `GMAIL_USER` | Your Gmail address | `your.email@gmail.com` |
| `GMAIL_PASSWORD` | Gmail App Password from step 2 | `abcd efgh ijkl mnop` |

**Important:** Use the 16-character App Password, NOT your regular Gmail password!

### 4. Test the Setup

#### Test Run (Recommended before going live):

1. Go to **Actions** tab in your GitHub repo
2. Select **"Test Reservation (Manual Run)"**
3. Click **"Run workflow"** button
4. Fill in the parameters:
   - **Target date:** Pick a date you know is available (e.g., `2025-10-05`)
   - **Court 1 time:** `06:00 AM - 07:00 AM` (or choose available slot)
   - **Court 2 time:** `07:00 AM - 08:00 AM` (or choose available slot)
   - **Test Court 1:** ✅ (checked)
   - **Test Court 2:** ✅ (checked)
5. Click **"Run workflow"** green button
6. Wait 2-3 minutes for it to complete
7. Check your email for confirmation! 📧

**What to expect:**
- The workflow will login, navigate to the reservation form, and book the courts
- You'll get an email with the results
- If it fails, check the logs in the Actions run

### 5. Enable Production (Automatic Daily Runs)

Once your test succeeds:

✅ The production workflow is **already configured**!

- It runs automatically every day at **23:59 UTC**
- No action needed on your part
- You'll receive emails when reservations are made

## 🕐 Timing & Timezone

**Default schedule:** 23:59 UTC (11:59 PM UTC)

**To adjust for your timezone:**

Edit `.github/workflows/reserve-courts-production.yml`:

```yaml
schedule:
  # Current: 23:59 UTC
  - cron: '59 23 * * *'

  # For Costa Rica (UTC-6), to run at 11:59 PM local time:
  # 11:59 PM local = 5:59 AM UTC next day
  - cron: '59 5 * * *'
```

**Quick timezone reference:**
- UTC = 23:59
- EST (UTC-5) = 04:59 (next day)
- CST/Costa Rica (UTC-6) = 05:59 (next day)
- PST (UTC-8) = 07:59 (next day)

Use [crontab.guru](https://crontab.guru/) to verify your cron time.

## 📊 Monitoring & Logs

### View Run Logs:

1. Go to **Actions** tab in your repo
2. Click on any workflow run
3. Click the job name to see detailed logs
4. Expand steps to see what happened

### Download Log Files:

If a run fails, logs are saved as artifacts:
1. Scroll down on the workflow run page
2. Find **Artifacts** section
3. Download `reservation-logs` or `test-reservation-logs`

### Email Notifications:

You'll receive emails for:
- ✅ Successful reservations (with details)
- ❌ Failed reservations (with error info)

## 🔧 Customization

### Change Reservation Schedule:

Edit `scripts/reserve.js`:

```javascript
courts: {
  court1: {
    slots: {
      'Tuesday': '06:00 AM - 07:00 AM',
      'Friday': '06:00 AM - 07:00 AM',
      'Saturday': '09:00 AM - 10:00 AM'
      // Add more days:
      // 'Monday': '07:00 AM - 08:00 AM',
      // 'Wednesday': '06:00 AM - 07:00 AM',
    }
  },
  court2: {
    slots: {
      'Tuesday': '07:00 AM - 08:00 AM',
      'Friday': '07:00 AM - 08:00 AM'
      // Add more days:
      // 'Saturday': '08:00 AM - 09:00 AM',
    }
  }
}
```

**Available days:** `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`

### Available Time Slots:

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

## 🐛 Troubleshooting

### "Login failed"
- ✅ Check `TENNIS_USERNAME` and `TENNIS_PASSWORD` secrets are correct
- ✅ Try logging in manually on the website to verify credentials

### "Date not available"
- ✅ The rolling window may have changed (verify booking window manually)
- ✅ Courts may be fully booked already
- ✅ Check the logs to see which date was attempted

### "Email not sent" or "Authentication failed"
- ✅ Verify you're using the **App Password**, not your regular Gmail password
- ✅ Make sure `GMAIL_USER` is your full Gmail address
- ✅ Confirm 2-Step Verification is enabled on your Google account
- ✅ Try generating a new App Password

### Workflow didn't run automatically
- ✅ Check **Actions** tab to see if workflows are enabled
- ✅ Verify the cron schedule in `reserve-courts-production.yml`
- ✅ GitHub requires at least 1 commit in the last 60 days to run scheduled workflows

### Test workflow fails immediately
- ✅ Make sure all 5 secrets are configured correctly
- ✅ Check that the target date is actually available on the website
- ✅ Review the logs for specific error messages

## 📁 File Structure

```
tennis-reservation/
├── .github/
│   └── workflows/
│       ├── reserve-courts-production.yml   # Daily automatic runs
│       └── test-reservation.yml            # Manual testing
├── scripts/
│   └── reserve.js                          # Main reservation script
├── logs/                                   # Auto-generated (ignored by git)
├── package.json                            # Node dependencies
├── .gitignore                              # Git ignore file
└── README.md                               # This file
```

## 🔒 Security

- ✅ All credentials stored as **encrypted GitHub Secrets**
- ✅ Repository should be **private** to keep your info safe
- ✅ Passwords never appear in logs
- ✅ Browser runs in headless mode (no UI)
- ✅ Gmail App Password is safer than using your main password

## 💰 Cost

**100% FREE!**
- GitHub Actions: 2000 minutes/month (free for private repos)
- Gmail: Free email sending
- No server costs
- No subscriptions

## 🎯 Quick Start Checklist

- [ ] Create private GitHub repo
- [ ] Push code to repo
- [ ] Generate Gmail App Password
- [ ] Add all 5 GitHub Secrets
- [ ] Run test workflow with a known available date
- [ ] Check email for test confirmation
- [ ] Verify production workflow is scheduled
- [ ] Done! 🎉

## 📝 Notes

- The script books **both courts back-to-back** on Tuesdays/Fridays to get a 2-hour play window (smart workaround for the 1-hour limit!)
- Saturday only books Court 1 at 9 AM
- Adjust the schedule anytime by editing `scripts/reserve.js` and pushing changes

## 🙋 Support

If something goes wrong:
1. Check the **Actions** logs for detailed error messages
2. Verify all secrets are set correctly
3. Test with the manual test workflow first
4. Make sure the website structure hasn't changed

---

**Pro tip:** Star ⭐ this repo so you can find it easily later!
