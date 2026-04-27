import { supabase } from '../config/supabase';

async function ingest() {
  console.log('Ingesting test data...');

  // 1. Rooms
  const { error: rErr } = await supabase.from('infrastructure').upsert([
    { room_id: 'B32-101', block_id: 'Block 32', capacity_lecture: 60, room_type: 'Theory', is_byod_ready: true, connected_blocks: ['Block 33'] },
    { room_id: 'B33-201', block_id: 'Block 33', capacity_lecture: 40, room_type: 'Lab', is_byod_ready: false, connected_blocks: ['Block 32'] }
  ]);
  if (rErr) console.error('Rooms Error:', rErr);

  // 2. Students
  const { error: sErr } = await supabase.from('students').upsert([
    { student_id: 'LPU40001', name: 'Sujeet Kumar', specialization_id: 'Fullstack', is_byod: true },
    { student_id: 'LPU40002', name: 'Anjali Sharma', specialization_id: 'AI/ML', is_byod: false }
  ]);
  if (sErr) console.error('Students Error:', sErr);

  console.log('✅ Ingestion complete!');
}

ingest();
