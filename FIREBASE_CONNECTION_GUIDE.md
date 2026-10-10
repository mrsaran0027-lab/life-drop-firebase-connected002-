# LifeDrop — Firebase Connection Guide (patched frontend)

## Analysis of the uploaded ZIP

The project contains two frontends:
- `index.html` loads `app.js` (the active plain JavaScript frontend).
- `src/main.tsx` and `src/` contain a separate React/TypeScript implementation, but the current `index.html` does not load that React entry point.

For the current frontend, work in `index.html` and `app.js`. The HTML already loads Firebase compat SDK scripts, and `app.js` already contains the Firebase config for project `life-drop-d8a32`. However, before this patch it only initialized Firestore and returned a `db` object; it did not actually read or write the app's data to Firestore. The green badge could also appear even when no Firestore object was available.

This ZIP patches `app.js` to:
- write patient requests, donors, matches, groups and appointments to Firestore;
- write user profile data to the `users` collection;
- subscribe to Firestore updates in real time and refresh the UI;
- log useful errors instead of silently pretending that cloud writes succeeded;
- report unavailable Firebase SDK as offline mode.

## Step 1 — Open the right Firebase project
1. Visit https://console.firebase.google.com/
2. Sign in with an account that has access to the existing project `life-drop-d8a32`.
3. Open that project. If you do not have access, ask the project owner to add your Google account; do not create a new project unless you intend to change the config.

## Step 2 — Create Firestore
1. Firebase Console → Build → Firestore Database.
2. Click Create database if it doesn't exist.
3. Choose a location and finish setup.
4. The collections are created automatically after a successful first write.

Collections used:
- `users`
- `patientRequests`
- `donors`
- `matches`
- `groups`
- `appointments`

## Step 3 — Run the project
1. Extract this ZIP.
2. Open the extracted folder in VS Code.
3. Use VS Code Live Server and open `index.html`, or use the Vite server with `npm install` then `npm run dev`.
4. The active `index.html` loads `app.js`, so don't edit only `src/services/db.ts` expecting this current UI to change.

## Step 4 — Test with dummy data only
1. Open browser DevTools with F12 → Console.
2. In Firebase Console, set Firestore rules appropriate for your test.
3. Create a dummy blood request, donor, appointment, or group in the app.
4. Check Firebase Console → Firestore Database → Data and confirm a document appears.
5. Open the app in a second browser/window and check that the cloud records are reflected there.

The app still has localStorage fallback. Data showing in the UI is not proof that it reached Firebase; always verify the document in the Firebase Console and check the browser console for errors.

## Critical security limitation
The current login UI is a prototype: it creates a local user/doctor profile and does not sign in through Firebase Authentication. The patched code syncs profile records but does not make the user authenticated. Do not put real patient, donor contact, or medical information into this app until Firebase Authentication and role-based Firestore Security Rules are implemented and tested.

For a short demo only, you may use Firestore test mode with fake data if you understand that it permits broad access and expires according to Firebase's test-mode settings. Do not leave test mode or public read/write rules enabled for deployment. A production ruleset requiring `request.auth != null` will reject writes until the frontend's login flow is changed to use Firebase Authentication.

## Troubleshooting
- `permission-denied`: Firestore Rules blocked the read/write. Check the rules and whether the user is authenticated.
- No document appears: the app may only have saved to localStorage. Check F12 → Console and Firestore Data tab.
- `Firebase SDK unavailable`: verify internet access and that `index.html` loads both Firebase compat scripts.
- Wrong project: check `projectId` in `app.js` equals `life-drop-d8a32`.
- If you change Firebase projects, update `firebaseConfig` in `app.js` and verify the project has Firestore enabled.
