# Commerce League API

This service is the first backend scaffold for student CL IDs and saved practice progress. It is separate from the GitHub Pages website.

## What it provides

- Create an account with a student name, class or grade, and password.
- Generate a unique CL ID and a one-time recovery code.
- Sign in with CL ID and password.
- Read the signed-in student's profile and practice attempts.
- Save practice attempts as non-official records.
- Reset a password with the one-time recovery code and issue a replacement code.

The raw password and recovery code are never stored. Passwords and recovery codes are derived with Node's scrypt; session tokens are stored only as SHA-256 hashes. Recovery codes are shown only when created or rotated. All saved quiz results have is_official=false. There is no public leaderboard endpoint.

## Requirements

- Node.js 20 or newer.
- A PostgreSQL database.
- HTTPS hosting for the API.
- A secure DATABASE_URL configured only in the backend host's secret settings.

## Local setup

1. Create an empty PostgreSQL database.
2. Run schema.sql against that database.
3. Copy .env.example values into the backend host's environment. Set DATABASE_URL, APP_ORIGIN, and PORT. For local development, set APP_ORIGIN to the exact website origin that will call the API.
4. Run npm install, then npm start.

Do not commit a real .env file, database password, or private server key. The API permits browser requests only from the exact APP_ORIGIN. Set TRUST_PROXY=true only when the chosen host sits behind a trusted reverse proxy.

## API outline

- POST /api/accounts — body: studentName, grade, password. Returns clId, token, student, and a recoveryCode to show once.
- POST /api/sessions — body: clId, password. Returns a session token.
- DELETE /api/sessions/current — requires Authorization: Bearer <token>.
- GET /api/me — requires a bearer token.
- GET /api/progress — requires a bearer token.
- POST /api/attempts — requires a bearer token; body: quizCode, score, totalQuestions. Saves a practice result marked isOfficial=false.
- POST /api/recovery/reset — body: clId, recoveryCode, newPassword. Resets the password, revokes existing sessions, and returns a replacement recovery code.

Every student-specific read or write derives the student ID from a valid server-side session. The client cannot choose a student_id for an attempt.

## Important limitation

The current website is not connected to this API. Before students can use accounts, deploy this service and its database, then connect the website's account and progress screens to the deployed API URL. Results submitted by a browser are useful for personal practice history, but are not independently verified and must not be treated as official competition scores.
