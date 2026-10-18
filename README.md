# Commerce League

Commerce League is a static GitHub Pages learning and practice prototype.

## Tiers

- **Tier 1 — Open learning and practice:** commerce foundation topics and a five-question practice round open to everyone.
- **Tier 2 — CL League:** a suggested practice checkpoint, local progress tools, and guidance to contact a League organizer for qualification, continuing participation, and group access.

## Local progress and identity

Completed practice rounds and a local CL League profile are stored in the current browser's `localStorage`. After meeting the suggested practice checkpoint, a student enters the student code assigned by their organizer; the site formats it as their CL ID. Each student creates a password. The site stores only a salted PBKDF2 password hash, never the password itself. Students can export progress and import it on another device; password setup is not included in the backup, so they create the local profile again on that device.

This is a browser-only convenience check, not secure authentication. It cannot verify the code against an organizer's roster, protect against someone with technical access to the browser, confirm official qualification, provide group access, or synchronize accounts. Browser data can be cleared, imported progress files can be edited, and scores are not verified or tamper-proof. Names, grades, and email addresses are not included in saved progress. Organizers must manage membership and group access separately. Shared accounts and cross-device sign-in require a backend service.

## Run locally

Open `index.html` in a modern browser or publish the repository with GitHub Pages. Browser storage and cryptographic ID generation work on localhost or HTTPS.

