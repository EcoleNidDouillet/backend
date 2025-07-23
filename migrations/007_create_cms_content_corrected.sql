-- École Nid Douillet - CMS Content Table Migration (Corrected for UUID)
-- Content Management System for public website

-- Create CMS content table with UUID for created_by to match directors table
CREATE TABLE IF NOT EXISTS cms_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('page', 'post', 'news', 'announcement')),
    language VARCHAR(2) NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'ar')),
    excerpt TEXT,
    content TEXT NOT NULL,
    meta_title VARCHAR(60),
    meta_description VARCHAR(160),
    featured_image TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_published BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES directors(id) -- Use UUID to match directors table
);

-- Create unique constraint on slug and language combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_content_slug_language 
ON cms_content(slug, language);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cms_content_published 
ON cms_content(is_published, published_at DESC) WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_cms_content_type 
ON cms_content(content_type, language, is_published);

CREATE INDEX IF NOT EXISTS idx_cms_content_display_order 
ON cms_content(display_order, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_cms_content_tags 
ON cms_content USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_cms_content_language 
ON cms_content(language, is_published);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cms_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cms_content_updated_at ON cms_content;
CREATE TRIGGER trigger_update_cms_content_updated_at
    BEFORE UPDATE ON cms_content
    FOR EACH ROW
    EXECUTE FUNCTION update_cms_content_updated_at();

-- Get the first director's UUID for sample content
DO $$
DECLARE
    director_uuid UUID;
BEGIN
    -- Get the first director's UUID
    SELECT id INTO director_uuid FROM directors LIMIT 1;
    
    -- Insert default content for École Nid Douillet
    INSERT INTO cms_content (
        title, slug, content_type, language, excerpt, content, 
        meta_title, meta_description, is_published, display_order, created_by
    ) VALUES 
    -- Home page content
    (
        'Bienvenue à l''École Nid Douillet',
        'accueil',
        'page',
        'fr',
        'École maternelle bilingue français-arabe située à Tilila, Agadir. Un environnement chaleureux et bienveillant pour l''épanouissement de votre enfant.',
        '<div class="hero-section">
            <h1>Bienvenue à l''École Nid Douillet</h1>
            <p class="lead">Une école maternelle bilingue français-arabe qui offre un environnement chaleureux et bienveillant pour l''épanouissement de votre enfant.</p>
            
            <h2>Notre Mission</h2>
            <p>À l''École Nid Douillet, nous nous engageons à fournir une éducation de qualité qui respecte les valeurs culturelles marocaines tout en préparant nos enfants à un avenir multilingue et multiculturel.</p>
            
            <h2>Nos Valeurs</h2>
            <ul>
                <li><strong>Bienveillance</strong> : Un environnement sécurisé et aimant</li>
                <li><strong>Excellence</strong> : Une éducation de qualité supérieure</li>
                <li><strong>Diversité</strong> : Célébration des cultures française et arabe</li>
                <li><strong>Innovation</strong> : Méthodes pédagogiques modernes</li>
            </ul>
            
            <h2>Pourquoi Choisir l''École Nid Douillet ?</h2>
            <div class="features">
                <div class="feature">
                    <h3>Éducation Bilingue</h3>
                    <p>Apprentissage équilibré du français et de l''arabe dès le plus jeune âge.</p>
                </div>
                <div class="feature">
                    <h3>Équipe Qualifiée</h3>
                    <p>Enseignants expérimentés et passionnés par l''éducation de la petite enfance.</p>
                </div>
                <div class="feature">
                    <h3>Environnement Sécurisé</h3>
                    <p>Locaux modernes et sécurisés adaptés aux besoins des jeunes enfants.</p>
                </div>
            </div>
        </div>',
        'École Nid Douillet - Maternelle Bilingue Agadir',
        'École maternelle bilingue français-arabe à Tilila, Agadir. Éducation de qualité dans un environnement bienveillant.',
        true,
        1,
        director_uuid
    ),

    -- About page
    (
        'À Propos de l''École Nid Douillet',
        'a-propos',
        'page',
        'fr',
        'Découvrez l''histoire, la philosophie et l''équipe de l''École Nid Douillet, votre partenaire dans l''éducation de votre enfant.',
        '<div class="about-section">
            <h1>À Propos de l''École Nid Douillet</h1>
            
            <h2>Notre Histoire</h2>
            <p>Fondée en 2024, l''École Nid Douillet est née de la vision de créer un espace éducatif unique à Agadir, alliant excellence pédagogique et respect des valeurs culturelles marocaines.</p>
            
            <h2>Notre Philosophie Éducative</h2>
            <p>Nous croyons que chaque enfant est unique et possède un potentiel extraordinaire. Notre approche pédagogique s''appuie sur :</p>
            <ul>
                <li>Le respect du rythme de développement de chaque enfant</li>
                <li>L''apprentissage par le jeu et l''exploration</li>
                <li>Le développement de l''autonomie et de la confiance en soi</li>
                <li>La valorisation de la diversité culturelle et linguistique</li>
            </ul>
            
            <h2>Nos Programmes</h2>
            <h3>Petite Section (2-3 ans)</h3>
            <p>Adaptation en douceur à la vie scolaire avec un focus sur la socialisation et les activités sensorielles.</p>
            
            <h3>Moyenne Section (3-4 ans)</h3>
            <p>Développement du langage, initiation à l''écriture et renforcement des compétences sociales.</p>
            
            <h3>Grande Section (4-5 ans)</h3>
            <p>Préparation à l''école primaire avec l''apprentissage de la lecture et des mathématiques de base.</p>
            
            <h2>Nos Installations</h2>
            <p>L''école dispose de :</p>
            <ul>
                <li>Salles de classe spacieuses et lumineuses</li>
                <li>Cour de récréation sécurisée</li>
                <li>Bibliothèque bilingue</li>
                <li>Salle de motricité</li>
                <li>Espace de restauration</li>
            </ul>
        </div>',
        'À Propos - École Nid Douillet',
        'Découvrez l''École Nid Douillet : notre histoire, philosophie éducative et programmes pour enfants de 2 à 5 ans.',
        true,
        2,
        director_uuid
    ),

    -- Contact page
    (
        'Contactez-nous',
        'contact',
        'page',
        'fr',
        'Prenez contact avec l''École Nid Douillet pour toute information ou pour planifier une visite.',
        '<div class="contact-section">
            <h1>Contactez l''École Nid Douillet</h1>
            
            <div class="contact-info">
                <h2>Informations de Contact</h2>
                <div class="contact-details">
                    <div class="contact-item">
                        <h3>Adresse</h3>
                        <p>Tilila, Agadir<br>Maroc</p>
                    </div>
                    
                    <div class="contact-item">
                        <h3>Téléphone</h3>
                        <p>+212 668 78 63 68</p>
                    </div>
                    
                    <div class="contact-item">
                        <h3>Email</h3>
                        <p>contact@ecoleniddouillet.com</p>
                    </div>
                    
                    <div class="contact-item">
                        <h3>Horaires d''ouverture</h3>
                        <p>Lundi - Vendredi : 8h00 - 17h00<br>
                        Samedi : 8h00 - 12h00</p>
                    </div>
                </div>
            </div>
            
            <div class="visit-section">
                <h2>Planifier une Visite</h2>
                <p>Nous vous invitons à visiter notre école pour découvrir nos installations et rencontrer notre équipe pédagogique.</p>
                <p>Pour planifier une visite, veuillez nous contacter par téléphone ou par email. Nous serons ravis de vous accueillir et de répondre à toutes vos questions.</p>
            </div>
            
            <div class="enrollment-section">
                <h2>Inscriptions</h2>
                <p>Les inscriptions pour l''année scolaire 2024-2025 sont ouvertes. N''hésitez pas à nous contacter pour obtenir le dossier d''inscription et connaître les modalités.</p>
                
                <h3>Documents requis :</h3>
                <ul>
                    <li>Certificat de naissance</li>
                    <li>Certificat médical</li>
                    <li>Photos d''identité</li>
                    <li>Justificatif de domicile</li>
                </ul>
            </div>
        </div>',
        'Contact - École Nid Douillet',
        'Contactez l''École Nid Douillet à Agadir. Informations, visites et inscriptions pour votre enfant.',
        true,
        3,
        director_uuid
    ),

    -- News announcement
    (
        'Ouverture des Inscriptions 2024-2025',
        'inscriptions-2024-2025',
        'news',
        'fr',
        'Les inscriptions pour l''année scolaire 2024-2025 sont maintenant ouvertes. Découvrez comment inscrire votre enfant.',
        '<div class="news-article">
            <h1>Ouverture des Inscriptions pour l''Année Scolaire 2024-2025</h1>
            
            <p class="news-date">Publié le 15 mars 2024</p>
            
            <p>Nous avons le plaisir de vous annoncer l''ouverture des inscriptions pour l''année scolaire 2024-2025 à l''École Nid Douillet.</p>
            
            <h2>Informations Importantes</h2>
            <ul>
                <li><strong>Période d''inscription :</strong> Du 15 mars au 31 juillet 2024</li>
                <li><strong>Âges acceptés :</strong> Enfants nés entre 2019 et 2022</li>
                <li><strong>Nombre de places limitées :</strong> 60 places au total</li>
            </ul>
            
            <h2>Procédure d''Inscription</h2>
            <ol>
                <li>Contactez-nous pour obtenir le dossier d''inscription</li>
                <li>Remplissez le dossier complet</li>
                <li>Planifiez un rendez-vous pour déposer le dossier</li>
                <li>Participez à l''entretien avec la direction</li>
                <li>Confirmation d''inscription sous 48h</li>
            </ol>
            
            <h2>Frais de Scolarité</h2>
            <p>Les frais de scolarité pour l''année 2024-2025 sont disponibles sur demande. Nous proposons plusieurs modalités de paiement pour faciliter l''accès à notre école.</p>
            
            <p><strong>Pour plus d''informations, contactez-nous au +212 668 78 63 68 ou par email à contact@ecoleniddouillet.com</strong></p>
        </div>',
        'Inscriptions 2024-2025 - École Nid Douillet',
        'Inscriptions ouvertes pour l''année scolaire 2024-2025 à l''École Nid Douillet. Places limitées.',
        true,
        0,
        director_uuid
    ),

    -- Draft content examples
    (
        'Activités Extrascolaires',
        'activites-extrascolaires',
        'page',
        'fr',
        'Découvrez nos activités extrascolaires : arts, musique, sport et éveil culturel.',
        '<h1>Activités Extrascolaires</h1><p>Contenu en cours de rédaction...</p>',
        '',
        '',
        false,
        4,
        director_uuid
    ),
    (
        'Événement Portes Ouvertes',
        'portes-ouvertes-2024',
        'announcement',
        'fr',
        'Venez découvrir l''École Nid Douillet lors de nos portes ouvertes.',
        '<h1>Portes Ouvertes 2024</h1><p>Détails à venir...</p>',
        '',
        '',
        false,
        0,
        director_uuid
    );
END $$;

-- Create website analytics table for tracking
CREATE TABLE IF NOT EXISTS website_analytics (
    id SERIAL PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    page_title VARCHAR(255),
    visitor_ip INET,
    user_agent TEXT,
    referrer TEXT,
    session_id VARCHAR(100),
    visit_duration INTEGER, -- in seconds
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    language VARCHAR(2) DEFAULT 'fr'
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_website_analytics_page_path 
ON website_analytics(page_path, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_analytics_session 
ON website_analytics(session_id, visited_at);

CREATE INDEX IF NOT EXISTS idx_website_analytics_date 
ON website_analytics(visited_at DESC);

-- Create function to track page views
CREATE OR REPLACE FUNCTION track_page_view(
    p_page_path VARCHAR(255),
    p_page_title VARCHAR(255) DEFAULT NULL,
    p_visitor_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_session_id VARCHAR(100) DEFAULT NULL,
    p_language VARCHAR(2) DEFAULT 'fr'
)
RETURNS INTEGER AS $$
DECLARE
    analytics_id INTEGER;
BEGIN
    INSERT INTO website_analytics (
        page_path, page_title, visitor_ip, user_agent, 
        referrer, session_id, language
    ) VALUES (
        p_page_path, p_page_title, p_visitor_ip, p_user_agent,
        p_referrer, p_session_id, p_language
    ) RETURNING id INTO analytics_id;
    
    RETURN analytics_id;
END;
$$ LANGUAGE plpgsql;
