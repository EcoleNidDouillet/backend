/**
 * École Nid Douillet - CMS Controller
 * 
 * Content Management System for public website
 */

const { query } = require('../config/database');
const logger = require('../../config/logger');

/**
 * Get all published content items
 */
const getPublishedContent = async (req, res) => {
  try {
    const { type, language = 'fr' } = req.query;
    
    let whereClause = 'WHERE is_published = true';
    const params = [];
    
    if (type) {
      whereClause += ' AND content_type = $' + (params.length + 1);
      params.push(type);
    }
    
    if (language) {
      whereClause += ' AND language = $' + (params.length + 1);
      params.push(language);
    }
    
    const result = await query(`
      SELECT 
        id, title, slug, content_type, language, excerpt, content,
        meta_title, meta_description, featured_image, tags,
        published_at, updated_at, display_order
      FROM cms_content 
      ${whereClause}
      ORDER BY display_order ASC, published_at DESC
    `, params);

    res.json({
      success: true,
      data: result.rows,
      message: 'Contenu publié récupéré avec succès'
    });

  } catch (error) {
    logger.error('Error fetching published content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du contenu',
      code: 'CMS_FETCH_ERROR'
    });
  }
};

/**
 * Get content by slug
 */
const getContentBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const { language = 'fr' } = req.query;
    
    const result = await query(`
      SELECT 
        id, title, slug, content_type, language, excerpt, content,
        meta_title, meta_description, featured_image, tags,
        published_at, updated_at, display_order
      FROM cms_content 
      WHERE slug = $1 AND language = $2 AND is_published = true
    `, [slug, language]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contenu non trouvé',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    // Increment view count
    await query(`
      UPDATE cms_content 
      SET view_count = view_count + 1 
      WHERE id = $1
    `, [result.rows[0].id]);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Contenu récupéré avec succès'
    });

  } catch (error) {
    logger.error('Error fetching content by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du contenu',
      code: 'CMS_FETCH_ERROR'
    });
  }
};

/**
 * Get all content (admin only)
 */
const getAllContent = async (req, res) => {
  try {
    const { type, language, status } = req.query;
    const { page = 1, limit = 20 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (type) {
      whereClause += ' AND content_type = $' + (params.length + 1);
      params.push(type);
    }
    
    if (language) {
      whereClause += ' AND language = $' + (params.length + 1);
      params.push(language);
    }
    
    if (status === 'published') {
      whereClause += ' AND is_published = true';
    } else if (status === 'draft') {
      whereClause += ' AND is_published = false';
    }
    
    // Count total
    const countResult = await query(`
      SELECT COUNT(*) as total FROM cms_content ${whereClause}
    `, params);
    
    const total = parseInt(countResult.rows[0].total);
    const offset = (page - 1) * limit;
    
    // Get paginated results
    const result = await query(`
      SELECT 
        id, title, slug, content_type, language, excerpt,
        meta_title, meta_description, featured_image, tags,
        is_published, published_at, created_at, updated_at,
        display_order, view_count
      FROM cms_content 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        content: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      },
      message: 'Contenu récupéré avec succès'
    });

  } catch (error) {
    logger.error('Error fetching all content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du contenu',
      code: 'CMS_FETCH_ERROR'
    });
  }
};

/**
 * Create new content
 */
const createContent = async (req, res) => {
  try {
    const {
      title, slug, content_type, language = 'fr', excerpt, content,
      meta_title, meta_description, featured_image, tags = [],
      is_published = false, display_order = 0
    } = req.body;

    // Check if slug already exists for this language
    const existingSlug = await query(`
      SELECT id FROM cms_content WHERE slug = $1 AND language = $2
    `, [slug, language]);

    if (existingSlug.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce slug existe déjà pour cette langue',
        code: 'SLUG_EXISTS'
      });
    }

    const result = await query(`
      INSERT INTO cms_content (
        title, slug, content_type, language, excerpt, content,
        meta_title, meta_description, featured_image, tags,
        is_published, display_order, published_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      title, slug, content_type, language, excerpt, content,
      meta_title, meta_description, featured_image, JSON.stringify(tags),
      is_published, display_order, 
      is_published ? new Date() : null,
      req.user.userId
    ]);

    logger.info('Content created', { 
      contentId: result.rows[0].id, 
      title, 
      createdBy: req.user.userId 
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Contenu créé avec succès'
    });

  } catch (error) {
    logger.error('Error creating content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du contenu',
      code: 'CMS_CREATE_ERROR'
    });
  }
};

/**
 * Update content
 */
const updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, slug, content_type, language, excerpt, content,
      meta_title, meta_description, featured_image, tags,
      is_published, display_order
    } = req.body;

    // Check if content exists
    const existingContent = await query(`
      SELECT * FROM cms_content WHERE id = $1
    `, [id]);

    if (existingContent.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contenu non trouvé',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    // Check if slug conflicts with other content
    if (slug) {
      const slugConflict = await query(`
        SELECT id FROM cms_content 
        WHERE slug = $1 AND language = $2 AND id != $3
      `, [slug, language || existingContent.rows[0].language, id]);

      if (slugConflict.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ce slug existe déjà pour cette langue',
          code: 'SLUG_EXISTS'
        });
      }
    }

    const wasPublished = existingContent.rows[0].is_published;
    const nowPublished = is_published !== undefined ? is_published : wasPublished;

    const result = await query(`
      UPDATE cms_content SET
        title = COALESCE($1, title),
        slug = COALESCE($2, slug),
        content_type = COALESCE($3, content_type),
        language = COALESCE($4, language),
        excerpt = COALESCE($5, excerpt),
        content = COALESCE($6, content),
        meta_title = COALESCE($7, meta_title),
        meta_description = COALESCE($8, meta_description),
        featured_image = COALESCE($9, featured_image),
        tags = COALESCE($10, tags),
        is_published = COALESCE($11, is_published),
        display_order = COALESCE($12, display_order),
        published_at = CASE 
          WHEN $11 = true AND $13 = false THEN NOW()
          WHEN $11 = false THEN NULL
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      title, slug, content_type, language, excerpt, content,
      meta_title, meta_description, featured_image, 
      tags ? JSON.stringify(tags) : null,
      is_published, display_order, wasPublished, id
    ]);

    logger.info('Content updated', { 
      contentId: id, 
      title: title || existingContent.rows[0].title,
      updatedBy: req.user.userId 
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Contenu mis à jour avec succès'
    });

  } catch (error) {
    logger.error('Error updating content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du contenu',
      code: 'CMS_UPDATE_ERROR'
    });
  }
};

/**
 * Delete content
 */
const deleteContent = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM cms_content WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contenu non trouvé',
        code: 'CONTENT_NOT_FOUND'
      });
    }

    logger.info('Content deleted', { 
      contentId: id, 
      title: result.rows[0].title,
      deletedBy: req.user.userId 
    });

    res.json({
      success: true,
      message: 'Contenu supprimé avec succès'
    });

  } catch (error) {
    logger.error('Error deleting content:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du contenu',
      code: 'CMS_DELETE_ERROR'
    });
  }
};

/**
 * Get content statistics
 */
const getContentStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_content,
        COUNT(*) FILTER (WHERE is_published = true) as published_content,
        COUNT(*) FILTER (WHERE is_published = false) as draft_content,
        COUNT(*) FILTER (WHERE content_type = 'page') as pages,
        COUNT(*) FILTER (WHERE content_type = 'post') as posts,
        COUNT(*) FILTER (WHERE content_type = 'news') as news,
        COUNT(*) FILTER (WHERE language = 'fr') as french_content,
        COUNT(*) FILTER (WHERE language = 'ar') as arabic_content,
        SUM(view_count) as total_views
      FROM cms_content
    `);

    const recentContent = await query(`
      SELECT title, content_type, language, published_at, view_count
      FROM cms_content 
      WHERE is_published = true
      ORDER BY published_at DESC 
      LIMIT 5
    `);

    const popularContent = await query(`
      SELECT title, content_type, language, view_count, published_at
      FROM cms_content 
      WHERE is_published = true AND view_count > 0
      ORDER BY view_count DESC 
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        statistics: stats.rows[0],
        recent_content: recentContent.rows,
        popular_content: popularContent.rows
      },
      message: 'Statistiques du contenu récupérées avec succès'
    });

  } catch (error) {
    logger.error('Error fetching content stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      code: 'CMS_STATS_ERROR'
    });
  }
};

module.exports = {
  getPublishedContent,
  getContentBySlug,
  getAllContent,
  createContent,
  updateContent,
  deleteContent,
  getContentStats
};
