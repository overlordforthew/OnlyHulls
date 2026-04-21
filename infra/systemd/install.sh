#!/bin/bash
# Install (or update) the boats-com-scrape systemd timer + service on Hetzner.
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Must be run as root." >&2
    exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
UNITS=(boats-com-scrape.service boats-com-scrape.timer)

for unit in "${UNITS[@]}"; do
    src="$HERE/$unit"
    if [ ! -f "$src" ]; then
        echo "missing source unit: $src" >&2
        exit 2
    fi
done

# Validate units before touching /etc.
if command -v systemd-analyze >/dev/null 2>&1; then
    systemd-analyze verify "${UNITS[@]/#/$HERE/}"
fi

for unit in "${UNITS[@]}"; do
    install -m 0644 "$HERE/$unit" "$SYSTEMD_DIR/$unit"
    echo "installed $SYSTEMD_DIR/$unit"
done

systemctl daemon-reload
systemctl enable --now boats-com-scrape.timer
systemctl list-timers boats-com-scrape.timer --no-pager
