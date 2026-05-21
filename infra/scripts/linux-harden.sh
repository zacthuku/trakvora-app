#!/usr/bin/env bash
# Linux server hardening — run once as root on Ubuntu 22.04.
# Tested for: DB server and backend server roles.
# Usage: sudo ./linux-harden.sh [db|backend]
#
# Set SSH_PUBKEY env var to the admin public key before running.

set -euo pipefail

ROLE="${1:-backend}"
SSH_PUBKEY="${SSH_PUBKEY:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo $0)"
  exit 1
fi

echo "=== Hardening Ubuntu 22.04 (role: ${ROLE}) ==="

# -- System updates --
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades apt-listchanges

# -- Unattended security updates --
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# -- SSH hardening --
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config
echo "AllowAgentForwarding no" >> /etc/ssh/sshd_config

# Add admin SSH key if provided
if [[ -n "${SSH_PUBKEY}" ]]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  echo "${SSH_PUBKEY}" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
fi

systemctl reload sshd

# -- UFW firewall --
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"

if [[ "${ROLE}" == "backend" ]]; then
  ufw allow 8000/tcp comment "FastAPI"
  ufw allow 80/tcp comment "HTTP"
  ufw allow 443/tcp comment "HTTPS"
fi

if [[ "${ROLE}" == "db" ]]; then
  # PostgreSQL only accessible from backend server — set BACKEND_IP env var
  BACKEND_IP="${BACKEND_IP:-}"
  if [[ -n "${BACKEND_IP}" ]]; then
    ufw allow from "${BACKEND_IP}" to any port 5432 comment "PostgreSQL from backend"
  else
    echo "WARNING: BACKEND_IP not set. PostgreSQL port not opened. Set it and rerun."
  fi
fi

ufw --force enable
echo "UFW status:"
ufw status verbose

# -- fail2ban --
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled  = true
port     = ssh
logpath  = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# -- Disable unused services --
for svc in avahi-daemon cups bluetooth; do
  systemctl disable --now "${svc}" 2>/dev/null || true
done

# -- sysctl hardening --
cat >> /etc/sysctl.d/99-trakvora.conf <<'EOF'
net.ipv4.ip_forward = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.disable_ipv6 = 1
kernel.dmesg_restrict = 1
EOF
sysctl -p /etc/sysctl.d/99-trakvora.conf

echo "=== Hardening complete. Reboot recommended. ==="
