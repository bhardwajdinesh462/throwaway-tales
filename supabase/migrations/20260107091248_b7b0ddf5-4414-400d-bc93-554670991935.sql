-- Add stats_widget section to homepage_sections
INSERT INTO homepage_sections (section_key, content, is_enabled, display_order)
VALUES (
  'stats_widget',
  '{
    "showEmailsToday": true,
    "showEmailsGenerated": true,
    "showInboxesCreated": true,
    "showDomains": true,
    "customLabels": {
      "emailsToday": "Today (IST)",
      "emailsGenerated": "Emails Generated",
      "inboxesCreated": "Inboxes Created",
      "domains": "Domains"
    },
    "layout": "horizontal"
  }'::jsonb,
  true,
  2
)
ON CONFLICT (section_key) DO NOTHING;