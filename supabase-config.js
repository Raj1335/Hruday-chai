/**
 * SUPABASE CONFIGURATION
 * ----------------------
 * Get these values from: Supabase Project -> Settings -> API
 */

const SUPABASE_URL = 'https://jroqbpdyhlsdwvlgtawm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyb3FicGR5aGxzZHd2bGd0YXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTUyOTgsImV4cCI6MjA5MDQ5MTI5OH0.ziHWxP31aKc0L2XkSEuY9P838QjDD0ylcrTibqvuf8Y';

// Initialize the Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * UTILITY: Role-Based Access Control (RBAC)
 * This helper checks the user's metadata to see if they are a 'super_admin'
 */
async function getUserRole() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    
    // Returns 'super_admin' or 'admin' based on your Supabase Auth setup
    return user.app_metadata?.role || 'admin'; 
}

/**
 * UTILITY: Image Compression Helper
 * Uses browser-image-compression to keep photos < 100KB
 * ensuring we stay within the 1GB free tier.
 */
async function compressAndUploadImage(file, bucket, path) {
    const options = {
        maxSizeMB: 0.1,          // 100KB limit
        maxWidthOrHeight: 800,
        useWebWorker: true
    };

    try {
        const compressedFile = await imageCompression(file, options);
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, compressedFile, { upsert: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Image processing failed:', error);
        return null;
    }
}
