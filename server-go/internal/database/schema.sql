CREATE TABLE IF NOT EXISTS outlets (
    id VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(128) NOT NULL,
    alamat TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(32) NOT NULL,
    outlet_id VARCHAR(64) REFERENCES outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_sessions (
    id VARCHAR(64) PRIMARY KEY,
    outlet_id VARCHAR(64) NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    queue_no INT DEFAULT 0,
    nama VARCHAR(128),
    items JSONB DEFAULT '[]',
    start_time BIGINT,
    tanggal VARCHAR(32),
    pay_awal VARCHAR(32) DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    outlet_id VARCHAR(64) NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    no INT NOT NULL,
    queue_no INT DEFAULT 0,
    nama VARCHAR(128),
    tanggal VARCHAR(32),
    start_time BIGINT,
    end_time BIGINT,
    items TEXT,
    ot VARCHAR(32) DEFAULT '-',
    ot_dur VARCHAR(32) DEFAULT '-',
    total_base NUMERIC(12, 2) DEFAULT 0,
    total_ot NUMERIC(12, 2) DEFAULT 0,
    total_tol NUMERIC(12, 2) DEFAULT 0,
    grand_total NUMERIC(12, 2) DEFAULT 0,
    total_all NUMERIC(12, 2) DEFAULT 0,
    pay_awal VARCHAR(32) DEFAULT 'cash',
    cash NUMERIC(12, 2) DEFAULT 0,
    qris NUMERIC(12, 2) DEFAULT 0,
    shift VARCHAR(64) DEFAULT '-',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) NOT NULL,
    outlet_id VARCHAR(64) DEFAULT 'global',
    value TEXT,
    PRIMARY KEY (key, outlet_id)
);

CREATE TABLE IF NOT EXISTS deletion_logs (
    id SERIAL PRIMARY KEY,
    outlet_id VARCHAR(64) REFERENCES outlets(id) ON DELETE SET NULL,
    txn_id VARCHAR(64),
    txn_no INT,
    txn_nama VARCHAR(128),
    txn_tanggal VARCHAR(32),
    txn_total_all NUMERIC(12, 2) DEFAULT 0,
    deleted_at BIGINT,
    deleted_by VARCHAR(64) DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(128) PRIMARY KEY,
    username VARCHAR(64),
    role VARCHAR(32),
    outlet_id VARCHAR(64),
    expires_at BIGINT,
    ttl_ms BIGINT
);

CREATE SEQUENCE IF NOT EXISTS txn_no_seq;

CREATE INDEX IF NOT EXISTS idx_active_sessions_outlet ON active_sessions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_tanggal ON transactions(outlet_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens(expires_at);

-- Default Outlets Seed
INSERT INTO outlets (id, nama, alamat) VALUES 
    ('outlet-1', 'Outlet Pusat', 'Jl. Utama No. 1'),
    ('outlet-2', 'Outlet Cabang 2', 'Jl. Cabang No. 2')
ON CONFLICT (id) DO NOTHING;

-- Default Settings Seed
INSERT INTO settings (key, outlet_id, value) VALUES
    ('admin_pass', 'global', 'admin123'),
    ('app_name', 'global', 'Kasir Rental')
ON CONFLICT (key, outlet_id) DO NOTHING;

-- Default Users Seed
INSERT INTO users (username, password, role, outlet_id) VALUES
    ('cashier1', 'cashier123', 'cashier', 'outlet-1')
ON CONFLICT (username) DO NOTHING;
