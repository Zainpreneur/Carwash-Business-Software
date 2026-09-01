# Cloudflare Deployment Setup Guide

## 🚀 Quick Start

### Prerequisites
- Cloudflare account (free tier available)
- GitHub account
- Node.js 18+
- PostgreSQL database (Neon, Supabase, or self-hosted)

### Step 1: Cloudflare Setup

1. **Create Cloudflare API Token**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Select template: "Edit Cloudflare Workers"
   - Grant all permissions
   - Copy the token

2. **Get Account ID**
   ```bash
   npm install -g wrangler
   wrangler whoami
   ```
   Copy your Account ID

3. **Create D1 Database** (optional, for cloud database)
   ```bash
   wrangler d1 create carwash-db
   ```
   Save the database ID

### Step 2: GitHub Secrets

Go to: Your Repo → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
```
CLOUDFLARE_API_TOKEN=<your-token-from-step-1>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
DATABASE_URL=postgresql://user:pass@host/dbname
JWT_SECRET=<random-32-char-string>
STRIPE_SECRET_KEY=<if-using-stripe>
ANTHROPIC_API_KEY=<if-using-ai>
```

### Step 3: Deploy

```bash
# Clone and setup
git clone https://github.com/Zainpreneur/Carwash-Business-Software.git
cd Carwash-Business-Software
git checkout cloudflare-deployment

# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Deploy
git push origin cloudflare-deployment
```

**GitHub Actions will automatically deploy to Cloudflare!**

## 📊 Architecture

```
Cloudflare Pages (Frontend)
        ↓ HTTPS
Cloudflare Workers (Backend API)
        ↓
PostgreSQL Database
```

## 🔗 Access Your App

- **Frontend**: `carwash-pages.pages.dev` (or custom domain)
- **API**: `carwash-api.pages.dev` (or custom domain)
- **Admin Dashboard**: Monitor at Cloudflare Dashboard

## 🛠️ Configuration Files

- `wrangler.toml` - Cloudflare Workers config
- `.github/workflows/deploy.yml` - CI/CD pipeline
- `.env.example` - Environment variables template
- `docker-compose.yml` - Local development

## 📝 Environment Variables

### Required
```
DATABASE_URL=postgresql://...
JWT_SECRET=<random-secret>
```

### Optional
```
STRIPE_SECRET_KEY=sk_live_...
ANTHROPIC_API_KEY=sk-ant-...
WHATSAPP_TOKEN=<token>
```

## 🚦 Troubleshooting

### Deploy fails
- Check GitHub Actions logs
- Verify all secrets are set
- Ensure Node dependencies install correctly

### Database connection error
- Test connection locally: `psql $DATABASE_URL`
- Update DATABASE_URL secret in GitHub
- Check firewall/security groups

### API returns 502
- Check Cloudflare Workers logs
- Verify environment variables are set
- Check database connectivity

## 📚 Next Steps

1. ✅ Deploy to Cloudflare
2. 🌐 Add custom domain
3. 🔒 Enable WAF rules
4. 📊 Set up monitoring
5. 💾 Configure backups

## 📖 Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 💬 Need Help?

Check the logs:
```bash
# View deployed workers
wrangler deployments list

# View real-time logs
wrangler tail
```
