# École Nid Douillet - Backend API

API backend pour le système de gestion de l'École Maternelle Nid Douillet - Maternelle Bilingue Français-Arabe située à Tilila, Agadir, Maroc.

## 🏫 À propos de l'École

École Nid Douillet est une maternelle bilingue (français-arabe) offrant un environnement d'apprentissage bienveillant pour les enfants de 3 à 6 ans. Notre système de gestion permet de suivre les inscriptions, les paiements, les services de garde, et les progrès des enfants.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+ 
- PostgreSQL 15+
- npm ou yarn

### Installation

1. **Installer les dépendances**
```bash
cd backend
npm install
```

2. **Configuration de l'environnement**
```bash
cp ../.env.example .env
# Éditer le fichier .env avec vos configurations
```

3. **Configuration de la base de données**
```bash
# Créer la base de données PostgreSQL
createdb ecole_nid_douillet

# Exécuter le script de setup
psql -d ecole_nid_douillet -f ../database/scripts/setup.sql
```

4. **Démarrer le serveur**
```bash
# Développement
npm run dev

# Production
npm start
```

Le serveur démarre sur `http://localhost:3000`

## 📚 Documentation API

- **Swagger UI**: `http://localhost:3000/api/docs` (développement uniquement)
- **Health Check**: `http://localhost:3000/health`
- **API JSON**: `http://localhost:3000/api/docs.json`

## 🔐 Authentification

### Rôles utilisateur

- **DIRECTOR**: Accès complet à toutes les fonctionnalités
- **PARENT**: Accès restreint aux informations de leurs enfants

### Endpoints d'authentification

```bash
# Connexion
POST /api/auth/login
{
  "email": "director@niddouillet.ma",
  "password": "EcoleNidDouillet2024!"
}

# Rafraîchir le token
POST /api/auth/refresh
{
  "refreshToken": "..."
}

# Informations utilisateur
GET /api/auth/me
Authorization: Bearer <token>

# Déconnexion
POST /api/auth/logout
Authorization: Bearer <token>

# Changer le mot de passe
POST /api/auth/change-password
Authorization: Bearer <token>
{
  "currentPassword": "...",
  "newPassword": "..."
}
```

### Compte par défaut

Un compte directeur par défaut est créé lors de l'initialisation :
- **Email**: `director@niddouillet.ma`
- **Mot de passe**: `EcoleNidDouillet2024!`

⚠️ **Important**: Changez ce mot de passe après la première connexion !

## 🏗️ Architecture

### Structure du projet

```
backend/
├── src/
│   ├── config/          # Configuration (DB, auth, etc.)
│   ├── controllers/     # Contrôleurs API
│   ├── middleware/      # Middlewares (auth, validation, etc.)
│   ├── routes/          # Définition des routes
│   ├── services/        # Logique métier
│   ├── models/          # Modèles de données
│   ├── utils/           # Fonctions utilitaires
│   ├── app.js           # Application Express
│   └── server.js        # Point d'entrée
├── tests/               # Tests unitaires et d'intégration
├── docs/                # Documentation
└── package.json
```

### Technologies utilisées

- **Framework**: Express.js
- **Base de données**: PostgreSQL avec pool de connexions
- **Authentification**: JWT avec refresh tokens
- **Validation**: Joi
- **Sécurité**: Helmet, CORS, rate limiting
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Tests**: Jest + Supertest

## 🔧 Configuration

### Variables d'environnement

Copiez `.env.example` vers `.env` et configurez :

```env
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecole_nid_douillet
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Email (Gmail API)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone

# École
SCHOOL_NAME=École Maternelle Nid Douillet
SCHOOL_EMAIL=contact@niddouillet.ma
SCHOOL_PHONE=+212 5 28 XX XX XX
```

## 📊 Logique métier École Nid Douillet

### Année académique
- **Période**: 1er septembre au 30 juin
- **Calcul d'âge**: Basé sur le 31 décembre de l'année académique
- **Niveaux**: Petite Section (3 ans), Moyenne Section (4 ans), Grande Section (5 ans)

### Paiements
- **Mapping**: Paiements juillet/août → septembre académique
- **Devise**: Dirham marocain (MAD)
- **Frais**: Scolarité, inscription, services de garde

### Services de garde
- **Matin**: 7h30-8h30
- **Midi**: 12h00-14h00  
- **Mercredi**: 12h00-18h00
- **Soir**: 16h30-18h00

*Note: Supervision uniquement, pas de repas fournis*

## 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:coverage

# Tests d'intégration
npm run test:integration

# Tests en mode watch
npm run test:watch
```

## 📝 Scripts disponibles

```bash
npm run dev          # Démarrage développement avec nodemon
npm start            # Démarrage production
npm test             # Tests unitaires
npm run test:watch   # Tests en mode watch
npm run lint         # Vérification ESLint
npm run lint:fix     # Correction automatique ESLint
npm run docs         # Génération documentation
```

## 🔒 Sécurité

### Mesures implémentées

- **Authentification JWT** avec refresh tokens
- **Rate limiting** par endpoint
- **Validation stricte** des entrées
- **Headers de sécurité** (Helmet)
- **CORS configuré** pour les domaines autorisés
- **Hachage sécurisé** des mots de passe (bcrypt)
- **Logging des événements** de sécurité

### Conformité RGPD

- **Chiffrement** des données sensibles
- **Audit trail** des accès aux données
- **Gestion des consentements** (à implémenter)
- **Droit à l'oubli** (à implémenter)

## 🚀 Déploiement

### Développement

```bash
npm run dev
```

### Production

```bash
# Build et démarrage
npm start

# Avec PM2
pm2 start ecosystem.config.js
```

### Docker

```bash
# Build de l'image
docker build -t ecole-nid-douillet-api .

# Démarrage avec docker-compose
docker-compose up -d
```

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

Les logs sont disponibles dans :
- Console (développement)
- Fichiers `logs/` (production)
- Système de monitoring externe (à configurer)

## 🤝 Contribution

### Standards de code

- **ESLint** pour la qualité du code
- **Prettier** pour le formatage
- **Conventional Commits** pour les messages de commit
- **Tests obligatoires** pour les nouvelles fonctionnalités

### Workflow

1. Fork du projet
2. Création d'une branche feature
3. Développement avec tests
4. Pull request avec description détaillée

## 📞 Support

### Contact École Nid Douillet

- **Email**: contact@niddouillet.ma
- **Téléphone**: +212 5 28 XX XX XX
- **Adresse**: Tilila, Agadir, Maroc

### Support technique

- **Issues GitHub**: Pour les bugs et demandes de fonctionnalités
- **Documentation**: Consultez `/api/docs` en développement
- **Email support**: dev@niddouillet.ma

## 📄 Licence

MIT License - Voir le fichier [LICENSE](../LICENSE) pour plus de détails.

---

**École Maternelle Nid Douillet** - *Un environnement bienveillant pour l'épanouissement de votre enfant* 🌟
