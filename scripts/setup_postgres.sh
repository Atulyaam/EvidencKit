#!/bin/bash
set -e
set -f

echo "Cleaning previous config artifacts..."
rm -f /etc/postgresql/18/main/conf.d/listen.conf

echo "Writing listen config with proper quotes..."
mkdir -p /etc/postgresql/18/main/conf.d
cat << 'EOF' > /etc/postgresql/18/main/conf.d/listen.conf
listen_addresses = '*'
EOF

echo "Starting PostgreSQL service..."
service postgresql start

echo "Configuring postgres user password..."
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""

echo "Creating database evidencekit if not exists..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='evidencekit'\"" | grep -q 1 || su - postgres -c "psql -c \"CREATE DATABASE evidencekit;\""

echo "Configuring client authentication (pg_hba.conf)..."
sed -i '1s/^/host all all 127.0.0.1\/32 trust\nhost all all ::1\/128 trust\nhost all all all md5\n/' /etc/postgresql/18/main/pg_hba.conf

echo "Restarting PostgreSQL..."
service postgresql restart

echo "Verifying databases..."
su - postgres -c "psql -d evidencekit -c 'SELECT current_database(), current_user, version();'"
echo "PostgreSQL setup complete!"
