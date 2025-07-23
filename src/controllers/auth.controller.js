// École Nid Douillet - Authentication Controller
// Login, logout, token refresh, and password management

const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken, 
  comparePassword, 
  hashPassword,
  validatePassword,
  generateSessionData,
  ROLES 
} = require('../config/auth');
const { query, logger } = require('../config/database');

// Login for directors and parents
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    logger.info('Login attempt', { email });
    
    // Try to find user in directors table first
    let user = null;
    let role = null;
    
    const directorResult = await query(
      'SELECT id, first_name, last_name, email, password_hash, is_active FROM directors WHERE email = $1',
      [email]
    );
    
    if (directorResult.rows.length > 0) {
      user = directorResult.rows[0];
      role = ROLES.DIRECTOR;
    } else {
      // Try parents table
      const parentResult = await query(`
        SELECT 
          p.id, p.first_name, p.last_name, p.email, p.password_hash, p.is_active,
          array_agg(pc.child_id) FILTER (WHERE pc.child_id IS NOT NULL) as children_ids
        FROM parents p
        LEFT JOIN parent_children pc ON p.id = pc.parent_id
        WHERE p.email = $1
        GROUP BY p.id, p.first_name, p.last_name, p.email, p.password_hash, p.is_active
      `, [email]);
      
      if (parentResult.rows.length > 0) {
        user = parentResult.rows[0];
        user.childrenIds = user.children_ids || [];
        role = ROLES.PARENT;
      }
    }
    
    if (!user) {
      logger.warn('Login failed - user not found', { email });
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    if (!user.is_active) {
      logger.warn('Login failed - account disabled', { email, userId: user.id });
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administration.',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      logger.warn('Login failed - invalid password', { email, userId: user.id });
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Generate session data
    const sessionData = generateSessionData(user, role);
    
    // Generate tokens
    const accessToken = generateToken(sessionData);
    const refreshToken = generateRefreshToken({ userId: user.id, role });
    
    // Update last login
    const updateQuery = role === ROLES.DIRECTOR 
      ? 'UPDATE directors SET last_login = NOW() WHERE id = $1'
      : 'UPDATE parents SET last_login = NOW() WHERE id = $1';
    
    await query(updateQuery, [user.id]);
    
    logger.info('Login successful', { 
      email, 
      userId: user.id, 
      role,
      childrenCount: role === ROLES.PARENT ? (user.childrenIds?.length || 0) : undefined
    });
    
    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role,
          childrenIds: role === ROLES.PARENT ? user.childrenIds : undefined
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '24h'
        }
      }
    });
    
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Erreur de connexion',
      code: 'LOGIN_ERROR'
    });
  }
};

// Refresh access token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de rafraîchissement requis',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(token);
    
    // Get fresh user data
    let user = null;
    let role = decoded.role;
    
    if (role === ROLES.DIRECTOR) {
      const result = await query(
        'SELECT id, first_name, last_name, email, is_active FROM directors WHERE id = $1',
        [decoded.userId]
      );
      user = result.rows[0];
    } else if (role === ROLES.PARENT) {
      const result = await query(`
        SELECT 
          p.id, p.first_name, p.last_name, p.email, p.is_active,
          array_agg(pc.child_id) FILTER (WHERE pc.child_id IS NOT NULL) as children_ids
        FROM parents p
        LEFT JOIN parent_children pc ON p.id = pc.parent_id
        WHERE p.id = $1
        GROUP BY p.id, p.first_name, p.last_name, p.email, p.is_active
      `, [decoded.userId]);
      user = result.rows[0];
      
      if (user && user.children_ids) {
        user.childrenIds = user.children_ids;
      }
    }
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou compte désactivé',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Generate new session data and access token
    const sessionData = generateSessionData(user, role);
    const newAccessToken = generateToken(sessionData);
    
    logger.info('Token refreshed', { userId: user.id, role });
    
    res.json({
      success: true,
      message: 'Token rafraîchi avec succès',
      data: {
        accessToken: newAccessToken,
        expiresIn: '24h'
      }
    });
    
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    
    if (error.message === 'Invalid refresh token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token de rafraîchissement invalide',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur de rafraîchissement du token',
      code: 'REFRESH_ERROR'
    });
  }
};

// Logout (client-side token invalidation)
const logout = async (req, res) => {
  try {
    // In a more sophisticated setup, you might maintain a blacklist of tokens
    // For now, we'll just log the logout event
    
    logger.info('User logout', { 
      userId: req.user?.id, 
      role: req.user?.role,
      email: req.user?.email 
    });
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
    
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur de déconnexion',
      code: 'LOGOUT_ERROR'
    });
  }
};

// Get current user info
const me = async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        childrenIds: user.childrenIds,
        lastLogin: user.last_login,
        permissions: user.permissions
      }
    });
    
  } catch (error) {
    logger.error('Get user info error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur de récupération des informations utilisateur',
      code: 'USER_INFO_ERROR'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe invalide',
        code: 'INVALID_PASSWORD',
        errors: passwordValidation.errors
      });
    }
    
    // Get current password hash
    const table = userRole === ROLES.DIRECTOR ? 'directors' : 'parents';
    const userResult = await query(
      `SELECT password_hash FROM ${table} WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword, 
      userResult.rows[0].password_hash
    );
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password
    await query(
      `UPDATE ${table} SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newPasswordHash, userId]
    );
    
    logger.info('Password changed', { userId, role: userRole });
    
    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
    
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur de modification du mot de passe',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
};

// Request password reset (for future implementation)
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    let userExists = false;
    
    const directorResult = await query(
      'SELECT id FROM directors WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (directorResult.rows.length === 0) {
      const parentResult = await query(
        'SELECT id FROM parents WHERE email = $1 AND is_active = true',
        [email]
      );
      userExists = parentResult.rows.length > 0;
    } else {
      userExists = true;
    }
    
    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
    });
    
    // If user exists, send reset email (implement email service)
    if (userExists) {
      logger.info('Password reset requested', { email });
      // TODO: Implement email sending service
    }
    
  } catch (error) {
    logger.error('Password reset request error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur de demande de réinitialisation',
      code: 'RESET_REQUEST_ERROR'
    });
  }
};

// Validate token (for frontend to check if token is still valid)
const validateToken = async (req, res) => {
  try {
    // If we reach here, the token is valid (middleware already verified it)
    res.json({
      success: true,
      message: 'Token valide',
      data: {
        valid: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
    
  } catch (error) {
    logger.error('Token validation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Erreur de validation du token',
      code: 'TOKEN_VALIDATION_ERROR'
    });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  me,
  changePassword,
  requestPasswordReset,
  validateToken
};
