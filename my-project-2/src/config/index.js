const config = {
    port: process.env.PORT || 3000,
    dbUrl: process.env.DB_URL || 'mongodb://localhost:27017/mydb',
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    apiUrl: process.env.API_URL || 'http://localhost:5000/api',
};

export default config;