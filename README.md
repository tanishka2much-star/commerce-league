# Commerce League

Commerce League is a static website with open commerce learning resources and a separate CL League student area. It can be hosted on GitHub Pages or Vercel.

## Deploy on Vercel

The site is plain HTML, CSS, and browser JavaScript. It has no build step or package installation. Import this GitHub repository into Vercel and keep the project root as the Root Directory; the included `vercel.json` serves the root `index.html` as a static site. No environment variables are required.

The League profile and learning progress remain local to each visitor's browser. Vercel hosting does not add centralized accounts or synchronize student data.

## Learning and League

- **General** gives students free access to the Class 11 Journal: Accountancy, Mathematics, Business Studies, Economics (Statistics and Microeconomics), English, and Banking enrichment. Students can save subject completion marks in their browser.
- **League** provides a local student profile, learning progress, and progress backup tools. League membership, qualification, and group access are coordinated by organizers.
- Both tiers are free for students.

## Student profiles and progress

A student enters the code assigned by their organizer. The site formats it as a CL ID, and the student creates their own password. The profile and progress are stored only in the current browser on the current device. The password is stored as a salted PBKDF2 hash, not plaintext.

This is not centralized authentication. The static site cannot verify codes against an organizer roster, synchronize profiles, recover passwords, or grant group access. Students can export a JSON progress backup and import it on another device; passwords are never included. Browser data can be cleared, and local progress can be edited, so it is not verified by the League.

## Run locally

Open `index.html` in a modern browser or publish the repository with GitHub Pages or Vercel. Browser storage and cryptographic functions work on localhost or HTTPS.
