-- Migration: Create notifications table for École Nid Douillet
-- Description: Table to store notification history for email and SMS communications

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(10) NOT NULL CHECK (type IN ('EMAIL', 'SMS')),
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
        'welcome', 'payment_reminder', 'payment_overdue', 
        'payment_confirmation', 'general_announcement'
    )),
    subject VARCHAR(255) NOT NULL,
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    external_id VARCHAR(255), -- Message ID from email/SMS provider
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_recipient ON notifications(recipient);
CREATE INDEX idx_notifications_template_type ON notifications(template_type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Create composite indexes for common query patterns
CREATE INDEX idx_notifications_type_status ON notifications(type, status);
CREATE INDEX idx_notifications_recipient_sent_at ON notifications(recipient, sent_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores notification history for email and SMS communications';
COMMENT ON COLUMN notifications.type IS 'Type of notification: EMAIL or SMS';
COMMENT ON COLUMN notifications.recipient IS 'Email address or phone number of recipient';
COMMENT ON COLUMN notifications.template_type IS 'Template used for the notification';
COMMENT ON COLUMN notifications.subject IS 'Subject line for email or SMS title';
COMMENT ON COLUMN notifications.content IS 'Full content/data sent in the notification';
COMMENT ON COLUMN notifications.status IS 'Delivery status: PENDING, SENT, or FAILED';
COMMENT ON COLUMN notifications.external_id IS 'Message ID from external service (Nodemailer, Twilio)';
COMMENT ON COLUMN notifications.error_message IS 'Error message if delivery failed';
COMMENT ON COLUMN notifications.sent_at IS 'Timestamp when notification was sent';

-- Insert initial data or configuration if needed
-- (No initial data required for notifications table)
