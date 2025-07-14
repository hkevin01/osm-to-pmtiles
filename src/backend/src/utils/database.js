const { Pool } = require('pg');
const logger = require('./logger');

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'db',
    database: process.env.POSTGRES_DB || 'osmtiles',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: process.env.POSTGRES_PORT || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
    logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    logger.error('PostgreSQL connection error:', err);
    process.exit(1);
});

// Query helper function
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error:', { text, params, error: error.message });
        throw error;
    }
};

// Get a client from the pool
const getClient = async () => {
    try {
        const client = await pool.connect();
        const query = client.query;
        const release = client.release;
        
        // Set a timeout of 5 seconds, after which we will log this client's last query
        const timeout = setTimeout(() => {
            logger.error('A client has been checked out for more than 5 seconds!');
            logger.error('The last executed query on this client was: ' + client.lastQuery);
        }, 5000);
        
        // Monkey patch the query method to keep track of the last query executed
        client.query = (...args) => {
            client.lastQuery = args;
            return query.apply(client, args);
        };
        
        client.release = () => {
            clearTimeout(timeout);
            // Call the actual 'release' method
            release.call(client);
        };
        
        return client;
    } catch (error) {
        logger.error('Error getting database client:', error);
        throw error;
    }
};

// Initialize database tables
const initializeDatabase = async () => {
    try {
        // Create conversion_jobs table if it doesn't exist
        await query(`
            CREATE TABLE IF NOT EXISTS conversion_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                error_message TEXT,
                output_path VARCHAR(500),
                output_size BIGINT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                metadata JSONB DEFAULT '{}',
                conversion_options JSONB DEFAULT '{}'
            );
        `);

        // Create indexes for better query performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status 
            ON conversion_jobs (status);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_conversion_jobs_created_at 
            ON conversion_jobs (created_at DESC);
        `);

        // Create updated_at trigger function
        await query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Create trigger for updated_at
        await query(`
            DROP TRIGGER IF EXISTS update_conversion_jobs_updated_at ON conversion_jobs;
            CREATE TRIGGER update_conversion_jobs_updated_at
                BEFORE UPDATE ON conversion_jobs
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);

        logger.info('Database tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing database:', error);
        throw error;
    }
};

// Graceful shutdown
const closePool = async () => {
    try {
        await pool.end();
        logger.info('Database pool closed');
    } catch (error) {
        logger.error('Error closing database pool:', error);
    }
};

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

module.exports = {
    query,
    getClient,
    initializeDatabase,
    closePool,
    pool
};
