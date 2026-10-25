// ==============================================================================
// Netlify Build Script - Generates config.js dynamically from Environment Variables
// Keeps sensitive keys out of GitHub while deploying securely to Netlify
// ==============================================================================

const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const adminEmail = process.env.ADMIN_EMAIL || '';

const configContent = `// Auto-generated during Netlify build from Environment Variables
export const SUPABASE_URL = '${supabaseUrl}';
export const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
export const ADMIN_EMAIL = '${adminEmail}';
`;

fs.writeFileSync('config.js', configContent, 'utf8');
console.log('[Build] Successfully generated config.js from Netlify environment variables.');
