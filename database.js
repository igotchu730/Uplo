require('dotenv').config();
const AWS = require('aws-sdk');
const mysql = require('mysql2');
const mysqlPromise = require('mysql2/promise')
const bcrypt = require('bcrypt'); // bcrypt included

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

// Create the connection pool with promise
const poolPromise = mysqlPromise.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

// Function to test connection to MySQL database
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

function testQuery() {
    pool.query('SELECT * FROM file_uploads', (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return;
        }
        console.log('User Data:', results);
    });
}

//Test functions, remove later
//testQuery();
//testConnection();

module.exports = {
    pool,
    poolPromise
};

