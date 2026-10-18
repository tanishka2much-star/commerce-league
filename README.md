# Commerce League

Commerce League is a static GitHub Pages site with open commerce learning resources and a separate CL League student area.

## General and League

- **General** contains open foundations in accounting, economics, and business. Students can mark subjects complete.
- **League** provides a local student profile, learning progress, and progress backup tools. League membership, qualification, and group access are coordinated by organizers.

## Student profiles and progress

A student enters the code assigned by their organizer. The site formats it as a CL ID, and the student creates their own password. The profile and progress are stored only in the current browser on the current device. The password is stored as a salted PBKDF2 hash, not plaintext.

This is not centralized authentication. The static site cannot verify codes against an organizer roster, synchronize profiles, recover passwords, or grant group access. Students can export a JSON progress backup and import it on another device; passwords are never included. Browser data can be cleared, and local progress can be edited, so it is not verified by the League.

## Run locally

Open `index.html` in a modern browser or publish the repository with GitHub Pages. Browser storage and cryptographic functions work on localhost or HTTPS.

