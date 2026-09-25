const express = require('express');
const db = require('../db');

const router = express.Router();

const defaultDashboard = {
  student_id: 'demo-student',
  name: 'David K.',
  programme: 'BSc. Agronomy',
  year: 'Year 3',
  semester: 'Semester 2',
  metrics: { credits: 24, certifications: 3, field_hours: 12, trust_score: 8.5 },
  focus: { title: 'Soil Microbiology Thesis', status: 'Urgent', description: 'Draft review pending feedback from Dr. M. Okafor. Ensure dataset is attached.' },
  courses: [
    { id: 'soil-science', title: 'Soil Science 101', module: 'Module 4: Nutrient Cycling', progress: 75 },
    { id: 'irrigation', title: 'Smart Irrigation Systems', module: 'Module 2: Drip Line Calibration', progress: 30 },
  ],
  opportunities: [
    { id: 'kifaru-intern', title: 'Agronomy Intern', organization: 'Kifaru Farms', location: 'Naivasha', tags: ['3 Months', 'Paid'] },
    { id: 'greenventure-analyst', title: 'Soil Data Analyst', organization: 'GreenVenture NGO', location: 'Nairobi', tags: ['Part-time', 'Remote'] },
  ],
  applications: [],
  assignments: [],
};

async function ensureDashboard(studentId) {
  const existing = await db('student_dashboards').where({ student_id: studentId }).first();
  if (existing) return existing;
  const [created] = await db('student_dashboards').insert({ student_id: studentId, dashboard: JSON.stringify({ ...defaultDashboard, student_id: studentId }) }).returning('*');
  return created;
}

function parseDashboard(row) {
  return typeof row.dashboard === 'string' ? JSON.parse(row.dashboard) : row.dashboard;
}

router.get('/dashboard', async (req, res) => {
  try {
    const row = await ensureDashboard(req.query.student_id || 'demo-student');
    res.json(parseDashboard(row));
  } catch (error) {
    console.error('StudentsController.dashboard', error);
    res.status(500).json({ error: 'student_dashboard_error' });
  }
});

router.post('/progress', async (req, res) => {
  try {
    const studentId = req.body.student_id || 'demo-student';
    const row = await ensureDashboard(studentId);
    const dashboard = parseDashboard(row);
    dashboard.courses = dashboard.courses.map((course) => course.id === req.body.course_id ? { ...course, progress: Math.max(0, Math.min(100, Number(req.body.progress))) } : course);
    await db('student_dashboards').where({ student_id: studentId }).update({ dashboard: JSON.stringify(dashboard), updated_at: db.fn.now() });
    res.json({ success: true, dashboard });
  } catch (error) {
    console.error('StudentsController.progress', error);
    res.status(500).json({ error: 'student_progress_error' });
  }
});

router.post('/assignments', async (req, res) => {
  try {
    const studentId = req.body.student_id || 'demo-student';
    const row = await ensureDashboard(studentId);
    const dashboard = parseDashboard(row);
    dashboard.assignments = [...(dashboard.assignments || []), { id: `assignment-${Date.now()}`, name: req.body.name, submitted_at: new Date().toISOString() }];
    await db('student_dashboards').where({ student_id: studentId }).update({ dashboard: JSON.stringify(dashboard), updated_at: db.fn.now() });
    res.status(201).json({ success: true, assignment: dashboard.assignments.at(-1) });
  } catch (error) {
    console.error('StudentsController.assignment', error);
    res.status(500).json({ error: 'student_assignment_error' });
  }
});

router.post('/applications', async (req, res) => {
  try {
    const studentId = req.body.student_id || 'demo-student';
    const row = await ensureDashboard(studentId);
    const dashboard = parseDashboard(row);
    const application = { id: `application-${Date.now()}`, opportunity_id: req.body.opportunity_id, status: 'Submitted', submitted_at: new Date().toISOString() };
    dashboard.applications = [...(dashboard.applications || []), application];
    await db('student_dashboards').where({ student_id: studentId }).update({ dashboard: JSON.stringify(dashboard), updated_at: db.fn.now() });
    res.status(201).json({ success: true, application });
  } catch (error) {
    console.error('StudentsController.application', error);
    res.status(500).json({ error: 'student_application_error' });
  }
});

module.exports = router;
