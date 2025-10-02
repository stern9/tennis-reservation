const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  loginUrl: 'https://parquesdelsol.sasweb.net/',
  username: process.env.TENNIS_USERNAME,
  password: process.env.TENNIS_PASSWORD,
  emailTo: process.env.EMAIL_TO,
  gmailUser: process.env.GMAIL_USER,
  gmailPassword: process.env.GMAIL_PASSWORD,
  testMode: process.env.TEST_MODE === 'true',

  // Court configurations
  courts: {
    court1: {
      areaId: '5',
      name: 'Cancha de Tenis 1',
      daysAhead: 9,
      slots: {
        'Tuesday': '06:00 AM - 07:00 AM',
        'Friday': '06:00 AM - 07:00 AM',
        'Saturday': '09:00 AM - 10:00 AM'
      }
    },
    court2: {
      areaId: '7',
      name: 'Cancha de Tenis 2',
      daysAhead: 8,
      slots: {
        'Tuesday': '07:00 AM - 08:00 AM',
        'Friday': '07:00 AM - 08:00 AM'
      }
    }
  }
};

// Time slot value mappings (these are the database IDs from the form)
const TIME_SLOT_VALUES = {
  '06:00 AM - 07:00 AM': '243',
  '07:00 AM - 08:00 AM': '250',
  '08:00 AM - 09:00 AM': '257',
  '09:00 AM - 10:00 AM': '264',
  '10:00 AM - 11:00 AM': '271',
  '11:00 AM - 12:00 PM': '278',
  '12:00 PM - 01:00 PM': '285',
  '01:00 PM - 02:00 PM': '292',
  '02:00 PM - 03:00 PM': '299',
  '03:00 PM - 04:00 PM': '306',
  '04:00 PM - 05:00 PM': '313',
  '05:00 PM - 06:00 PM': '320',
  '06:00 PM - 07:00 PM': '327'
};

// Logging setup
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `reservation-${new Date().toISOString().split('T')[0]}.log`);

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Date utilities
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function formatDateForUrl(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
}

// Email notification
async function sendEmail(subject, body, isSuccess = true) {
  if (!CONFIG.gmailUser || !CONFIG.gmailPassword || !CONFIG.emailTo) {
    log('Email not configured, skipping notification', 'WARN');
    return;
  }

  try {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: CONFIG.gmailUser,
        pass: CONFIG.gmailPassword
      }
    });

    const mailOptions = {
      from: CONFIG.gmailUser,
      to: CONFIG.emailTo,
      subject: `🎾 ${subject}`,
      text: body,
      html: `<pre>${body}</pre>`
    };

    await transporter.sendMail(mailOptions);
    log('Email notification sent successfully via Gmail');
  } catch (error) {
    log(`Failed to send email: ${error.message}`, 'ERROR');
  }
}

// Main reservation function
async function makeReservation(browser, courtConfig, targetDate, timeSlot) {
  const page = await browser.newPage();

  try {
    log(`Starting reservation for ${courtConfig.name} on ${targetDate.toDateString()} at ${timeSlot}`);

    // Step 1: Login
    log('Navigating to login page...');
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle0' });

    const textboxes = await page.$$('input[type="text"], input:not([type])');
    if (textboxes.length < 2) {
      throw new Error('Login form not found');
    }

    await textboxes[0].type(CONFIG.username);
    await textboxes[1].type(CONFIG.password);

    await page.click('button:has-text("Ingresar")');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    log('Login successful');

    // Step 2: Navigate to reservations
    log('Navigating to reservations...');
    await page.evaluate(() => {
      const link = document.querySelector('a[href="pre_reservations.php"]');
      if (link) link.click();
    });

    await page.waitForTimeout(2000); // Wait for modal to open

    // Step 3: Select area in iframe
    log(`Selecting ${courtConfig.name}...`);
    const frameHandle = await page.$('iframe');
    const frame = await frameHandle.contentFrame();

    await frame.select('#area', courtConfig.areaId);
    await frame.waitForTimeout(500);

    await frame.click('input#btn_cont');
    await frame.waitForTimeout(2000);

    // Step 4: Click on date in calendar
    log(`Selecting date: ${formatDateForUrl(targetDate)}...`);
    const dateSelector = `td.calendar-day_clickable[onclick*="${formatDateForUrl(targetDate)}"]`;

    const dateCell = await frame.$(dateSelector);
    if (!dateCell) {
      throw new Error(`Date ${formatDateForUrl(targetDate)} not available for booking`);
    }

    await frame.evaluate((selector) => {
      const cell = document.querySelector(selector);
      if (cell) cell.click();
    }, dateSelector);

    await frame.waitForTimeout(2000);

    // Step 5: Navigate to nested iframe and request reservation
    log('Opening reservation form...');
    const nestedFrameHandle = await frame.$('iframe');
    const nestedFrame = await nestedFrameHandle.contentFrame();

    const reserveLink = await nestedFrame.$('a[href*="new_reservation.php"]');
    if (!reserveLink) {
      throw new Error('Reservation link not found - date may be fully booked');
    }

    await nestedFrame.evaluate(() => {
      const link = document.querySelector('a[href*="new_reservation.php"]');
      if (link) link.click();
    });

    await nestedFrame.waitForTimeout(2000);

    // Step 6: Fill and submit reservation form
    log(`Selecting time slot: ${timeSlot}...`);
    const timeSlotValue = TIME_SLOT_VALUES[timeSlot];
    if (!timeSlotValue) {
      throw new Error(`Unknown time slot: ${timeSlot}`);
    }

    await nestedFrame.select('#schedule', timeSlotValue);
    await nestedFrame.type('#comments', 'Auto-reserved via GitHub Actions');

    log('Submitting reservation...');
    await nestedFrame.click('input#save_btn');
    await nestedFrame.waitForTimeout(3000);

    // Check for success/error messages
    const bodyText = await nestedFrame.evaluate(() => document.body.innerText);

    if (bodyText.includes('éxito') || bodyText.includes('confirmada') || bodyText.includes('reservada')) {
      log(`✅ SUCCESS: Reserved ${courtConfig.name} on ${targetDate.toDateString()} at ${timeSlot}`, 'SUCCESS');
      return {
        success: true,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot
      };
    } else if (bodyText.includes('error') || bodyText.includes('ocupado')) {
      throw new Error('Reservation failed - slot may already be taken');
    } else {
      log(`Reservation submitted, response: ${bodyText.substring(0, 200)}`, 'WARN');
      return {
        success: true,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot,
        note: 'Submitted but confirmation unclear'
      };
    }

  } catch (error) {
    log(`❌ FAILED: ${courtConfig.name} - ${error.message}`, 'ERROR');
    throw error;
  } finally {
    await page.close();
  }
}

// Main execution
async function main() {
  log('=== Tennis Court Reservation Script Started ===');

  const results = [];
  const errors = [];
  let browser;

  try {
    // Calculate target dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetDateCourt1, targetDateCourt2;

    if (CONFIG.testMode) {
      // Test mode: use provided date or today
      const testDate = process.env.TARGET_DATE || today.toISOString().split('T')[0];
      targetDateCourt1 = new Date(testDate);
      targetDateCourt2 = new Date(testDate);
      log(`TEST MODE: Using date ${testDate}`, 'INFO');
    } else {
      // Production mode: calculate rolling window
      targetDateCourt1 = addDays(today, CONFIG.courts.court1.daysAhead);
      targetDateCourt2 = addDays(today, CONFIG.courts.court2.daysAhead);
    }

    const dayOfWeek1 = getDayOfWeek(targetDateCourt1);
    const dayOfWeek2 = getDayOfWeek(targetDateCourt2);

    log(`Today: ${today.toDateString()}`);
    log(`Court 1 target: ${targetDateCourt1.toDateString()} (${dayOfWeek1})`);
    log(`Court 2 target: ${targetDateCourt2.toDateString()} (${dayOfWeek2})`);

    // Check if we need to make reservations
    const court1TimeSlot = CONFIG.courts.court1.slots[dayOfWeek1];
    const court2TimeSlot = CONFIG.courts.court2.slots[dayOfWeek2];

    if (!court1TimeSlot && !court2TimeSlot) {
      log('No reservations needed for these dates');
      return;
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Make reservations
    if (court1TimeSlot && (!CONFIG.testMode || process.env.TEST_COURT_1 !== 'false')) {
      try {
        const result = await makeReservation(
          browser,
          CONFIG.courts.court1,
          targetDateCourt1,
          process.env.COURT_1_TIME || court1TimeSlot
        );
        results.push(result);
      } catch (error) {
        errors.push({
          court: 'Court 1',
          error: error.message
        });
      }
    }

    if (court2TimeSlot && (!CONFIG.testMode || process.env.TEST_COURT_2 !== 'false')) {
      try {
        const result = await makeReservation(
          browser,
          CONFIG.courts.court2,
          targetDateCourt2,
          process.env.COURT_2_TIME || court2TimeSlot
        );
        results.push(result);
      } catch (error) {
        errors.push({
          court: 'Court 2',
          error: error.message
        });
      }
    }

    // Send summary email
    let emailBody = '=== Tennis Court Reservation Summary ===\n\n';

    if (results.length > 0) {
      emailBody += 'SUCCESSFUL RESERVATIONS:\n';
      results.forEach(r => {
        emailBody += `✅ ${r.court} - ${r.date} at ${r.time}\n`;
        if (r.note) emailBody += `   Note: ${r.note}\n`;
      });
      emailBody += '\n';
    }

    if (errors.length > 0) {
      emailBody += 'FAILED RESERVATIONS:\n';
      errors.forEach(e => {
        emailBody += `❌ ${e.court} - ${e.error}\n`;
      });
      emailBody += '\n';
    }

    emailBody += `\nRun time: ${new Date().toISOString()}`;
    emailBody += `\nLog file: ${logFile}`;

    const subject = results.length > 0
      ? `Reservations Confirmed (${results.length}/${results.length + errors.length})`
      : 'Reservation Failed';

    await sendEmail(subject, emailBody, errors.length === 0);

    log('=== Script Completed ===');

    if (errors.length > 0) {
      process.exit(1); // Exit with error code if any reservations failed
    }

  } catch (error) {
    log(`FATAL ERROR: ${error.message}`, 'ERROR');
    await sendEmail('Reservation Script Error', `Fatal error occurred:\n\n${error.stack}`, false);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the script
main().catch(error => {
  log(`Unhandled error: ${error.message}`, 'ERROR');
  process.exit(1);
});
