import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SOLVER_URL = process.env.SOLVER_ENGINE_URL || 'http://localhost:8888';

export async function submitBatch(xmlPayload: string, endpoint: 'exchange' | 'solver') {
  try {
    const response = await axios.post(`${SOLVER_URL}/api/${endpoint}`, xmlPayload, {
      headers: { 'Content-Type': 'application/xml' }
    });
    return response.data;
  } catch (error: any) {
    console.error(`Status error in ${endpoint}:`, error.message);
    throw error;
  }
}

export async function pollSolverStatus(jobId: string) {
  // Implementation of polling every 60s
  console.log(`Polling status for Job: ${jobId}`);
  // Placeholder for job status logic
  return { status: 'QUEUED' };
}
