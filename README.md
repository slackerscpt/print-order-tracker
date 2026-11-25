# Print Order Queue (Docker)

## Run it
    docker compose up -d --build
Open http://localhost:3000 (from another device on your network: http://<this-computer's-IP>:3000).

## Stop / start
    docker compose down      # stop and remove the container. Orders are kept.
    docker compose up -d     # start again. Everything is still there.

Orders live in the named volume `print-orders-data`, so they survive `down`, `up`, rebuilds and reboots.
**Do not** run `docker compose down -v` — the `-v` flag deletes the volume and all orders.

## Back up / restore
    docker run --rm -v print-orders-data:/data -v "$PWD":/backup alpine cp /data/orders.json /backup/orders-backup.json
    docker run --rm -v print-orders-data:/data -v "$PWD":/backup alpine cp /backup/orders-backup.json /data/orders.json

## Notes
- No login: anyone who can reach the port can edit orders. Keep it on your home network.
- Two browsers/devices stay in sync (the page refreshes every 5 seconds).
