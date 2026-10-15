#!/usr/bin/env bash
# Same mkdir/token protocol as site-publish-lock.mjs. Source from a Bash caller.
netcar_site_lock_acquire() {
  local root="$1" wait_seconds="${2:-0}" started="$SECONDS"
  NETCAR_SITE_LOCK_DIR="$root/.devops/site-publish.lock"
  mkdir -p "$root/.devops"
  if [ -n "${NETCAR_SITE_LOCK_TOKEN:-}" ]; then
    [ -r "$NETCAR_SITE_LOCK_DIR/token" ] &&
      [ "$(cat "$NETCAR_SITE_LOCK_DIR/token")" = "$NETCAR_SITE_LOCK_TOKEN" ] || return 75
    NETCAR_SITE_LOCK_OWNED=0
    return 0
  fi
  while ! (umask 077; mkdir "$NETCAR_SITE_LOCK_DIR") 2>/dev/null; do
    if [ "$((SECONDS - started))" -ge "$wait_seconds" ]; then
      echo "NETCAR_SITE_PUBLISH_BUSY" >&2
      return 75
    fi
    sleep 2
  done
  NETCAR_SITE_LOCK_TOKEN="$(cat /proc/sys/kernel/random/uuid)"
  (umask 077; printf '%s\n' "$NETCAR_SITE_LOCK_TOKEN" > "$NETCAR_SITE_LOCK_DIR/token")
  export NETCAR_SITE_LOCK_TOKEN
  NETCAR_SITE_LOCK_OWNED=1
}

netcar_site_lock_release() {
  if [ "${NETCAR_SITE_LOCK_OWNED:-0}" = 1 ] &&
    [ -r "$NETCAR_SITE_LOCK_DIR/token" ] &&
    [ "$(cat "$NETCAR_SITE_LOCK_DIR/token")" = "${NETCAR_SITE_LOCK_TOKEN:-}" ]; then
    rm "$NETCAR_SITE_LOCK_DIR/token"
    rmdir "$NETCAR_SITE_LOCK_DIR"
    unset NETCAR_SITE_LOCK_TOKEN
  fi
  NETCAR_SITE_LOCK_OWNED=0
}
