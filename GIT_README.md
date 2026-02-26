# Hosting op Vercel via GitHub

Stappen om dit project via GitHub op Vercel te hosten.

---

## Stap 1: Git en GitHub voorbereiden

### 1a. `.gitignore` controleren

Zorg dat je `.gitignore` bevat:
```
node_modules
dist
.env
.env.local
.env.*.local
```

### 1b. Git initialiseren en eerste commit

```powershell
cd c:\Users\User\OneDrive\myapps\tb
git init
git add .
git commit -m "Initial commit"
```

### 1c. GitHub-repository aanmaken

- Ga naar [github.com](https://github.com) → New repository
- Naam bijvoorbeeld: `technisch-beheer`
- Kies Public of Private
- Voeg geen README, .gitignore of license toe (die heb je al lokaal)

### 1d. Koppelen en pushen

```powershell
git remote add origin https://github.com/JOUW_USERNAME/technisch-beheer.git
git branch -M main
git push -u origin main
```

---

## Stap 2: Project op Vercel importeren

1. Ga naar [vercel.com](https://vercel.com) en log in (bijvoorbeeld met GitHub)
2. Klik op **Add New** → **Project**
3. Selecteer je GitHub-repository (`technisch-beheer`)
4. Vercel herkent het project automatisch als Vite. De standaardinstellingen zijn meestal correct:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

---

## Stap 3: Environment variables instellen

Omdat dit project Supabase gebruikt, moet je in Vercel de volgende variabelen instellen:

1. Ga in je Vercel-project naar **Settings** → **Environment Variables**
2. Voeg toe:
   - `VITE_SUPABASE_URL` = je Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = je Supabase anon/public key

Deze vind je in het Supabase-dashboard onder **Project Settings** → **API**.

---

## Stap 4: Deployen

1. Klik op **Deploy**
2. Na de build krijg je een live URL (bijvoorbeeld `technisch-beheer.vercel.app`)

---

## Optioneel: automatische deploys

Na de eerste setup:
- Elke push naar `main` triggert automatisch een nieuwe deploy
- Pull requests krijgen een preview-URL

---

## Supabase CORS (als je API-errors krijgt)

Als je CORS-fouten ziet na deployment, voeg in Supabase onder **Project Settings** → **API** je Vercel-URL toe aan de toegestane origins (bijvoorbeeld `https://jouw-project.vercel.app`).
