/**
 * École Nid Douillet - CMS Routes
 * 
 * Content Management System API routes
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const cmsController = require('../controllers/cms.controller');
const { USER_ROLES } = require('../constants/auth.constants');

// Validation schemas
const contentSchema = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.empty': 'Le titre est requis',
    'string.max': 'Le titre ne peut pas dépasser 200 caractères'
  }),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).required().messages({
    'string.pattern.base': 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets'
  }),
  content_type: Joi.string().valid('page', 'post', 'news', 'announcement').required().messages({
    'any.only': 'Le type de contenu doit être page, post, news ou announcement'
  }),
  language: Joi.string().valid('fr', 'ar').default('fr'),
  excerpt: Joi.string().max(500).allow('').messages({
    'string.max': 'L\'extrait ne peut pas dépasser 500 caractères'
  }),
  content: Joi.string().required().messages({
    'string.empty': 'Le contenu est requis'
  }),
  meta_title: Joi.string().max(60).allow('').messages({
    'string.max': 'Le titre meta ne peut pas dépasser 60 caractères'
  }),
  meta_description: Joi.string().max(160).allow('').messages({
    'string.max': 'La description meta ne peut pas dépasser 160 caractères'
  }),
  featured_image: Joi.string().uri().allow('').messages({
    'string.uri': 'L\'image mise en avant doit être une URL valide'
  }),
  tags: Joi.array().items(Joi.string()).default([]),
  is_published: Joi.boolean().default(false),
  display_order: Joi.number().integer().min(0).default(0)
});

const updateContentSchema = contentSchema.fork(
  ['title', 'slug', 'content_type', 'content'], 
  (schema) => schema.optional()
);

const querySchema = Joi.object({
  type: Joi.string().valid('page', 'post', 'news', 'announcement'),
  language: Joi.string().valid('fr', 'ar').default('fr'),
  status: Joi.string().valid('published', 'draft'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

/**
 * @swagger
 * components:
 *   schemas:
 *     CMSContent:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         slug:
 *           type: string
 *         content_type:
 *           type: string
 *           enum: [page, post, news, announcement]
 *         language:
 *           type: string
 *           enum: [fr, ar]
 *         excerpt:
 *           type: string
 *         content:
 *           type: string
 *         meta_title:
 *           type: string
 *         meta_description:
 *           type: string
 *         featured_image:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         is_published:
 *           type: boolean
 *         display_order:
 *           type: integer
 *         view_count:
 *           type: integer
 *         published_at:
 *           type: string
 *           format: date-time
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/cms/content/published:
 *   get:
 *     summary: Get all published content
 *     description: Retrieve all published content items for public website
 *     tags: [CMS - Public]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [page, post, news, announcement]
 *         description: Filter by content type
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [fr, ar]
 *           default: fr
 *         description: Content language
 *     responses:
 *       200:
 *         description: Published content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CMSContent'
 *                 message:
 *                   type: string
 */
router.get('/content/published', validateRequest(querySchema, 'query'), cmsController.getPublishedContent);

/**
 * @swagger
 * /api/cms/content/slug/{slug}:
 *   get:
 *     summary: Get content by slug
 *     description: Retrieve specific content item by slug for public display
 *     tags: [CMS - Public]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Content slug
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [fr, ar]
 *           default: fr
 *         description: Content language
 *     responses:
 *       200:
 *         description: Content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CMSContent'
 *                 message:
 *                   type: string
 *       404:
 *         description: Content not found
 */
router.get('/content/slug/:slug', cmsController.getContentBySlug);

// Protected routes (Director only)
/**
 * @swagger
 * /api/cms/content:
 *   get:
 *     summary: Get all content (admin)
 *     description: Retrieve all content items with pagination (Director only)
 *     tags: [CMS - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [page, post, news, announcement]
 *         description: Filter by content type
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [fr, ar]
 *         description: Filter by language
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [published, draft]
 *         description: Filter by publication status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Content retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Director access required
 */
router.get('/content', 
  authenticate, 
  requireRole(USER_ROLES.DIRECTOR), 
  validateRequest(querySchema, 'query'), 
  cmsController.getAllContent
);

/**
 * @swagger
 * /api/cms/content:
 *   post:
 *     summary: Create new content
 *     description: Create a new content item (Director only)
 *     tags: [CMS - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - slug
 *               - content_type
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *               content_type:
 *                 type: string
 *                 enum: [page, post, news, announcement]
 *               language:
 *                 type: string
 *                 enum: [fr, ar]
 *                 default: fr
 *               excerpt:
 *                 type: string
 *                 maxLength: 500
 *               content:
 *                 type: string
 *               meta_title:
 *                 type: string
 *                 maxLength: 60
 *               meta_description:
 *                 type: string
 *                 maxLength: 160
 *               featured_image:
 *                 type: string
 *                 format: uri
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_published:
 *                 type: boolean
 *                 default: false
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       201:
 *         description: Content created successfully
 *       400:
 *         description: Validation error or slug already exists
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Director access required
 */
router.post('/content', 
  authenticate, 
  requireRole(USER_ROLES.DIRECTOR), 
  validateRequest(contentSchema), 
  cmsController.createContent
);

/**
 * @swagger
 * /api/cms/content/{id}:
 *   put:
 *     summary: Update content
 *     description: Update an existing content item (Director only)
 *     tags: [CMS - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               slug:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *               content_type:
 *                 type: string
 *                 enum: [page, post, news, announcement]
 *               language:
 *                 type: string
 *                 enum: [fr, ar]
 *               excerpt:
 *                 type: string
 *                 maxLength: 500
 *               content:
 *                 type: string
 *               meta_title:
 *                 type: string
 *                 maxLength: 60
 *               meta_description:
 *                 type: string
 *                 maxLength: 160
 *               featured_image:
 *                 type: string
 *                 format: uri
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_published:
 *                 type: boolean
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Content updated successfully
 *       400:
 *         description: Validation error or slug conflict
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Director access required
 *       404:
 *         description: Content not found
 */
router.put('/content/:id', 
  authenticate, 
  requireRole(USER_ROLES.DIRECTOR), 
  validateRequest(updateContentSchema), 
  cmsController.updateContent
);

/**
 * @swagger
 * /api/cms/content/{id}:
 *   delete:
 *     summary: Delete content
 *     description: Delete a content item (Director only)
 *     tags: [CMS - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Director access required
 *       404:
 *         description: Content not found
 */
router.delete('/content/:id', 
  authenticate, 
  requireRole(USER_ROLES.DIRECTOR), 
  cmsController.deleteContent
);

/**
 * @swagger
 * /api/cms/stats:
 *   get:
 *     summary: Get content statistics
 *     description: Retrieve CMS content statistics (Director only)
 *     tags: [CMS - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         total_content:
 *                           type: integer
 *                         published_content:
 *                           type: integer
 *                         draft_content:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         posts:
 *                           type: integer
 *                         news:
 *                           type: integer
 *                         french_content:
 *                           type: integer
 *                         arabic_content:
 *                           type: integer
 *                         total_views:
 *                           type: integer
 *                     recent_content:
 *                       type: array
 *                       items:
 *                         type: object
 *                     popular_content:
 *                       type: array
 *                       items:
 *                         type: object
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Director access required
 */
router.get('/stats', 
  authenticate, 
  requireRole(USER_ROLES.DIRECTOR), 
  cmsController.getContentStats
);

module.exports = router;
