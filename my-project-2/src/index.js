// src/index.js

import { config } from './config';
import { initializeUtilities } from './utils';

const startApp = () => {
    console.log('Initializing application...');
    initializeUtilities();
    console.log('Application started with the following configuration:', config);
};

startApp();