import { environment } from '../../environments/environment';

// Single source of truth for the API base URL.
// Dev build:  http://localhost:5000  (from environments/environment.ts)
// Prod build: https://anispeaker.onrender.com  (from environments/environment.prod.ts)
export const API_BASE_URL = environment.apiBaseUrl;
