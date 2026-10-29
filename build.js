// ==============================================================================
// Netlify Build Script - Generates config.js dynamically from Environment Variables
// Keeps sensitive keys out of GitHub while deploying securely to Netlify
// ==============================================================================

const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://xbzhwuclzkjxsznijskm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhiemh3dWNsemtqeHN6bmlqc2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDc4ODgsImV4cCI6MjEwODE4Mzg4OH0.9va6pB_ZDAj68edlzPVH42jB5N5pRyQjYe1E1N7Wm1I';
const adminEmail = process.env.ADMIN_EMAIL || 'shopsnon@gmail.com';

const configContent = `// Auto-generated during Netlify build from Environment Variables
export const SUPABASE_URL = '${supabaseUrl}';
export const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
export const ADMIN_EMAIL = '${adminEmail}';
`;

fs.writeFileSync('config.js', configContent, 'utf8');
console.log('[Build] Successfully generated config.js from Netlify environment variables.');
