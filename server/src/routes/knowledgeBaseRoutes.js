const express = require('express');
const { getArticles, getArticle, createArticle, updateArticle, deleteArticle } = require('../controllers/knowledgeBaseController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// 06-platform/knowledge-base.md — any authenticated staff member can read (bay-safety-procedure
// and chemical-handling-sds-log are for floor staff, not just admin/manager), but only
// admin/manager can author or edit, same write gate as Services/Wash Packages.
router.use(protect);
router.get('/', getArticles);
router.get('/:id', getArticle);
router.post('/', authorize('admin', 'manager'), createArticle);
router.patch('/:id', authorize('admin', 'manager'), updateArticle);
router.delete('/:id', authorize('admin', 'manager'), deleteArticle);

module.exports = router;
