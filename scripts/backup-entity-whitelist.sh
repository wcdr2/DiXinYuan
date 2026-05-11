#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="datasets/config/backups"
mkdir -p "$BACKUP_DIR"
cp datasets/config/entity-whitelist.json "$BACKUP_DIR/entity-whitelist_$TIMESTAMP.json"
echo "Backup created: $BACKUP_DIR/entity-whitelist_$TIMESTAMP.json"
