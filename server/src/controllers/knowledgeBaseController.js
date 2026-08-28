const asyncHandler = require('express-async-handler');
const { eq } = require('drizzle-orm');
const { db } = require('../config/db');
const { knowledgeArticles } = require('../db/schema');

const CATEGORIES = ['knowledge-article', 'customer-facing', 'internal'];

const slugify = (title) =>
  String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const getArticles = asyncHandler(async (req, res) => {
  const rows = await db.select().from(knowledgeArticles).orderBy(knowledgeArticles.category, knowledgeArticles.title);
  const filtered = req.query.category ? rows.filter((a) => a.category === req.query.category) : rows;
  res.json(filtered);
});

const getArticle = asyncHandler(async (req, res) => {
  const [row] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles._id, req.params.id));
  if (!row) {
    res.status(404);
    throw new Error('Article not found');
  }
  res.json(row);
});

const createArticle = asyncHandler(async (req, res) => {
  const { category, title, body } = req.body;
  if (!category || !CATEGORIES.includes(category)) {
    res.status(400);
    throw new Error(`category must be one of ${CATEGORIES.join(', ')}`);
  }
  if (!title || !body) {
    res.status(400);
    throw new Error('title and body are required');
  }
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;
  // Guard against two authored articles slugifying to the same value (e.g. "FAQ" edited twice
  // with a typo fixed in the title) — append -2, -3, ... rather than erroring the author out.
  while ((await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.slug, slug))).length) {
    slug = `${baseSlug}-${suffix++}`;
  }
  const [created] = await db
    .insert(knowledgeArticles)
    .values({ slug, category, title, body, updatedBy: req.user._id })
    .returning();
  res.status(201).json(created);
});

// Edits bump version and push the prior title/body onto previousVersions rather than
// overwriting — the spec calls this out by name for chemical-handling-sds-log ("what did the
// SDS say on a given date") and membership-agreement, and there's no reason the other article
// types shouldn't get the same history for free.
const updateArticle = asyncHandler(async (req, res) => {
  const [existing] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles._id, req.params.id));
  if (!existing) {
    res.status(404);
    throw new Error('Article not found');
  }
  const { title, body, category } = req.body;
  const nextTitle = title ?? existing.title;
  const nextBody = body ?? existing.body;
  const nextCategory = category && CATEGORIES.includes(category) ? category : existing.category;

  const priorVersions = existing.previousVersions || [];
  const [updated] = await db
    .update(knowledgeArticles)
    .set({
      title: nextTitle,
      body: nextBody,
      category: nextCategory,
      version: existing.version + 1,
      previousVersions: [...priorVersions, { version: existing.version, title: existing.title, body: existing.body, updatedAt: existing.updatedAt }],
      updatedBy: req.user._id,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeArticles._id, req.params.id))
    .returning();
  res.json(updated);
});

const deleteArticle = asyncHandler(async (req, res) => {
  const [deleted] = await db.delete(knowledgeArticles).where(eq(knowledgeArticles._id, req.params.id)).returning();
  if (!deleted) {
    res.status(404);
    throw new Error('Article not found');
  }
  res.json({ ok: true });
});

module.exports = { getArticles, getArticle, createArticle, updateArticle, deleteArticle, CATEGORIES };
