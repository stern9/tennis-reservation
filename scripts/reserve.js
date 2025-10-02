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
        'Sunday': '08:00 AM - 09:00 AM',  // TEMP: Testing tonight's run
        'Tuesday': '06:00 AM - 07:00 AM',
        'Friday': '06:00 AM - 07:00 AM',
        'Saturday': '01:00 PM - 02:00 PM'  // TEMP: Testing for Oct 11
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

    // Step 1: Login - FIXED VERSION
    log('Navigating to login page...');
    await page.goto(CONFIG.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find and fill the login form using CSS selectors
    const usernameInput = await page.$('input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');

    if (!usernameInput || !passwordInput) {
      // Fallback: try finding by looking at all inputs
      const allInputs = await page.$$('input');
      log(`Found ${allInputs.length} input fields on login page`);

      if (allInputs.length >= 2) {
        await allInputs[0].type(String(CONFIG.username));
        await allInputs[1].type(String(CONFIG.password));
      } else {
        throw new Error('Could not find login form inputs');
      }
    } else {
      await usernameInput.type(String(CONFIG.username));
      await passwordInput.type(String(CONFIG.password));
    }

    log('Credentials entered, clicking login button...');

    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button, input[type="submit"]')
    ]);

    log('Login successful');

    // Step 2: Navigate to reservations
    log('Navigating to reservations...');
    await page.evaluate(() => {
      const link = document.querySelector('a[href="pre_reservations.php"]');
      if (link) link.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for modal to open

    // Step 3: Select area in iframe
    log(`Selecting ${courtConfig.name}...`);

    // Wait for iframe to load
    await page.waitForSelector('iframe', { timeout: 10000 });

    const frames = page.frames();
    const frame = frames.find(f => f.url().includes('pre_reservations.php'));

    if (!frame) {
      throw new Error('Could not find reservations iframe');
    }

    await frame.waitForSelector('#area', { timeout: 10000 });
    await frame.select('#area', courtConfig.areaId);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await frame.waitForSelector('input#btn_cont', { timeout: 5000 });
    await frame.click('input#btn_cont');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Click on date in calendar
    log(`Selecting date: ${formatDateForUrl(targetDate)}...`);

    const calendarFrame = frames.find(f => f.url().includes('reservations.php'));
    if (!calendarFrame) {
      throw new Error('Could not find calendar iframe');
    }

    const dateSelector = `td.calendar-day_clickable[onclick*="${formatDateForUrl(targetDate)}"]`;
    await calendarFrame.waitForSelector(dateSelector, { timeout: 10000 });

    await calendarFrame.evaluate((selector) => {
      const cell = document.querySelector(selector);
      if (cell) cell.click();
    }, dateSelector);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Navigate to nested iframe and request reservation
    log('Opening reservation form...');

    // Find the nested iframe (the one inside the calendar frame)
    const allFrames = page.frames();
    let reservationFrame = null;

    // Look for frame with the reservation day view
    for (const f of allFrames) {
      const url = f.url();
      if (url.includes('reservations.php') && !url.includes('pre_reservations')) {
        const content = await f.content();
        if (content.includes('Solicitar Reserva')) {
          reservationFrame = f;
          break;
        }
      }
    }

    if (!reservationFrame) {
      // Try alternate approach - look for any frame with "Solicitar Reserva"
      for (const f of allFrames) {
        try {
          const content = await f.content();
          if (content.includes('Solicitar Reserva')) {
            reservationFrame = f;
            break;
          }
        } catch (e) {
          // Skip frames we can't access
        }
      }
    }

    if (!reservationFrame) {
      throw new Error('Could not find day view iframe');
    }

    await reservationFrame.waitForSelector('a[href*="new_reservation.php"]', { timeout: 5000 });

    await reservationFrame.evaluate(() => {
      const link = document.querySelector('a[href*="new_reservation.php"]');
      if (link) link.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Fill and submit reservation form
    log(`Selecting time slot: ${timeSlot}...`);

    // Find the form iframe
    let formFrame = null;
    for (const f of page.frames()) {
      const url = f.url();
      if (url.includes('new_reservation.php')) {
        formFrame = f;
        break;
      }
    }

    if (!formFrame) {
      throw new Error('Could not find reservation form iframe');
    }

    const timeSlotValue = TIME_SLOT_VALUES[timeSlot];
    if (!timeSlotValue) {
      throw new Error(`Unknown time slot: ${timeSlot}`);
    }

    await formFrame.waitForSelector('#schedule', { timeout: 5000 });

    // Select by visible text, not by value
    const selected = await formFrame.evaluate((targetSlot) => {
      const select = document.getElementById('schedule');
      const [startTime, endTime] = targetSlot.split(' - ');

      // Find option by text content
      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        if (option.text.includes(startTime) && option.text.includes(endTime)) {
          select.selectedIndex = i;
          // Trigger change event
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return option.text;
        }
      }
      return null;
    }, timeSlot);

    if (!selected) {
      throw new Error(`Could not find time slot: ${timeSlot}`);
    }

    log('Submitting reservation...');

    // In watch mode, keep browser open and wait before submitting
    if (process.env.WATCH_MODE === 'true') {
      log('WATCH MODE: Pausing 5 seconds before submission. Browser will stay open.');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Click the button asynchronously with setTimeout to avoid blocking
    await formFrame.evaluate(() => {
      setTimeout(() => {
        const btn = document.getElementById('save_btn');
        if (btn) {
          btn.click();
        }
      }, 0);
    });

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 4000));

    let successFound = false;

    for (const frame of page.frames()) {
      try {
        // Add timeout to prevent hanging
        const bodyText = await Promise.race([
          frame.evaluate(() => document.body.innerText),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Frame read timeout')), 2000))
        ]);

        // Check for success message
        if (bodyText.includes('se ha realizado con éxito') ||
            bodyText.includes('aprobada') ||
            (bodyText.includes('reservación') && bodyText.includes('éxito'))) {
          successFound = true;
          break;
        }

        // Check for limit exceeded error
        if (bodyText.includes('sobrepasado el limite') || bodyText.includes('límite permitido')) {
          throw new Error('Reservation limit exceeded - you have already used your allowed reservations');
        }

        // Check for slot already taken
        if (bodyText.includes('ocupado') || bodyText.includes('no disponible')) {
          throw new Error('Time slot is already taken or not available');
        }
      } catch (e) {
        // Skip frames we can't access
      }
    }

    if (successFound) {
      log(`✅ SUCCESS: Reserved ${courtConfig.name} on ${targetDate.toDateString()} at ${timeSlot}`, 'SUCCESS');
      return {
        success: true,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot
      };
    } else {
      throw new Error('Could not confirm reservation success - no success message found');
    }

  } catch (error) {
    log(`❌ FAILED: ${courtConfig.name} - ${error.message}`, 'ERROR');
    log(`Stack trace: ${error.stack}`, 'ERROR');
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
      // Parse as local date, not UTC (avoids timezone issues)
      const [year, month, day] = testDate.split('-').map(Number);
      targetDateCourt1 = new Date(year, month - 1, day);
      targetDateCourt2 = new Date(year, month - 1, day);
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
    const launchOptions = {
      headless: process.env.WATCH_MODE !== 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    // Only add headless-specific args when actually headless
    if (process.env.WATCH_MODE !== 'true') {
      launchOptions.args.push('--disable-dev-shm-usage', '--disable-gpu');
    }

    browser = await puppeteer.launch(launchOptions);

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
    log(`Stack trace: ${error.stack}`, 'ERROR');
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
