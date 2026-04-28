# Deploying Nexus Tracker OS

This guide provides the necessary steps to deploy Nexus Tracker OS to production using **Vercel** for the frontend and **Supabase** for the database/auth.

---

## 1. Supabase (Database & Auth) Setup

Your Supabase project is the core of Nexus Tracker OS. You will need to link your local schema and push it to production.

1. Create a new project on [Supabase](https://supabase.com/).
2. Run `npx supabase login` locally and authenticate.
3. Link your project: 
   ```bash
   npx supabase link --project-ref your-project-id
   ```
4. Push your local migrations to the remote database:
   ```bash
   npx supabase db push
   ```
5. Ensure **Supabase Realtime** is enabled in your Supabase dashboard for the `page_views` and `conversions` tables if you want the `/realtime` page to work.

---

## 2. Vercel (Frontend) Deployment

Vercel provides native Next.js support and is the recommended hosting platform for Nexus Tracker OS.

1. Create a GitHub repository and push your entire codebase.
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. **CRITICAL: Set Root Directory**: In the Vercel project configuration screen, before clicking Deploy, locate the **Root Directory** setting. Change it from `./` to `dashboard`. This tells Vercel where your Next.js application lives.
5. **Environment Variables**: Open your `.env.example` file and copy the required variables into the Vercel Environment Variables section.
   
   **Required Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase API URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public anonymous key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase secret service role key (CRITICAL for bypassing RLS during workspace creation).
   - `SHOPIFY_WEBHOOK_SECRET`: A secret string used to verify incoming Shopify webhooks.
   
   *Note: Vercel automatically sets `NEXT_PUBLIC_VERCEL_URL`, so `NEXT_PUBLIC_SITE_URL` is optional unless you are using a custom domain. If you add a custom domain to Vercel, set `NEXT_PUBLIC_SITE_URL` to match it exactly (e.g., `https://tracker.minhaempresa.com`).*

6. Click **Deploy**. Vercel will build the Next.js app inside the `dashboard` folder and assign you a live URL.

---

## 3. Render/Railway (Optional: Redis Queue)

If you plan on expanding Nexus Tracker OS to use BullMQ for heavy background jobs (e.g., syncing ad spend API data offline), you will need a Redis instance. Next.js serverless functions (Vercel) cannot run persistent worker processes reliably.

1. Spin up a Redis instance on [Upstash](https://upstash.com/), Render, or Railway.
2. Copy the Redis connection string (e.g., `rediss://default:password@host:port`).
3. Add it to your `.env` or Vercel Environment variables as `REDIS_URL`.
4. If running a dedicated worker node, deploy your worker code to Render/Railway as a persistent background service (a Node script running `worker.js`).

---

## 4. Final Security Check

- **Cookies**: The production build automatically sets all auth cookies to `Secure` and `HttpOnly`.
- **Headers**: Vercel serves the app over HTTPS, and custom `Strict-Transport-Security` headers are actively enforced via `middleware.ts`.
- **Webhooks**: Check the Settings page in the deployed app to verify that the generated Shopify Webhook URL properly uses your live domain.

**Congratulations! Your Nexus Tracker OS is live and tracking.**
