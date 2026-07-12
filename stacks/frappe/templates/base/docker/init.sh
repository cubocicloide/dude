#!/usr/bin/env bash
#
# First-boot provisioning + process runner for the local Frappe bench.
#
# Idempotent: every step checks whether its work is already done, so the
# container can be restarted freely. State lives in the `bench_home` volume
# (the bench itself) and `mariadb_data` (the database). To start over from a
# clean slate run `dude down --volumes`.
#
set -euo pipefail

BENCH_DIR=/home/frappe/frappe-bench
SITE_NAME="${SITE_NAME:?SITE_NAME must be set}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-admin}"
INSTALL_HELPDESK="${INSTALL_HELPDESK:-true}"

log() { echo "[init] $*"; }

# ── 1. Bench ──────────────────────────────────────────────────────────────────
if [ ! -d "$BENCH_DIR" ]; then
  log "Creating bench (first boot — this downloads Frappe and takes a few minutes)…"
  bench init --skip-redis-config-generation --frappe-branch version-15 "$BENCH_DIR"
fi
cd "$BENCH_DIR"

# Point the bench at the compose services (idempotent) and strip the local
# redis processes from the Procfile — redis runs as dedicated containers.
bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
sed -i '/redis/d' ./Procfile

# ── 2. Site ───────────────────────────────────────────────────────────────────
if [ ! -d "sites/$SITE_NAME" ]; then
  log "Creating site $SITE_NAME…"
  bench new-site "$SITE_NAME" \
    --mariadb-root-password "$MARIADB_ROOT_PASSWORD" \
    --admin-password "$ADMIN_PASSWORD" \
    --no-mariadb-socket
  bench --site "$SITE_NAME" set-config developer_mode 1
  bench --site "$SITE_NAME" clear-cache
  bench use "$SITE_NAME"
fi

installed_apps() { bench --site "$SITE_NAME" list-apps 2>/dev/null || true; }

# `bench get-app`/`bench new-app` do not reliably leave a trailing newline
# after the last entry of sites/apps.txt — appending to it naively then
# concatenates onto the previous line (e.g. "telephony" + "ticketing" ->
# "telephonyticketing", which frappe then fails to import as a module).
append_app_txt() {
  if [ -s sites/apps.txt ] && [ -n "$(tail -c1 sites/apps.txt)" ]; then
    echo >>sites/apps.txt
  fi
  echo "$1" >>sites/apps.txt
}

# ── 3. Frappe Helpdesk (the ticketing UI) ─────────────────────────────────────
# Helpdesk declares `required_apps = ["telephony"]` (VoIP/calling
# integration) — frappe resolves that at install time but does NOT fetch it
# for you, so it must already be present in the bench or install-app fails
# with a bare ModuleNotFoundError.
if [ "$INSTALL_HELPDESK" = "true" ]; then
  if [ ! -d apps/telephony ]; then
    log "Fetching Frappe Telephony (Helpdesk's required_apps dependency)…"
    bench get-app telephony
  fi
  if [ ! -d apps/helpdesk ]; then
    log "Fetching Frappe Helpdesk…"
    bench get-app helpdesk
  fi
  if ! installed_apps | grep -qw helpdesk; then
    log "Installing Frappe Helpdesk on $SITE_NAME…"
    bench --site "$SITE_NAME" install-app helpdesk
  fi
fi

# ── 4. Custom apps from the repo ──────────────────────────────────────────────
# Every directory under apps/ in the project repo (mounted at /workspace/apps)
# that looks like a Frappe app is linked into the bench in editable mode, so
# code changes on the host reload live inside the container.
for app_dir in /workspace/apps/*/; do
  [ -d "$app_dir" ] || continue
  app="$(basename "$app_dir")"
  [ -f "$app_dir/pyproject.toml" ] || continue
  [ -f "$app_dir/$app/hooks.py" ] || continue

  if [ ! -e "apps/$app" ]; then
    log "Linking custom app $app…"
    ln -s "/workspace/apps/$app" "apps/$app"
  fi
  grep -qx "$app" sites/apps.txt 2>/dev/null || append_app_txt "$app"
  ./env/bin/pip install --quiet -e "apps/$app"
  if ! installed_apps | grep -qw "$app"; then
    log "Installing custom app $app on $SITE_NAME…"
    bench --site "$SITE_NAME" install-app "$app"
  fi
done

# Apply pending migrations/fixtures from custom-app changes on every boot.
bench --site "$SITE_NAME" migrate

# ── 5. Run ────────────────────────────────────────────────────────────────────
log "Starting bench (web :8000, socketio :9000)…"
exec bench start
