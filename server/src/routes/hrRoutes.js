const express = require('express');
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const { getShifts, createShift, updateShift, clockIn, clockOut, deleteShift } = require('../controllers/shiftController');
const { getLeaveRequests, createLeaveRequest, decideLeaveRequest } = require('../controllers/leaveController');
const { getPayrollRuns, getPayrollRun, createPayrollRun } = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// HR data (03-operations/hr.md) — admin/manager only, matching this app's existing gate on
// Staff/Expenses/Reports. Mounted as one router at /api/hr/* rather than four separate
// top-level resources since they're all one cluster and none of them is large enough to
// warrant its own route file the way tickets/wash-orders are.
router.use(protect, authorize('admin', 'manager'));

router.route('/employees').get(getEmployees).post(createEmployee);
router.route('/employees/:id').get(getEmployee).put(updateEmployee).delete(deleteEmployee);

router.route('/shifts').get(getShifts).post(createShift);
router.route('/shifts/:id').put(updateShift).delete(deleteShift);
router.patch('/shifts/:id/clock-in', clockIn);
router.patch('/shifts/:id/clock-out', clockOut);

router.route('/leave-requests').get(getLeaveRequests).post(createLeaveRequest);
router.patch('/leave-requests/:id/decision', decideLeaveRequest);

router.route('/payroll-runs').get(getPayrollRuns).post(createPayrollRun);
router.get('/payroll-runs/:id', getPayrollRun);

module.exports = router;
