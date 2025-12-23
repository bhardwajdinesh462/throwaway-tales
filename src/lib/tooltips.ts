// Centralized tooltip messages for the application

export const tooltips = {
  // Homepage elements
  emailGenerator: {
    copy: "Copy email address to clipboard",
    refresh: "Generate a new random email address",
    custom: "Create a custom email with your own username",
    save: "Save this email to your account (requires login)",
    sound: "Toggle sound notifications for new emails",
    qrCode: "Show QR code to share this email",
    domain: "Select a different email domain",
    timer: "Time remaining before this email expires",
  },
  
  // Stats widget
  stats: {
    emailsToday: "Number of emails received in the last 24 hours",
    emailsGenerated: "Total emails created since the service started",
    activeInboxes: "Currently active temporary email addresses",
    domains: "Number of available email domains",
  },
  
  // Inbox
  inbox: {
    refresh: "Check for new emails",
    markRead: "Mark this email as read",
    delete: "Delete this email permanently",
    download: "Download email attachments",
    reply: "Reply to this email (premium feature)",
  },
  
  // Admin panel - Dashboard
  admin: {
    dashboard: {
      totalUsers: "Total registered users in the system",
      activeEmails: "Currently active temporary email addresses",
      emailsToday: "Emails created in the last 24 hours",
      revenue: "Monthly subscription revenue",
    },
    
    // Settings
    settings: {
      save: "Save changes to this setting",
      reset: "Reset to default values",
      test: "Test this configuration",
    },
    
    // User management
    users: {
      suspend: "Suspend user account - they won't be able to login",
      delete: "Permanently delete user and all their data",
      promote: "Promote user to admin role",
      demote: "Remove admin privileges from user",
    },
    
    // Domains
    domains: {
      add: "Add a new email domain",
      activate: "Enable this domain for email creation",
      deactivate: "Disable this domain temporarily",
      premium: "Mark as premium domain (premium users only)",
    },
    
    // Email settings
    email: {
      smtp: "SMTP server for sending emails",
      imap: "IMAP server for receiving emails",
      testConnection: "Test connection to mail server",
    },
    
    // Backup
    backup: {
      download: "Download complete database backup to your device",
      schedule: "Set automatic backup schedule",
      history: "View previous backup history",
      warning: "Backups auto-delete after 24 hours",
    },
    
    // Friendly sites
    friendlySites: {
      add: "Add a new friendly website link",
      reorder: "Drag to reorder website display",
      toggle: "Toggle visibility of this website",
      settings: "Configure sidebar widget appearance",
    },
    
    // General
    general: {
      siteName: "Name displayed in browser tab and header",
      logo: "Upload your site logo",
      favicon: "Small icon shown in browser tab",
      timezone: "Default timezone for the application",
    },
    
    // Appearance
    appearance: {
      theme: "Select the default color theme",
      darkMode: "Enable/disable dark mode by default",
      customCSS: "Add custom CSS styles",
    },
    
    // SEO
    seo: {
      metaTitle: "Title shown in search engine results",
      metaDescription: "Description shown in search results",
      keywords: "Keywords for search engine optimization",
      robots: "Search engine indexing instructions",
    },
  },
  
  // User profile
  profile: {
    avatar: "Upload a new profile picture",
    displayName: "Your display name shown to others",
    email: "Your account email address",
    password: "Change your account password",
    twoFactor: "Enable two-factor authentication for extra security",
    delete: "Permanently delete your account and all data",
  },
  
  // Pricing
  pricing: {
    monthly: "Pay month-to-month, cancel anytime",
    yearly: "Pay annually and save 20%",
    compare: "Compare features between plans",
  },
};

export default tooltips;
