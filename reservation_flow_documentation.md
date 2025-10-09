# Parques del Sol Reservation System - Complete Navigation Flow

## Overview
This document provides a complete **technical reference** for the website structure and navigation flow at https://parquesdelsol.sasweb.net/

**Purpose:**
- Reference for understanding the website's iframe structure
- Selector documentation for automation
- Navigation flow for debugging

**Note:** Screenshots referenced in this document were captured during initial development and are not included in the repository. The selectors and structure documented here are still accurate as of October 2025.

---

## 1. Login Page

**URL:** `https://parquesdelsol.sasweb.net/`

### Form Fields:
- **Casa (House Number):**
  - Type: `textbox`
  - No ID/Name visible in accessibility tree
  - Position: First textbox on page

- **Contraseña (Password):**
  - Type: `textbox`
  - No ID/Name visible in accessibility tree
  - Position: Second textbox on page

- **Submit Button:**
  - Type: `button`
  - Text: "Ingresar"

### Interaction Sequence:
1. Fill first textbox with house number (e.g., "1Ji")
2. Fill second textbox with password (e.g., "12345")
3. Click "Ingresar" button

**Screenshot:** `step1_login_page.png`

---

## 2. Main Dashboard

**URL:** `https://www.sasweb.net/sas/?w=44290086`

### Navigation to Reservations:
- **Element:** Link with text "Reservaciones"
- **Selector:** `a[href="pre_reservations.php"]`
- **Relation attribute:** `rel="shadowbox;height=350;width=700"`
- **Note:** Opens in a Shadowbox modal/iframe

### Interaction Sequence:
1. Locate link containing "Reservaciones" text
2. Click the link to open reservation modal

**Screenshot:** `step2_main_dashboard.png`

---

## 3. Pre-Reservation Modal (Area Selection)

**URL (within iframe):** `pre_reservations.php`

### Form Fields:

#### Area Selection Dropdown:
- **ID:** `area`
- **Name:** `area`
- **Type:** `select` (dropdown)
- **onchange:** `display_conditions(this.value)`

**Available Options:**
| Value | Display Text |
|-------|--------------|
| "" | -- Seleccionar -- |
| "5" | Cancha de Tenis 1 |
| "7" | Cancha de Tenis 2 |
| "17" | MALINCHES Cancha Basquet |
| "16" | MALINCHES Cancha Futbol |
| "15" | MALINCHES PlayGround |
| "25" | My Spot 1 |
| "26" | My Spot 2 |
| "27" | My Spot 3 |
| "28" | My Spot 4 |
| "20" | Rancho 1 Con Parrilla |
| "12" | Rancho 2 |
| "21" | Rancho 3 Con Parrilla |
| "14" | Rancho 4 |
| "22" | Salón Principal |
| "29" | Terraza Adyacente |

#### Continue Button:
- **Type:** `submit`
- **Class:** `btn2`
- **ID:** `btn_cont`
- **Value:** "Aceptar y Continuar"
- **onclick:** `gotoarea()`
- **Note:** Hidden by default, shown when area is selected

### Dynamic Behavior:
When an area is selected, the page:
1. Hides all area condition divs (`.areaspace`)
2. Shows the selected area's conditions div (`#area_{id}`)
3. Shows the continue button (`#btn_cont`)

### JavaScript Function:
```javascript
function gotoarea(){
  var area = document.getElementById("area").value;
  if(area == ""){
    alert("Seleccione el área que desea reservar");
  }else{
    location.href = "reservations.php?area="+area;
  }
}
```

### Interaction Sequence:
1. Wait for iframe to load
2. Select area from dropdown (e.g., value "5" for Cancha de Tenis 1)
3. Wait for conditions to display
4. Click "Aceptar y Continuar" button
5. Navigates to: `reservations.php?area={area_id}`

**Screenshots:**
- `step3_reservation_modal.png`
- `step4_area_selected_conditions.png`

---

## 4. Calendar View (Date Selection)

**URL (within iframe):** `reservations.php?area={area_id}`

### Structure:
- Displays monthly calendar
- Shows current month/year with navigation arrows
- Date cells are clickable via onclick handlers

### Calendar Navigation:
- **Previous Month:** `<a href="reservations.php?month={prev}&year={year}&area={area_id}"><<</a>`
- **Next Month:** `<a href="reservations.php?month={next}&year={year}&area={area_id}">>></a>`

### Date Selection:
- **Class:** `calendar-day_clickable`
- **onclick:** `f_change_reservation_day('YYYY-MM-D','area_id')`
- **Format:** Date cells with onclick attribute containing the date string

### Nested Iframe:
After selecting a date, a nested iframe loads showing available time slots for that day.

### Interaction Sequence:
1. Locate calendar within iframe
2. Click on desired date cell (e.g., `onclick="f_change_reservation_day('2025-10-3','5')"`)
3. Wait for nested iframe to load with time slot information

**Screenshot:** `step5_reservation_calendar.png`

---

## 5. Time Slot View (Nested Iframe)

**Structure:** Nested iframe within the calendar iframe

### Display:
Shows selected date and available/reserved time slots:
- **Reserved slots:** Displayed as text (e.g., "Reservado de 06:00 AM a 07:00 AM")
- **New reservation link:** `<a href="new_reservation.php?day=YYYY-MM-D&area={area_id}">+ Solicitar Reserva</a>`

### Interaction Sequence:
1. Locate nested iframe within calendar iframe
2. Click "+ Solicitar Reserva" link
3. Loads reservation form: `new_reservation.php?day={date}&area={area_id}`

**Screenshot:** `step6_date_selected_timeslots.png`

---

## 6. Reservation Form (Final Step)

**URL (within nested iframe):** `new_reservation.php?day={date}&area={area_id}`

### Form Details:
- **Action:** `../utilities/process/actions/add_reservation.php`
- **Method:** `POST`
- **onsubmit:** `return pre_validate(validations)`

### Hidden Fields:
```html
<input type="hidden" value="5" name="area" id="area">
<input type="hidden" value="2025-10-3" name="day" id="day">
```

### Form Fields:

#### Time Slot Selection:
- **ID:** `schedule`
- **Name:** `schedule`
- **Type:** `select` (dropdown)

**Time Slot Options (for Tennis Court example):**
| Value | Display Text |
|-------|--------------|
| "" | - |
| "243" | De 06:00 AM a 07:00 AM |
| "250" | De 07:00 AM a 08:00 AM |
| "257" | De 08:00 AM a 09:00 AM |
| "264" | De 09:00 AM a 10:00 AM |
| "271" | De 10:00 AM a 11:00 AM |
| "278" | De 11:00 AM a 12:00 PM |
| "285" | De 12:00 PM a 01:00 PM |
| "292" | De 01:00 PM a 02:00 PM |
| "299" | De 02:00 PM a 03:00 PM |
| "306" | De 03:00 PM a 04:00 PM |
| "313" | De 04:00 PM a 05:00 PM |
| "320" | De 05:00 PM a 06:00 PM |
| "327" | De 06:00 PM a 07:00 PM |

**Note:** Values appear to be database IDs and may vary by area and date.

#### Comments Field:
- **ID:** `comments`
- **Name:** `comments`
- **Type:** `text`
- **Class:** `form_input`
- **Size:** `35`
- **Required:** Optional

#### Submit Button:
- **ID:** `save_btn`
- **Type:** `submit`
- **Class:** `btn2`
- **Value:** "Guardar"

#### Loading Button (hidden):
- **ID:** `loading_btn`
- **Type:** `button`
- **Style:** `display:none;`
- **Value:** "Cargando..."

### Validation:
JavaScript validation array checks:
```javascript
validations.push({id:"schedule", type:"null", msg:"Seleccione el Horario"});
validations.push({id:"from_hour", type:"null", msg:"Seleccione la hora"});
validations.push({id:"from_minutes", type:"null", msg:"Seleccione los minutos"});
validations.push({id:"from_zone", type:"null", msg:"Seleccione mañana o tarde"});
validations.push({id:"time", type:"null", msg:"Seleccione la cantidad de horas"});
```

### Interaction Sequence:
1. Select time slot from dropdown (e.g., value "271" for 10:00 AM - 11:00 AM)
2. Optionally enter comments in text field
3. Click "Guardar" button
4. Form submits to `add_reservation.php`

**Screenshot:** `step7_reservation_form.png`

---

## Complete Flow Summary

### Step-by-Step Automation Guide:

1. **Login**
   - Navigate to `https://parquesdelsol.sasweb.net/`
   - Fill casa number and password
   - Click "Ingresar"

2. **Navigate to Reservations**
   - Wait for dashboard to load
   - Click link with `href="pre_reservations.php"`
   - Wait for modal/iframe to open

3. **Select Area**
   - Switch to iframe context
   - Select area from dropdown `#area`
   - Click submit button `#btn_cont`

4. **Select Date**
   - Wait for calendar to load in iframe
   - Click on date cell with desired date onclick handler
   - Wait for nested iframe to load

5. **Request Reservation**
   - Switch to nested iframe context
   - Click link with text "+ Solicitar Reserva"
   - Wait for form to load

6. **Complete Reservation**
   - Still in nested iframe context
   - Select time slot from `#schedule` dropdown
   - Fill optional comments in `#comments`
   - Click "Guardar" button
   - Handle success/error response

---

## Important Notes for Automation

### Iframe Handling:
- The site uses **nested iframes** (iframe within iframe)
- Must switch context appropriately:
  1. Main page → Dashboard
  2. First iframe → Area selection & Calendar
  3. Nested iframe → Time slots & Reservation form

### Dynamic Content:
- Calendar dates are generated dynamically via onclick handlers
- Time slot values vary by area and date
- Conditions/rules display based on selected area

### Shadowbox Modal:
- Site uses Shadowbox library for modals
- Links have `rel="shadowbox;height=X;width=Y"` attribute
- Content loads in iframe within modal

### Session Management:
- Login creates session cookie
- All subsequent requests require valid session
- Dashboard URL includes session parameter: `?w=44290086`

### Key Selectors for Automation:
```
Login Page:
- Casa input: First textbox
- Password input: Second textbox
- Submit: button with text "Ingresar"

Dashboard:
- Reservations link: a[href="pre_reservations.php"]

Pre-Reservation Modal (iframe):
- Area dropdown: select#area
- Continue button: input#btn_cont

Calendar (iframe):
- Date cells: td.calendar-day_clickable[onclick*="f_change_reservation_day"]
- Month navigation: a[href*="month="]

Time Slots (nested iframe):
- New reservation link: a[href*="new_reservation.php"]

Reservation Form (nested iframe):
- Schedule dropdown: select#schedule
- Comments field: input#comments
- Submit button: input#save_btn
```

---

## Screenshots Reference
1. `step1_login_page.png` - Initial login screen
2. `step2_main_dashboard.png` - Main dashboard with menu options
3. `step3_reservation_modal.png` - Area selection modal (initial)
4. `step4_area_selected_conditions.png` - Area conditions displayed
5. `step5_reservation_calendar.png` - Calendar view for date selection
6. `step6_date_selected_timeslots.png` - Available time slots for selected date
7. `step7_reservation_form.png` - Final reservation form
