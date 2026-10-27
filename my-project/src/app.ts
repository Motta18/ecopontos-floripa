import express from 'express';
import { AppConfig } from './types';
import { initializeMiddleware } from './lib';

const app = express();
const port = process.env.PORT || 3000;

const config: AppConfig = {
    // Add your application configuration here
};

initializeMiddleware(app);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});