# 🎓 Farewell Nickname Voting App

A real-time class farewell voting app built with **Next.js**, **Supabase**, and deployed on **Vercel**.

Students can suggest funny/creative nicknames for each other and vote for their favourites. The most-voted nickname per student is announced at the farewell event.

---

## Features

- 🌐 Public results — everyone can see nicknames and vote counts without login
- 🔐 Login required to vote or suggest — no public signup
- 🗳️ Strict one-vote-per-student rule, enforced in the database
- 🔒 Nicknames and votes are permanent — no edits or deletions allowed
- ⚡ Real-time updates via Supabase Realtime
- 📱 Fully responsive — mobile, tablet, desktop

---

## Project Structure

```
farewell-voting/
├── src/
│   ├── config/
│   │   └── students.ts          ← ADD YOUR STUDENT LIST HERE
│   ├── lib/
│   │   ├── types.ts
│   │   ├── supabase-browser.ts
│   │   └── supabase-server.ts
│   ├── app/
│   │   ├── page.tsx             (home — server component)
│   │   ├── login/page.tsx
│   │   └── api/auth/callback/
│   └── components/
│       ├── App.tsx              (main client component)
│       ├── Header.tsx
│       ├── StudentCard.tsx
│       └── Toast.tsx
├── supabase/
│   └── setup.sql                ← run this in Supabase SQL editor
├── scripts/
│   └── seed.ts                  ← creates users + generates credentials
├── .env.example
└── README.md
```

---

## Step-by-Step Setup

### 1. Add Your Student List

Open `src/config/students.ts` and replace the sample names:

```typescript
export const STUDENTS: string[] = [
  "Ali Khan",
  "Ahmed Raza",
  "Ayesha Malik",
  "Fatima Noor",
  // ... all your students
];
```

---

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — give it a name like `farewell-voting`
3. Choose a region close to your country
4. Wait ~2 minutes for the project to be ready

---

### 3. Run the Database Schema

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase/setup.sql` from this project
4. Copy the entire file content and paste it into the SQL editor
5. Click **Run** — you should see no errors

---

### 4. Get Your API Keys

In Supabase, go to **Project Settings → API**:

- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

### 5. Configure Environment Variables Locally

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> ⚠️ `.env.local` is in `.gitignore` — never commit it.

---

### 6. Install Dependencies

```bash
npm install
```

---

### 7. Run the Seed Script

This creates a Supabase user account for each student and outputs credentials:

```bash
npm run seed
```

You will see output like:
```
✓ Ali Khan          username: ali.khan           password: Ali@A3F2
✓ Ahmed Raza        username: ahmed.raza          password: Ahmed@7B1C
...
✅  Done! Credentials saved to generated-credentials.csv
```

The file `generated-credentials.csv` contains all usernames and passwords.
**Keep this file secret — do not commit it to git.**

---

### 8. Test Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- The home page shows all students publicly
- Click **Sign in to vote** and use a credential from `generated-credentials.csv`
- Try suggesting a nickname and voting

---

### 9. Deploy to Vercel

#### Option A — GitHub (Recommended)

1. Push the project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourname/farewell-voting.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub

3. Select your repository

4. **Add Environment Variables** (very important):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

5. Click **Deploy**

#### Option B — Vercel CLI

```bash
npx vercel
# Follow prompts, then add env vars in Vercel dashboard
```

---

### 10. Enable Supabase Realtime

1. In Supabase, go to **Table Editor**
2. Click on the `votes` table → **Realtime** toggle → Enable
3. Repeat for `nickname_options` table

This makes vote counts update live across all browsers.

---

### 11. Share the App

Once deployed, you'll get a URL like `https://farewell-voting.vercel.app`.

Share that URL with students, along with their personal credentials from `generated-credentials.csv`.

---

## Credentials Format

The seed script generates credentials like this:

| Student Name | Username     | Password    |
|--------------|--------------|-------------|
| Ali Khan     | ali.khan     | Ali@A3F2    |
| Ahmed Raza   | ahmed.raza   | Ahmed@7B1C  |

Students log in with their **username** (not email). The app converts it to an internal email format automatically.

---

## Voting Rules (Enforced in Database)

- A user can vote for or suggest a nickname for **multiple** students
- For **one specific student**, a user can only select **one** nickname
- A user **cannot** vote for an existing nickname AND suggest a new one for the same student
- Nicknames are permanent — no edits or deletions
- Votes are permanent — no changes
- Identical nicknames (same letters, different case/spaces) are treated as one

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is only used in the seed script — never in the browser
- Row Level Security (RLS) policies are enabled on all tables
- No public signup — all accounts are created by the seed script
- Voter identities are never publicly shown — only vote counts

---

## Limitations & Notes

| Topic | Detail |
|-------|--------|
| Free Supabase tier | 500 MB storage, 2 GB bandwidth — more than enough for a class app |
| Realtime | Enabled by default on Supabase free tier |
| Vercel free tier | Unlimited deployments, 100 GB bandwidth |
| Re-running seed | Safe to run multiple times — existing users are not duplicated |

---

## Troubleshooting

**"Missing environment variables"** — Make sure `.env.local` exists with all 3 keys.

**Seed fails with "already registered"** — That student's account already exists. The script will skip and continue.

**Login says "Invalid credentials"** — Double-check the password from `generated-credentials.csv`. Usernames are lowercase with dots.

**Vote counts not updating live** — Enable Realtime on the `votes` and `nickname_options` tables in Supabase (see step 10).

**Build error on Vercel** — Make sure all 3 env vars are added in the Vercel project settings under **Settings → Environment Variables**.
