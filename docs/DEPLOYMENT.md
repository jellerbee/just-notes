# Deployment Guide - Render.com

This guide covers deploying jnotes to Render.com using the infrastructure-as-code blueprint (`render.yaml`).

## Prerequisites

1. **Render Account** - Sign up at [render.com](https://render.com)
2. **GitHub Repository** - Code must be in a GitHub repository
3. **PostgreSQL Database** - Already exists as `lifetrails-db` on Render

## Deployment Architecture

**Services:**
- **Backend API** (`jnotes-api`) - Node.js web service (Express + Prisma)
- **Frontend** (`jnotes-frontend`) - Static site (React + Vite)
- **Database** (`lifetrails-db`) - PostgreSQL (existing instance)

## Step 1: Deploy Using Render Blueprint

### Option A: Deploy from Render Dashboard

1. Go to Render Dashboard → New → Blueprint
2. Connect your GitHub repository
3. Select the `render.yaml` file
4. Review the services to be created:
   - `jnotes-api` (web service)
   - `jnotes-frontend` (static site)
5. Click "Apply" to deploy

### Option B: Deploy via Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login to Render
render login

# Deploy blueprint
render blueprint apply
```

## Step 2: Configure Environment Variables

The blueprint auto-configures most variables, but you may need to set:

### Backend (`jnotes-api`)
- `NODE_ENV` → `production` (auto-set)
- `DATABASE_URL` → Connected to `lifetrails-db` (auto-set)
- `JWT_SECRET` → Auto-generated secure value
- `CORS_ORIGIN` → Set to your frontend URL (e.g., `https://jnotes-frontend.onrender.com`)

### Frontend (`jnotes-frontend`)
- `VITE_API_URL` → Set to backend URL (e.g., `https://jnotes-api.onrender.com`)

**To update environment variables:**
1. Go to Service → Environment
2. Add/edit variables
3. Save changes (triggers auto-deploy)

## Step 3: Run Database Migrations

After backend deployment, run migrations:

```bash
# Via Render Shell (Dashboard → jnotes-api → Shell)
cd backend && npm run prisma:migrate:deploy

# Or via local terminal with DATABASE_URL
cd backend
DATABASE_URL="your-production-db-url" npm run prisma:migrate:deploy
```

## Step 4: Verify Deployment

1. **Check Backend Health**
   ```bash
   curl https://jnotes-api.onrender.com/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. **Check Frontend**
   - Visit `https://jnotes-frontend.onrender.com`
   - Should load the app and auto-authenticate in dev mode

3. **Test API Integration**
   - Create a bullet in the frontend
   - Verify it persists (reload page)
   - Check search, backlinks, and tasks features

## Authentication Notes

**Current Implementation:**
- **Development Mode** - Auto-authenticates with demo user (no login required)
- **Production Mode** - Requires JWT token (set `NODE_ENV=production`)

To enable production auth:
1. Set `NODE_ENV=production` on backend
2. Implement login UI in frontend
3. Call `/auth/demo` or `/auth/login` to get token

## Database Management

**Existing Database:** `lifetrails-db` (PostgreSQL on Render)

**Connection String:**
- Available in Render Dashboard → Database → Connection String
- Format: `postgresql://user:pass@host:5432/dbname`

**Run Migrations:**
```bash
cd backend
npm run prisma:migrate:deploy  # Production migrations (no prompts)
npm run prisma:generate        # Regenerate Prisma client
```

**View Data:**
```bash
# Via Render Shell
cd backend
npx prisma studio  # Opens GUI at localhost:5555
```

## Continuous Deployment

**Auto-Deploy Enabled:**
- Push to `main` branch → Auto-deploys to Render
- Uses `autoDeploy: true` in `render.yaml`

**Manual Deploy:**
- Render Dashboard → Service → Manual Deploy

## Troubleshooting

### Backend Errors

**Check Logs:**
```bash
# Via Dashboard
Render Dashboard → jnotes-api → Logs

# Via CLI
render logs jnotes-api
```

**Common Issues:**
- `DATABASE_URL not set` → Verify database connection in env vars
- `CORS errors` → Update `CORS_ORIGIN` to match frontend URL
- `Build failed` → Check `node_modules` and `package-lock.json`

### Frontend Errors

**Check Build Logs:**
- Render Dashboard → jnotes-frontend → Logs

**Common Issues:**
- `VITE_API_URL not set` → Add env var in dashboard
- `API 404 errors` → Verify backend URL is correct
- `Static routes not working` → Check `routes` in render.yaml (should rewrite to `/index.html`)

### Database Issues

**Connection Failed:**
- Verify `lifetrails-db` is running (Dashboard → Database)
- Check connection string format
- Ensure IP allowlist includes Render IPs (should be automatic)

**Migration Errors:**
- Check Prisma schema syntax
- Verify migrations exist in `prisma/migrations/`
- Run `npm run prisma:generate` after schema changes

## Performance Optimization

**Backend:**
- Use `starter` plan (includes auto-scaling)
- Enable health checks (already configured)
- Monitor with Render metrics

**Frontend:**
- Aggressive caching (configured in `render.yaml`):
  - `/` → `no-cache` (always fresh)
  - `/assets/*` → `max-age=31536000` (1 year, immutable)
- Consider CDN for assets

**Database:**
- Use connection pooling (Prisma default)
- Add indexes for search queries (already configured)
- Monitor query performance with Render insights

## Rollback

**To Previous Deploy:**
1. Render Dashboard → Service → Deploys
2. Find working deploy → Redeploy

**To Tagged Version:**
```bash
git checkout v0.4-bug-fixes-complete
git push origin main --force  # ⚠️ Use with caution
```

## Next Steps

After deployment:
1. Test all features (bullets, search, backlinks, tasks)
2. Run load testing with realistic data
3. Implement proper authentication (email/password)
4. Set up monitoring and alerting
5. Configure custom domain (optional)

## Cost Estimate (Render Starter Plan)

- **Backend** - $7/month
- **Frontend** - Free (static site)
- **Database** - $7/month (already provisioned)
- **Total** - ~$14/month

## Support

- **Render Docs** - https://render.com/docs
- **Render Community** - https://community.render.com
- **Project Issues** - See `docs/jnotes_issues_list.txt`
