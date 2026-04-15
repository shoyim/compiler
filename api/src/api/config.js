const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'zver',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'compiler_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function runMigrations() {
    let connection;
    try {
        connection = await db.getConnection();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_name VARCHAR(255) NOT NULL UNIQUE,
                key_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS package_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                package_name VARCHAR(255),
                status VARCHAR(50),
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                token_prefix VARCHAR(20) NOT NULL,
                scopes JSON,
                last_used_at TIMESTAMP NULL,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS execution_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                language VARCHAR(50),
                code TEXT,
                output TEXT,
                status VARCHAR(50),
                execution_time FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log("Migration completed successfully");
    } catch (err) {
        console.error("Migration failed:", err.message);
        setTimeout(runMigrations, 5000);
    } finally {
        if (connection) connection.release();
    }
}

runMigrations();

module.exports = { db };