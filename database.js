require('dotenv').config();
const mysql = require('mysql2');

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

function testConnection() {
    console.log('Attempting to connect to the database...');

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error connecting to the database:', err);
            return;
        }

        console.log('Connected to the MySQL database!');
        connection.release();
    });

    console.log('Connection attempt completed.');
}

testConnection();

function testQuery() {
    pool.query('SELECT * FROM test', (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return;
        }
        console.log('User Data:', results);
    });
}

testQuery();
