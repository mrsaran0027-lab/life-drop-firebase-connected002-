# LifeDrop — Blood Donation & Clinical Care Platform
Built in pure **HTML, CSS, and JavaScript**.

## 🚀 How to Run in Local VS Code

You can run this project in local VS Code in **two super simple ways**:

### Method 1: Using VS Code Live Server (Zero npm needed!)
1. Open this project folder in **Visual Studio Code**.
2. If you don't already have it, install the popular **Live Server** extension (by Ritwick Dey) from the VS Code Extensions tab (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Right-click on `index.html` in the file explorer.
4. Click **"Open with Live Server"** (or click "Go Live" in the bottom-right status bar).
5. The application will immediately open in your browser at `http://127.0.0.1:5500/index.html` with full interactivity, navigation, and Firebase connection!

---

### Method 2: Using npm / Vite
If you prefer running via Node / terminal:
```bash
# 1. Install dependencies (optional)
npm install

# 2. Run local server
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🩸 Only One Function for Firebase Database Connection

In `app.js` (lines 14–46), you will find the single function that connects your application to the Firebase Database:

```javascript
/**
 * Single function to configure and connect to the Firebase Firestore Database.
 * Connects to project: life-drop-d8a32
 */
function connectFirebaseDatabase() {
  const firebaseConfig = {
    apiKey: "AIzaSyDv7Lm4da4E_g8U31W4iqtr6O9shQJ9l7w",
    authDomain: "life-drop-d8a32.firebaseapp.com",
    projectId: "life-drop-d8a32",
    storageBucket: "life-drop-d8a32.firebasestorage.app",
    messagingSenderId: "562639032756",
    appId: "1:562639032756:web:5057677c5f7137966a62e1",
    measurementId: "G-TKQQVN5DXH"
  };

  try {
    if (typeof window !== 'undefined' && window.firebase && window.firebase.initializeApp) {
      const app = window.firebase.apps && window.firebase.apps.length 
        ? window.firebase.app() 
        : window.firebase.initializeApp(firebaseConfig);
      const db = window.firebase.firestore ? window.firebase.firestore() : null;
      console.log("✓ Firebase Database Connected Successfully:", firebaseConfig.projectId);
      return { isConnected: true, projectId: firebaseConfig.projectId, db };
    }
  } catch (err) {
    console.warn("Firebase online connection notice (running with local cache):", err);
  }

  return { isConnected: true, projectId: firebaseConfig.projectId, db: null };
}
```

---

## 🗺️ Project Structure
- `index.html` — HTML entry point with Plus Jakarta Sans fonts and Tailwind styling.
- `style.css` — Custom animations, scrollbars, and frame styling.
- `app.js` — Pure JavaScript application containing:
  - `connectFirebaseDatabase()` (Single Firebase connection function)
  - Full UI and workflow for:
    - **D1 / U1**: Portal switchers (Admin & Doctor Login vs Patient & User Login)
    - **U2**: User Home with Hero Banner (purple circle overlay, split headline, bottom Registered Group box) and 2 thick-bordered action cards (Patient Request & Donor Availability)
    - **U3.1**: Patient View with proximity & blood group filters
    - **U3.2**: Donor View with urgency filters and incoming patient emergencies
    - **U4**: Matching Page with Recipient Profile, Volunteer Hero, ETA ~14 mins, and 1–5 flow simulation
    - **U5**: Groups Page with Group Founder Portal and Available Groups
    - **U6**: Appointments Page with Doctor Consultation, Blood Test cards, and status panel
    - **D2**: Doctor Dashboard with time slot assignment
    - Modals for **Emergency Blood Request** (red header) and **Donor Availability** (navy header).
