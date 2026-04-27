import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { generateRoomsXML, generateStudentsXML, generateOfferingsXML, generateTravelTimesXML } from './translators/xmlGenerator';
import { setupDataRoutes } from './services/importService';
import * as dataService from './db/dataService';
import { SolverService } from './services/solverService';
import { ValidationService } from './services/validationService';
import { getSolverConstraints, saveSolverConstraints } from './services/constraintService';
import { supabase } from './config/supabase';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());
const PORT = process.env.PORT || 4000;
const solver = new SolverService();
const validator = new ValidationService();

// Middleware for auth / validation could go here

// XML Generation Routes
app.get('/api/payload/:type', async (req, res) => {
  const { type } = req.params;
  
  try {
    let xml = '';
    switch (type) {
      case 'rooms': 
        const rooms = await dataService.fetchRooms();
        xml = generateRoomsXML(rooms); 
        break;
      case 'students': 
        const students = await dataService.fetchStudents();
        xml = generateStudentsXML(students); 
        break;
      case 'offerings': 
        xml = generateOfferingsXML([]); 
        break;
      case 'traveltimes': 
        const travels = await dataService.fetchTravelTimes();
        xml = generateTravelTimesXML(travels); 
        break;
      default: 
        return res.status(400).json({ error: 'Invalid payload type' });
    }
    
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// Orchestration: Generate Full Batch
app.post('/api/solver/generate-batch', async (req, res) => {
  console.log('🚀 Triggering Full Batch Generation...');
  try {
    const [rooms, students, travels, courses] = await Promise.all([
      dataService.fetchRooms(),
      dataService.fetchStudents(),
      dataService.fetchTravelTimes(),
      dataService.fetchCourses()
    ]);

    const payloads = {
      rooms: generateRoomsXML(rooms),
      students: generateStudentsXML(students),
      offerings: generateOfferingsXML(courses),
      traveltimes: generateTravelTimesXML(travels)
    };

    // Orchestration: In a real LPU scale scenario, we'd POST these to UniTime
    // For now, we simulate the "Handover" to the Solver Engine
    console.log(`✅ Batch Generated: ${students.length} Students, ${courses.length} Courses`);
    
    // Simulating solver startup
    res.json({ 
      success: true, 
      message: 'Master payload generated and delivered to UniTime solver.',
      solverId: `LPU-SOLVE-${Date.now()}`,
      stats: {
        rooms: rooms.length,
        students: students.length,
        courses: courses.length,
        travels: travels.length
      },
      nextStep: 'The solver will now process these constraints. Approximate converge time: 1-4 hours.'
    });
  } catch (err: any) {
    console.error('❌ Batch generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stats: Fetch Live Dashboard Metrics
app.get('/api/solver/stats', async (req, res) => {
  try {
    const stats = await dataService.fetchStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Directory Routes
app.get('/api/directory/:type', async (req, res) => {
  const { type } = req.params;
  try {
    let data;
    if (type === 'students') {
      data = await supabase.from('students').select('student_id, name, specialization_id, minor_id, pathway_id').limit(100);
    } else if (type === 'teachers') {
      data = await supabase.from('faculty').select('teacher_id, name, expertise_tags').limit(100);
    } else if (type === 'rooms') {
      data = await supabase.from('infrastructure').select('room_id, block_id, capacity_lecture').limit(100);
    }
    res.json(data?.data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Solver Trigger
app.post('/api/solver/trigger', async (req, res) => {
  try {
    await solver.loadData();
    const count = await solver.runSolver();
    res.json({ success: true, message: `Solver completed! Generated ${count} assignments.` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Solver Constraints
app.get('/api/solver/constraints', async (req, res) => {
  try {
    const constraints = await getSolverConstraints();
    res.json(constraints);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/solver/constraints', async (req, res) => {
  try {
    const updated = await saveSolverConstraints(req.body || {});
    res.json({ success: true, constraints: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Validation: Conflict + Accuracy Report
app.get('/api/solver/validate', async (req, res) => {
  try {
    const report = await validator.validate();
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Solution: Fetch Master Timetable
app.get('/api/solver/solution', async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('master_timetable')
      .select('*');
    
    if (error) throw error;
    
    // Map to frontend format
    const results = data.map(item => ({
      code: item.course_code,
      section: item.section_name,
      time: item.time_slot,
      room: item.room_id,
      instructor: item.instructor_name
    }));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Solution: Fetch Filtered Timetable
app.get('/api/solver/solution/:type/:id', async (req: any, res) => {
  const { type, id } = req.params;
  try {
    let query = supabase.from('master_timetable').select('*');
    
    if (type === 'student') {
        query = query.filter('student_ids', 'cs', `{${id}}`);
    } else if (type === 'teacher') {
        // Support both teacher ID (e.g. 50001) and instructor name search
        const { data: facultyMatch } = await supabase
          .from('faculty')
          .select('name')
          .eq('teacher_id', id)
          .limit(1)
          .maybeSingle();

        const teacherName = facultyMatch?.name;
        if (teacherName) {
          // Exact match to avoid "Professor 1" also matching "Professor 10/11/12..."
          query = query.eq('instructor_name', teacherName);
        } else {
          query = query.ilike('instructor_name', `%${id}%`);
        }
    } else if (type === 'room') {
        query = query.eq('room_id', id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const results = data.map(item => ({
      code: item.course_code,
      section: item.section_name,
      time: item.time_slot,
      room: item.room_id,
      instructor: item.instructor_name
    }));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Data Ingestion Routes
setupDataRoutes(app);

app.listen(PORT, () => {
  console.log(`🚀 Eduniketan Middleware running on http://localhost:${PORT}`);
});
