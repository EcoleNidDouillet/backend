// École Nid Douillet - Authentication Middleware
// JWT verification and role-based access control

const { verifyToken, hasPermission, canAccessChild, ROLES } = require('../config/auth');
const { query, logger } = require('../config/database');

// Extract token from request headers
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
};

// Authenticate user middleware
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis',
        code: 'AUTH_TOKEN_REQUIRED'
      });
    }
    
    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Get fresh user data from database
    let user = null;
    
    if (decoded.role === ROLES.DIRECTOR) {
      const result = await query(
        'SELECT id, first_name, last_name, email, is_active, last_login FROM directors WHERE id = $1',
        [decoded.userId]
      );
      user = result.rows[0];
    } else if (decoded.role === ROLES.PARENT) {
      const result = await query(`
        SELECT 
          p.id, p.first_name, p.last_name, p.email, p.is_active, p.last_login,
          array_agg(pc.child_id) FILTER (WHERE pc.child_id IS NOT NULL) as children_ids
        FROM parents p
        LEFT JOIN parent_children pc ON p.id = pc.parent_id
        WHERE p.id = $1
        GROUP BY p.id, p.first_name, p.last_name, p.email, p.is_active, p.last_login
      `, [decoded.userId]);
      user = result.rows[0];
      
      if (user && user.children_ids) {
        user.childrenIds = user.children_ids;
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Add user info to request
    req.user = {
      ...user,
      role: decoded.role,
      permissions: decoded.permissions || []
    };
    
    // Update last activity
    const updateQuery = decoded.role === ROLES.DIRECTOR 
      ? 'UPDATE directors SET last_login = NOW() WHERE id = $1'
      : 'UPDATE parents SET last_login = NOW() WHERE id = $1';
    
    await query(updateQuery, [user.id]);
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message, stack: error.stack });
    
    if (error.message === 'Invalid token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

// Require specific role middleware
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé pour ce rôle',
        code: 'ROLE_ACCESS_DENIED'
      });
    }
    
    next();
  };
};

// Require specific permission middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      logger.warn('Permission denied', {
        userId: req.user.id,
        role: req.user.role,
        requiredPermission: permission,
        userPermissions: req.user.permissions
      });
      
      return res.status(403).json({
        success: false,
        message: 'Permission insuffisante',
        code: 'PERMISSION_DENIED',
        requiredPermission: permission
      });
    }
    
    next();
  };
};

// Require director role (shorthand)
const requireDirector = requireRole(ROLES.DIRECTOR);

// Require parent role (shorthand)
const requireParent = requireRole(ROLES.PARENT);

// Allow director or parent access to their own data
const requireDirectorOrOwnData = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Directors have full access
  if (req.user.role === ROLES.DIRECTOR) {
    return next();
  }
  
  // Parents can only access their own data
  if (req.user.role === ROLES.PARENT) {
    const childId = req.params.childId || req.params.id;
    const parentId = req.params.parentId;
    
    // Check child access
    if (childId && !canAccessChild(req.user, childId)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ces données d\'enfant',
        code: 'CHILD_ACCESS_DENIED'
      });
    }
    
    // Check parent access (can only access own data)
    if (parentId && parentId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ces données de parent',
        code: 'PARENT_ACCESS_DENIED'
      });
    }
    
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Accès non autorisé',
    code: 'ACCESS_DENIED'
  });
};

// Middleware to check child access specifically
const requireChildAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise',
      code: 'AUTH_REQUIRED'
    });
  }
  
  const childId = req.params.childId || req.params.id;
  
  if (!childId) {
    return res.status(400).json({
      success: false,
      message: 'ID enfant requis',
      code: 'CHILD_ID_REQUIRED'
    });
  }
  
  // Directors have access to all children
  if (req.user.role === ROLES.DIRECTOR) {
    return next();
  }
  
  // Parents can only access their own children
  if (req.user.role === ROLES.PARENT) {
    if (!canAccessChild(req.user, childId)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cet enfant',
        code: 'CHILD_ACCESS_DENIED'
      });
    }
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Accès non autorisé',
    code: 'ACCESS_DENIED'
  });
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      
      // Get user data (simplified for optional auth)
      let user = null;
      
      if (decoded.role === ROLES.DIRECTOR) {
        const result = await query(
          'SELECT id, first_name, last_name, email, is_active FROM directors WHERE id = $1',
          [decoded.userId]
        );
        user = result.rows[0];
      } else if (decoded.role === ROLES.PARENT) {
        const result = await query(
          'SELECT id, first_name, last_name, email, is_active FROM parents WHERE id = $1',
          [decoded.userId]
        );
        user = result.rows[0];
      }
      
      if (user && user.is_active) {
        req.user = {
          ...user,
          role: decoded.role,
          permissions: decoded.permissions || []
        };
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    logger.debug('Optional auth failed', { error: error.message });
    next();
  }
};

// Middleware to log authentication events
const logAuthEvent = (eventType) => {
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    logger.info('Authentication event', {
      eventType,
      userId: req.user?.id,
      role: req.user?.role,
      email: req.user?.email,
      clientIp,
      userAgent,
      timestamp: new Date().toISOString()
    });
    
    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  requireDirector,
  requireParent,
  requireDirectorOrOwnData,
  requireChildAccess,
  optionalAuth,
  logAuthEvent,
  extractToken
};
