import { supabase } from './src/config/supabase';

async function setupStorage() {
    console.log('--- Setting up Supabase Storage Bucket (Simple) ---');
    const bucketName = 'institutional-data';
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true
    });
    if (createError) {
        console.error('Error:', createError.message);
    } else {
        console.log('Bucket created successfully.');
    }
}

setupStorage();
