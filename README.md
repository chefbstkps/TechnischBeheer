# Technisch Beheer KPS

Webapplicatie voor het registreren van werkzaamheden voor de afdeling Technisch Beheer.

## Subafdelingen

- **Automontage** – Voertuigen en reparaties
- **Bouw** – Bouwkundige werkzaamheden
- **Electra** – Elektrische werkzaamheden
- **Koeltechniek** – Koeltechnische werkzaamheden
- **GaWaSa** – Gas, Water, Sanitair
- **Transport** – Transportwerkzaamheden

## Setup

### 1. Dependencies installeren

```bash
npm install
```

### 2. Supabase configureren

1. Maak een project aan op [supabase.com](https://supabase.com)
2. Kopieer `.env.example` naar `.env.local`
3. Vul `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in
4. Voer het SQL-script uit in de Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`

### 3. Starten

```bash
npm run dev
```

De app draait op `http://localhost:5173`.

## Build

```bash
npm run build
```

Output in `dist/`.

## Technologie

- React 18 + TypeScript
- Vite
- React Router v6
- TanStack React Query v5
- Supabase JS v2
- PWA (vite-plugin-pwa)

## Licentie

Technisch Beheer KPS 2026. Powered by: A. Levens
