# Trakvora — Production Deployment Guide

**Infrastructure:** Angani Cloud · 3 VPS instances  
**Last updated:** 2026-05-29

---

## Table of Contents

1. [Architecture](#architecture)
2. [Choose Your Deployment Option](#choose-your-deployment-option)
3. [Before You Start — Checklist](#before-you-start--checklist)
4. [Part 1 — Prepare Your Local Machine](#part-1--prepare-your-local-machine) *(all options)*
5. [Part 2 — VPS 3: Database Server (Ubuntu)](#part-2--vps-3-database-server-ubuntu-all-options) *(all options)*
6. [Part 3 — VPS 2: Backend Server](#part-3--vps-2-backend-server)
   - [Option A — Native Windows (no Docker, no WSL)](#option-a--native-windows-no-docker-no-wsl)
   - [Option B — Docker via Hyper-V (no WSL)](#option-b--docker-via-hyper-v-no-wsl)
   - [Option C — Docker via WSL2](#option-c--docker-via-wsl2)
7. [Part 4 — VPS 1: Frontend Server (all options)](#part-4--vps-1-frontend-server-all-options)
8. [Part 5 — DNS Configuration](#part-5--dns-configuration) *(all options)*
9. [Part 6 — SSL Certificate](#part-6--ssl-certificate) *(all options)*
10. [Part 7 — Final Verification](#part-7--final-verification) *(all options)*
11. [Part 8 — Service Management](#part-8--service-management-reference)
12. [Part 9 — Deploying Code Updates](#part-9--deploying-code-updates)
13. [Troubleshooting](#troubleshooting)

---

## Architecture

```
Internet
    │
    ▼
┌──────────────────────────────────┐
│  VPS 1 — Windows Server 2022     │  trakvora.com  port 80/443
│  nginx (native) + React SPA      │
│  IP: <VPS1_IP>                   │
└───────────────┬──────────────────┘
                │ reverse proxy → port 8000
                ▼
┌──────────────────────────────────┐
│  VPS 2 — Windows Server 2022     │
│  FastAPI + Redis + Celery        │
│  IP: <VPS2_IP>                   │
│                                  │
│  [Option A] Native Windows       │
│  [Option B] Docker via Hyper-V   │
│  [Option C] Docker via WSL2      │
└───────────────┬──────────────────┘
                │ PostgreSQL → port 5432
                ▼
┌──────────────────────────────────┐
│  VPS 3 — Ubuntu 24.04            │
│  PostgreSQL 15                   │
│  IP: <VPS3_IP>                   │
└──────────────────────────────────┘
```

> Replace `<VPS1_IP>`, `<VPS2_IP>`, `<VPS3_IP>` with your real Angani IPs everywhere in this guide.

---

## Choose Your Deployment Option

| | Option A — Native Windows | Option B — Hyper-V Docker | Option C — WSL2 Docker |
|--|--|--|--|
| **Docker needed** | No | Yes | Yes |
| **WSL2 needed** | No | No | Yes |
| **Requires nested virt** | No | **Yes** | No (WSL2 is a kernel feature) |
| **Feels like local dev** | Less — PowerShell commands | Yes — same docker compose | Yes — same docker compose |
| **Risk on Angani VPS** | None | Medium (check with Angani) | Low |
| **When to use** | Angani says no nested virt | Angani confirms Hyper-V | Default Docker pick |

**Not sure which to pick?** Email Angani support:
> *"Does my Windows Server 2022 VPS support nested virtualization / Hyper-V? I need it to run Docker Linux containers."*
> - If YES → use **Option B**
> - If NO → use **Option A** or **Option C** (WSL2 does not need nested virt)

---

## Before You Start — Checklist

Collect everything below before touching any server.

- [ ] Angani dashboard open — VPS public IP addresses noted
- [ ] RDP credentials for VPS 1 and VPS 2
- [ ] SSH access for VPS 3
- [ ] Domain DNS access (Cloudflare, GoDaddy, etc.)
- [ ] IntaSend **live** keys (Public Key, Secret Key, Webhook Secret)
- [ ] Resend API key (or SMTP credentials)
- [ ] Google Cloud Console access
- [ ] Strong PostgreSQL password → `openssl rand -hex 16`
- [ ] Strong SECRET_KEY → `openssl rand -hex 32`

---

## Part 1 — Prepare Your Local Machine

*(Same for all options — do this on your development machine before touching any server.)*

### 1.1 — Create env.prod

In the project root, create a file called `env.prod`. This is your live secrets file.  
**Never commit this file to git.**

```ini
# env.prod — Production environment variables
# Copy to C:\Trakvora\env.prod on VPS 2 after filling in all values.

# --- Database (points to VPS 3) ---
POSTGRES_USER=trakvora
POSTGRES_PASSWORD=<YOUR_STRONG_DB_PASSWORD>
POSTGRES_DB=trakvora
DATABASE_URL=postgresql+asyncpg://trakvora:<YOUR_STRONG_DB_PASSWORD>@<VPS3_IP>:5432/trakvora

# --- Auth ---
SECRET_KEY=<YOUR_OPENSSL_SECRET_KEY>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# --- App ---
ENVIRONMENT=production
CORS_ORIGINS=https://trakvora.com

# --- Redis (on VPS 2 — use localhost for Options A/B, localhost for Option C) ---
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=

# --- Payment: IntaSend live keys ---
INTASEND_PUBLIC_KEY=<LIVE_PUBLIC_KEY>
INTASEND_SECRET_KEY=<LIVE_SECRET_KEY>
INTASEND_WEBHOOK_SECRET=<LIVE_WEBHOOK_SECRET>
INTASEND_REDIRECT_URL=https://trakvora.com/shipper/wallet
INTASEND_WEBHOOK_URL=https://trakvora.com/api/webhooks/intasend

# --- Email ---
RESEND_API_KEY=<YOUR_RESEND_KEY>
SMTP_HOST=smtp.hmailplus.com
SMTP_PORT=587
SMTP_USERNAME=admin@trakvora.com
SMTP_PASSWORD=<YOUR_SMTP_PASSWORD>
SMTP_FROM_EMAIL=admin@trakvora.com
SMTP_TLS=true

# --- Google ---
GOOGLE_CLIENT_ID=182004975941-qltk4k024ga1dlgi8q7jsifbb89j23tn.apps.googleusercontent.com
GOOGLE_MAPS_SERVER_API_KEY=<YOUR_SERVER_MAPS_KEY>

# --- Frontend build vars ---
VITE_API_URL=https://trakvora.com/api
VITE_GOOGLE_MAPS_API_KEY=<YOUR_MAPS_KEY>
VITE_GOOGLE_CLIENT_ID=182004975941-qltk4k024ga1dlgi8q7jsifbb89j23tn.apps.googleusercontent.com

# --- Support ---
SUPPORT_WHATSAPP=+254700000000
SUPPORT_EMAIL=support@trakvora.com

# --- KRA eTIMS ---
KRA_PIN=<YOUR_KRA_PIN>
ETIMS_USERNAME=<YOUR_ETIMS_USERNAME>
ETIMS_PASSWORD=<YOUR_ETIMS_PASSWORD>
ETIMS_BRANCH_ID=00
ETIMS_SANDBOX=false

# --- Option A only (native Windows paths) ---
STATIC_DIR=C:\Trakvora\backend\static
```

### 1.2 — Build the React frontend

```bash
# In the project root
docker compose run --rm \
  -e VITE_API_URL=https://trakvora.com/api \
  -e VITE_GOOGLE_MAPS_API_KEY=<YOUR_MAPS_KEY> \
  -e VITE_GOOGLE_CLIENT_ID=182004975941-qltk4k024ga1dlgi8q7jsifbb89j23tn.apps.googleusercontent.com \
  frontend npm run build
```

Verify the build succeeded:

```bash
ls frontend/dist/
# Must show: index.html   assets/
```

### 1.3 — Update nginx config with VPS 2's IP

Open [infra/nginx/nginx.windows.conf](infra/nginx/nginx.windows.conf) and replace all 4 occurrences of `<VPS2_IP>` with VPS 2's actual IP address.

### 1.4 — Update Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Click your **OAuth 2.0 Client ID**
3. Under **Authorized JavaScript origins**, add:
   - `https://trakvora.com`
   - `https://www.trakvora.com`
4. Click **Save**

---

## Part 2 — VPS 3: Database Server (Ubuntu) *(all options)*

Connect via SSH:

```bash
ssh root@<VPS3_IP>
```

### 2.1 — Update the system

```bash
apt update && apt upgrade -y
```

### 2.2 — Install PostgreSQL 15

```bash
apt install -y curl ca-certificates
install -d /usr/share/postgresql-common/pgdg
curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'
apt update && apt install -y postgresql-15
```

Verify:

```bash
systemctl status postgresql
# Must show: active (running)
```

### 2.3 — Create the database and user

```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt:

```sql
CREATE USER trakvora WITH PASSWORD '<YOUR_STRONG_DB_PASSWORD>';
CREATE DATABASE trakvora OWNER trakvora;
GRANT ALL PRIVILEGES ON DATABASE trakvora TO trakvora;
\q
```

> Use the exact same password you put in `env.prod`.

### 2.4 — Allow VPS 2 to connect

**Edit postgresql.conf — listen on all interfaces:**

```bash
nano /etc/postgresql/15/main/postgresql.conf
```

Find `#listen_addresses = 'localhost'` and change it to:

```
listen_addresses = '*'
```

**Edit pg_hba.conf — whitelist VPS 2:**

```bash
nano /etc/postgresql/15/main/pg_hba.conf
```

Add this line at the bottom:

```
host    trakvora    trakvora    <VPS2_IP>/32    scram-sha-256
```

**Restart PostgreSQL:**

```bash
systemctl restart postgresql
```

### 2.5 — Configure the firewall

```bash
apt install -y ufw
ufw allow ssh                                        # IMPORTANT — do this first or you lock yourself out
ufw allow from <VPS2_IP> to any port 5432           # Only VPS 2 can reach PostgreSQL
ufw enable
ufw status
```

Expected output:

```
To                         Action      From
22/tcp                     ALLOW       Anywhere
5432                       ALLOW       <VPS2_IP>
```

---

## Part 3 — VPS 2: Backend Server

Connect via **RDP** to `<VPS2_IP>`.  
Open **PowerShell as Administrator** (Win + X → Windows PowerShell Admin).

---

### Option A — Native Windows (no Docker, no WSL)

*Use this when Angani says no to Hyper-V, or if you prefer not to use Docker at all.*

#### A.1 — Allow PowerShell script execution

```powershell
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine
# Press Y when prompted
```

#### A.2 — Install Chocolatey and Git

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = `
  [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
Invoke-Expression ((New-Object System.Net.WebClient).DownloadString(
  'https://community.chocolatey.org/install.ps1'))

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + `
            [System.Environment]::GetEnvironmentVariable("Path","User")

choco install git -y
```

Close and reopen PowerShell as Administrator.

#### A.3 — Clone the repository

```powershell
mkdir C:\Trakvora
cd C:\Trakvora
git clone https://github.com/<your-org>/trakvora .
```

#### A.4 — Copy env.prod to VPS 2

From your **local machine**:

```bash
scp env.prod Administrator@<VPS2_IP>:C:/Trakvora/env.prod
```

Or paste manually: open Notepad on VPS 2, paste the contents, save as `C:\Trakvora\env.prod`.

#### A.5 — Run the VPS 2 setup script

```powershell
cd C:\Trakvora
powershell -ExecutionPolicy Bypass -File infra\scripts\windows-setup-vps2.ps1
```

This automatically installs Python 3.11, Memurai (Redis), all Python packages, creates upload directories, registers `trakvora-api` and `trakvora-celery` as Windows Services via NSSM, and starts them.

#### A.6 — Run database migrations

```powershell
cd C:\Trakvora\backend

# Load env vars from env.prod into this PowerShell session
Get-Content ..\env.prod | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable(
          $Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
}

python -m alembic upgrade head
# Should print: Running upgrade ... -> ...
```

#### A.7 — Verify

```powershell
nssm status trakvora-api      # Expected: SERVICE_RUNNING
curl http://localhost:8000/health  # Expected: {"status":"ok"}
```

If the service failed, check the log:

```powershell
Get-Content C:\Trakvora\logs\backend-error.log -Tail 30
```

---

### Option B — Docker via Hyper-V (no WSL)

*Use this when Angani confirms that nested virtualization / Hyper-V is available on your Windows VPS.*

#### B.1 — Enable Hyper-V

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

The server will restart. Reconnect via RDP after 2–3 minutes.

#### B.2 — Install Docker Engine for Windows Server

```powershell
# Open PowerShell as Administrator after reboot
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
Install-Package -Name docker -ProviderName DockerMsftProvider -Force
Restart-Computer -Force
```

Reconnect via RDP again after restart.

#### B.3 — Start Docker and switch to Linux containers

```powershell
Start-Service Docker

# Verify Docker is running
docker version
# Should print: Server: Docker Engine version ...

# Switch Docker to Linux container mode (uses Hyper-V under the hood)
# Look for the SwitchDaemon shortcut in the system tray, OR:
& 'C:\Program Files\Docker\Docker\DockerCli.exe' -SwitchDaemon
```

Verify Linux containers work:

```powershell
docker run --rm hello-world
# Should print: Hello from Docker!
```

#### B.4 — Install docker-compose

```powershell
# Install Chocolatey if not already present
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = `
  [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
Invoke-Expression ((New-Object System.Net.WebClient).DownloadString(
  'https://community.chocolatey.org/install.ps1'))
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + `
            [System.Environment]::GetEnvironmentVariable("Path","User")

choco install git docker-compose -y
```

#### B.5 — Clone the repository and copy env.prod

```powershell
mkdir C:\Trakvora
cd C:\Trakvora
git clone https://github.com/<your-org>/trakvora .
```

From your **local machine**:

```bash
scp env.prod Administrator@<VPS2_IP>:C:/Trakvora/env.prod
```

#### B.6 — Open firewall port 8000

```powershell
New-NetFirewallRule -DisplayName "Trakvora FastAPI" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

#### B.7 — Build and start the backend containers

```powershell
cd C:\Trakvora
docker compose -f docker-compose.vps2.yml --env-file env.prod up -d --build
```

This starts three containers: `redis`, `backend`, `celery_worker`.

Check they are all running:

```powershell
docker compose -f docker-compose.vps2.yml ps
# All three should show: running
```

#### B.8 — Run database migrations

```powershell
docker compose -f docker-compose.vps2.yml --env-file env.prod `
  exec backend python -m alembic upgrade head
```

#### B.9 — Verify

```powershell
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

---

### Option C — Docker via WSL2

*The most familiar option — runs exactly like your local dev setup. WSL2 does not require nested virtualization.*

#### C.1 — Enable WSL2 on Windows Server 2022

```powershell
# Open PowerShell as Administrator
# Enable WSL and Virtual Machine Platform features
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart the server
Restart-Computer -Force
```

Reconnect via RDP after 2–3 minutes.

#### C.2 — Install WSL2 kernel update and Ubuntu

```powershell
# Open PowerShell as Administrator after reboot

# Set WSL default version to 2
wsl --set-default-version 2

# Install Ubuntu 24.04
wsl --install -d Ubuntu-24.04

# Wait for installation to complete — it will ask you to create a Linux username and password
# Choose a username (e.g. trakvora) and a password you'll remember
```

#### C.3 — Open the Ubuntu WSL2 shell

In PowerShell, type:

```powershell
wsl
```

You are now inside Ubuntu 24.04 running on your Windows Server. All commands from here until the end of Option C are **Linux commands typed inside this Ubuntu shell**.

#### C.4 — Install Docker inside Ubuntu (WSL2)

```bash
# Update apt
sudo apt update && sudo apt upgrade -y

# Install Docker Engine
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (replace 'trakvora' with your WSL username)
sudo usermod -aG docker $USER

# Apply the group change in this session
newgrp docker

# Verify Docker works
docker run --rm hello-world
# Should print: Hello from Docker!
```

#### C.5 — Start Docker automatically when WSL starts

```bash
# Add this to your WSL bash profile so Docker starts on every WSL session
echo 'sudo service docker start' >> ~/.bashrc
source ~/.bashrc
```

#### C.6 — Clone the repo and copy env.prod

```bash
# In the WSL Ubuntu shell
git clone https://github.com/<your-org>/trakvora ~/trakvora
cd ~/trakvora
```

Copy your `env.prod` from your local machine. From your **local machine's terminal**:

```bash
# Note: WSL2 filesystem is accessible via //wsl$/Ubuntu-24.04/home/<username>/
# Use SCP via the Windows IP:
scp env.prod Administrator@<VPS2_IP>:/mnt/c/Temp/env.prod
```

Then in the WSL shell, move it into place:

```bash
cp /mnt/c/Temp/env.prod ~/trakvora/env.prod
```

#### C.7 — Open firewall port 8000 (do this in Windows PowerShell, not WSL)

Open a **separate PowerShell tab** (not WSL) and run:

```powershell
New-NetFirewallRule -DisplayName "Trakvora FastAPI" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

Then return to your WSL shell.

#### C.8 — Build and start the backend containers

```bash
# In the WSL Ubuntu shell
cd ~/trakvora
docker compose -f docker-compose.vps2.yml --env-file env.prod up -d --build
```

Check all containers are running:

```bash
docker compose -f docker-compose.vps2.yml ps
# redis, backend, celery_worker should all show: Up
```

#### C.9 — Run database migrations

```bash
docker compose -f docker-compose.vps2.yml --env-file env.prod \
  exec backend python -m alembic upgrade head
```

#### C.10 — Make Docker containers restart automatically when Windows reboots

WSL2 does not start automatically on Windows reboot by default. Fix this:

```powershell
# In Windows PowerShell (not WSL)
# Create a scheduled task that starts WSL and your Docker containers on boot

$action = New-ScheduledTaskAction `
  -Execute "wsl.exe" `
  -Argument "-d Ubuntu-24.04 -- bash -c 'sudo service docker start && cd ~/trakvora && docker compose -f docker-compose.vps2.yml --env-file env.prod up -d'"

$trigger  = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "Trakvora WSL2 Docker" `
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
```

#### C.11 — Verify

```bash
# In WSL shell
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

---

## Part 4 — VPS 1: Frontend Server *(all options)*

Connect via **RDP** to `<VPS1_IP>`.  
Open **PowerShell as Administrator**.

### 4.1 — Allow script execution

```powershell
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine
```

### 4.2 — Install Chocolatey and Git

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = `
  [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
Invoke-Expression ((New-Object System.Net.WebClient).DownloadString(
  'https://community.chocolatey.org/install.ps1'))
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + `
            [System.Environment]::GetEnvironmentVariable("Path","User")
choco install git -y
```

Close and reopen PowerShell as Administrator.

### 4.3 — Clone the repo (for setup scripts and nginx config)

```powershell
mkdir C:\Trakvora
cd C:\Trakvora
git clone https://github.com/<your-org>/trakvora .
```

### 4.4 — Run the VPS 1 setup script

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\windows-setup-vps1.ps1
```

This installs nginx, NSSM, Certbot, registers nginx as a Windows Service, opens firewall ports 80 and 443, and schedules SSL auto-renewal.

### 4.5 — Verify the nginx config has the correct VPS 2 IP

```powershell
Select-String -Path "C:\nginx\conf\nginx.conf" -Pattern "<VPS2_IP>"
```

If this returns any results, the placeholder was not replaced. Fix it:

```powershell
(Get-Content C:\nginx\conf\nginx.conf) `
  -replace '<VPS2_IP>', '<YOUR_ACTUAL_VPS2_IP>' | `
  Set-Content C:\nginx\conf\nginx.conf
```

### 4.6 — Copy the frontend build to VPS 1

From your **local machine** (where you ran `npm run build`):

```bash
scp -r frontend/dist/* Administrator@<VPS1_IP>:C:/Trakvora/frontend/dist/
```

Verify files arrived on VPS 1:

```powershell
Get-ChildItem C:\Trakvora\frontend\dist\
# Must show: index.html   assets/
```

---

## Part 5 — DNS Configuration *(all options)*

Log in to your domain registrar / DNS provider (e.g. Cloudflare).

Add these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `trakvora.com` | `<VPS1_IP>` | Auto |
| A | `www.trakvora.com` | `<VPS1_IP>` | Auto |

> If using Cloudflare: set to **DNS only (grey cloud)** during initial setup. Enable the orange cloud (proxy) later once everything is working.

Wait for DNS to propagate (5–30 minutes), then verify:

```bash
# From your local machine
nslookup trakvora.com
# Must return: <VPS1_IP>
```

---

## Part 6 — SSL Certificate *(all options — run on VPS 1)*

DNS must be pointing to VPS 1 before this step.

### 6.1 — Stop nginx to free port 80

```powershell
nssm stop nginx
```

### 6.2 — Get the certificate

```powershell
certbot certonly --standalone -d trakvora.com -d www.trakvora.com
```

Certbot temporarily listens on port 80 for the Let's Encrypt challenge, then stores the certificate at:

```
C:\Certbot\live\trakvora.com\fullchain.pem
C:\Certbot\live\trakvora.com\privkey.pem
```

The nginx.windows.conf already points to these paths — no changes needed.

### 6.3 — Start nginx

```powershell
nssm start nginx
```

### 6.4 — Verify HTTPS

```powershell
curl https://trakvora.com
# Should return HTML starting with: <!doctype html>
```

---

## Part 7 — Final Verification *(all options)*

### 7.1 — Health check

```bash
curl https://trakvora.com/health
# Expected: {"status":"ok"}
```

### 7.2 — API reachable

```bash
curl https://trakvora.com/api/auth/
# Expected: 405 Method Not Allowed (confirms nginx is proxying correctly)
```

### 7.3 — Browser checklist

Open `https://trakvora.com` in a browser:

- [ ] Page loads — no blank screen, no certificate warning
- [ ] Google Maps renders on the load-posting page
- [ ] "Sign in with Google" button appears and works
- [ ] After login, you land on the dashboard
- [ ] Creating a test load completes without error

### 7.4 — WebSocket (real-time tracking)

Open DevTools → Network tab → filter by **WS**.  
Navigate to a shipment tracking page. You should see a connection with **Status: 101 Switching Protocols**.

### 7.5 — Webhook test

In the IntaSend dashboard, send a test webhook to `https://trakvora.com/api/webhooks/intasend`. It must return `200 OK`.

---

## Part 8 — Service Management Reference

### Option A — Native Windows

```powershell
# ── VPS 2 — Backend ───────────────────────────────────────
nssm status trakvora-api
nssm status trakvora-celery
nssm status Memurai

nssm start   trakvora-api
nssm stop    trakvora-api
nssm restart trakvora-api

# Live logs
Get-Content C:\Trakvora\logs\backend.log       -Wait -Tail 50
Get-Content C:\Trakvora\logs\backend-error.log -Wait -Tail 50
Get-Content C:\Trakvora\logs\celery.log        -Wait -Tail 50

# ── VPS 1 — nginx ─────────────────────────────────────────
nssm status  nginx
nssm start   nginx
nssm stop    nginx
nssm restart nginx
C:\nginx\nginx.exe -t        # test config before restart
```

### Options B and C — Docker

```bash
# ── VPS 2 — from WSL shell (Option C) or PowerShell (Option B) ───
cd ~/trakvora   # (Option C — WSL) or  cd C:\Trakvora  (Option B)

docker compose -f docker-compose.vps2.yml ps
docker compose -f docker-compose.vps2.yml --env-file env.prod up -d
docker compose -f docker-compose.vps2.yml down
docker compose -f docker-compose.vps2.yml restart backend
docker compose -f docker-compose.vps2.yml restart celery_worker

# Live logs
docker compose -f docker-compose.vps2.yml logs -f backend
docker compose -f docker-compose.vps2.yml logs -f celery_worker
docker compose -f docker-compose.vps2.yml logs -f redis
```

```powershell
# ── VPS 1 — nginx (same for all options) ───────────────────
nssm status  nginx
nssm start   nginx
nssm stop    nginx
nssm restart nginx
```

---

## Part 9 — Deploying Code Updates

### Backend update

**Option A (Native Windows)** — on VPS 2:

```powershell
cd C:\Trakvora
git pull origin main
cd backend
pip install -r requirements.txt        # only if dependencies changed
python -m alembic upgrade head         # only if there are new migrations
nssm restart trakvora-api
nssm restart trakvora-celery
```

**Options B & C (Docker)** — on VPS 2 (in WSL for Option C):

```bash
cd ~/trakvora           # Option C
# cd C:\Trakvora        # Option B

git pull origin main
docker compose -f docker-compose.vps2.yml --env-file env.prod up -d --build
# Migrations run automatically inside start.sh on container startup
```

### Frontend update (all options)

Run on your **local machine**, then copy to VPS 1:

```bash
# 1. Rebuild
docker compose run --rm \
  -e VITE_API_URL=https://trakvora.com/api \
  -e VITE_GOOGLE_MAPS_API_KEY=<YOUR_KEY> \
  -e VITE_GOOGLE_CLIENT_ID=182004975941-qltk4k024ga1dlgi8q7jsifbb89j23tn.apps.googleusercontent.com \
  frontend npm run build

# 2. Deploy to VPS 1 (nginx serves files directly — no restart needed)
scp -r frontend/dist/* Administrator@<VPS1_IP>:C:/Trakvora/frontend/dist/
```

---

## Troubleshooting

### nginx won't start (VPS 1)

```powershell
C:\nginx\nginx.exe -t                           # check for config syntax errors
Get-Content C:\nginx\logs\error.log -Tail 30    # read the error
netstat -ano | findstr :80                      # check if port 80 is in use
netstat -ano | findstr :443                     # check if port 443 is in use
```

Common causes:
- `<VPS2_IP>` placeholder still in `C:\nginx\conf\nginx.conf` — replace it
- SSL cert files missing — run certbot first (Part 6), then start nginx
- Port 80 or 443 already in use by IIS or another process

---

### Backend won't start (VPS 2)

**Option A:**

```powershell
Get-Content C:\Trakvora\logs\backend-error.log -Tail 50
```

**Options B & C:**

```bash
docker compose -f docker-compose.vps2.yml logs backend --tail 50
```

Common causes:
- `env.prod` missing or `DATABASE_URL` has wrong VPS 3 IP
- Alembic migrations not run — run `python -m alembic upgrade head`
- Python packages missing (Option A) — run `pip install -r requirements.txt`

---

### Cannot connect to PostgreSQL from VPS 2

```bash
# Test from VPS 2 (Option A in PowerShell, Options B/C in WSL/Docker)
psql "postgresql://trakvora:<PASSWORD>@<VPS3_IP>:5432/trakvora" -c "SELECT 1;"
```

Common causes and fixes:

| Symptom | Fix |
|---------|-----|
| `Connection refused` | VPS 3 PostgreSQL not listening on the network — check `listen_addresses = '*'` in `postgresql.conf` and restart |
| `no pg_hba.conf entry` | VPS 2's IP not added to `pg_hba.conf` on VPS 3 — add the line and restart postgresql |
| `timeout` | VPS 3 firewall blocking VPS 2 — run `ufw allow from <VPS2_IP> to any port 5432` on VPS 3 |
| `password authentication failed` | Wrong password — double-check POSTGRES_PASSWORD in `env.prod` matches the password you set in Step 2.3 |

After any change to `pg_hba.conf` or `postgresql.conf` on VPS 3, always run:

```bash
systemctl restart postgresql
```

---

### Google Sign-In returns "Error 400: redirect_uri_mismatch"

- Go to Google Cloud Console → OAuth 2.0 Client ID
- Add `https://trakvora.com` under **Authorized JavaScript origins**
- Save, then wait 5 minutes for Google to propagate the change

---

### WSL2 containers not running after Windows reboot (Option C)

```powershell
# Check if the scheduled task ran
Get-ScheduledTaskInfo -TaskName "Trakvora WSL2 Docker"

# Start it manually
Start-ScheduledTask -TaskName "Trakvora WSL2 Docker"

# Or enter WSL and start Docker manually
wsl
sudo service docker start
cd ~/trakvora
docker compose -f docker-compose.vps2.yml --env-file env.prod up -d
```

---

### Docker Linux containers fail on Windows Server (Option B)

Symptoms: `cannot start container` or `exec format error`

This means Hyper-V isolation is not working. Confirm:

```powershell
Get-WindowsFeature Hyper-V
# Must show: Installed
```

If it shows Available (not Installed), run:

```powershell
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

If Angani's VPS does not support nested virtualization, Hyper-V installation will fail silently. In that case, switch to **Option A** or **Option C**.

---

### SSL certificate expired

```powershell
# On VPS 1
certbot certificates       # check expiry date
nssm stop nginx
certbot renew
nssm start nginx
```

SSL auto-renewal is scheduled by the setup script at 02:30 AM daily — it should renew automatically before expiry.

---

## Port Reference

| Port | Server | Service | Accessible from |
|------|--------|---------|-----------------|
| 80 | VPS 1 | nginx (HTTP → HTTPS redirect) | Internet |
| 443 | VPS 1 | nginx (HTTPS) | Internet |
| 8000 | VPS 2 | FastAPI (uvicorn) | VPS 1 only |
| 6379 | VPS 2 | Redis / Memurai | VPS 2 localhost only |
| 5432 | VPS 3 | PostgreSQL | VPS 2 only |
| 22 | VPS 3 | SSH | Your IP only |
