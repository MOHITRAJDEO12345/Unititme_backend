import { supabase } from './src/config/supabase';

async function setupPolicies() {
    console.log('--- Setting up Storage Policies ---');
    
    // In a real scenario, you'd use SQL through Supabase Dashboard.
    // Here we'll try to use the client to ensure the bucket is public at least.
    const { error: updateError } = await supabase.storage.updateBucket('institutional-data', {
        public: true,
        fileSizeLimit: 200 * 1024 * 1024
    });

    if (updateError) {
        console.error('Update Error:', updateError.message);
    } else {
        console.log('Bucket updated to Public with 200MB limit.');
    }
}

setupPolicies();
