# cPanel Deployment Tutorial Script

## Video Tutorial: Deploy Self-Hosted Temp Email on cPanel

**Duration:** ~15 minutes
**Difficulty:** Beginner-friendly

---

## INTRO (0:00 - 0:30)

**[Screen: Title card with logo]**

**Narrator:**
"Welcome! In this tutorial, I'll show you exactly how to deploy your self-hosted temporary email system on any shared hosting with cPanel. By the end, you'll have a fully working temp email service on your own domain. Let's get started!"

---

## PART 1: REQUIREMENTS CHECK (0:30 - 1:30)

**[Screen: cPanel dashboard]**

**Narrator:**
"First, let's make sure your hosting meets the requirements. Log into your cPanel and check these things:"

**[Show: PHP Selector]**

1. "Go to 'Select PHP Version' - you need PHP 8.0 or higher. I recommend PHP 8.1."
2. "Make sure these extensions are enabled: pdo_mysql, openssl, json, mbstring, imap, and curl."
3. "Click 'Save' if you made any changes."

**[Show: MySQL version in phpMyAdmin]**

4. "Your hosting should have MySQL 8.0. Most modern hosts do."

---

## PART 2: DATABASE SETUP (1:30 - 4:00)

**[Screen: cPanel > MySQL Databases]**

**Narrator:**
"Now let's create the database. Go to 'MySQL Databases' in cPanel."

**Step 1: Create Database**
- "Type a name for your database, like 'tempemail'"
- "Click 'Create Database'"

**Step 2: Create User**
- "Scroll down to 'MySQL Users'"
- "Enter a username and generate a strong password"
- "Click 'Create User'"
- "IMPORTANT: Copy this password - you'll need it later!"

**Step 3: Add User to Database**
- "In 'Add User to Database', select your user and database"
- "Click 'Add'"
- "Check 'ALL PRIVILEGES' and click 'Make Changes'"

**[Screen: phpMyAdmin]**

**Step 4: Import Schema**
- "Now open phpMyAdmin from cPanel"
- "Click on your database on the left"
- "Go to the 'Import' tab"
- "Click 'Choose File' and select `schema.mysql.sql` from the self-hosted/database folder"
- "Click 'Go' at the bottom"
- "Wait for the import to complete - you should see a success message"

**Step 5: Import Seed Data**
- "Click 'Import' again"
- "This time, import `seed-data.sql`"
- "This adds your default domains and settings"

---

## PART 3: UPLOAD FILES (4:00 - 6:00)

**[Screen: cPanel > File Manager]**

**Narrator:**
"Time to upload the files. Open 'File Manager' in cPanel."

**Step 1: Navigate to public_html**
- "Click on 'public_html' - this is your website's root folder"

**Step 2: Upload API Files**
- "Create a new folder called 'api'"
- "Open the 'api' folder"
- "Click 'Upload' and upload all files from `self-hosted/api/`"
- "Make sure to preserve the folder structure - upload the entire contents"

**Step 3: Upload Uploads Folder**
- "Go back to public_html"
- "Create folder 'uploads'"
- "Inside uploads, create 'attachments', 'avatars', and 'backups' folders"

**Step 4: Configure API**
- "In the api folder, find 'config.example.php'"
- "Right-click and select 'Copy'"
- "Name the copy 'config.php'"
- "Right-click 'config.php' and click 'Edit'"

**[Screen: Editing config.php]**

"Update these settings:
- Database host: usually 'localhost'
- Database name: your database name
- Database username: the user you created
- Database password: the password you saved
- App URL: your domain like 'https://yourdomain.com'
- Generate a random JWT secret - I use a password generator
- Generate another random encryption key
- Update IMAP settings with your email server details"

"Save and close the file."

---

## PART 4: BUILD & UPLOAD FRONTEND (6:00 - 8:30)

**[Screen: Terminal/VS Code]**

**Narrator:**
"Now let's build the frontend. Open the self-hosted/frontend folder in your terminal."

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env - set VITE_API_URL=/api

# Build for production
npm run build
```

**[Screen: cPanel File Manager]**

"The build creates a 'dist' folder. Upload everything inside 'dist' to your public_html folder."

- "Upload index.html"
- "Upload the assets folder"
- "Upload any other files in dist"

**Step 5: Upload .htaccess**
- "From self-hosted folder, upload the .htaccess file to public_html"
- "This handles routing for the React app"

---

## PART 5: SET PERMISSIONS (8:30 - 9:30)

**[Screen: cPanel File Manager]**

**Narrator:**
"Let's set the correct file permissions."

**For uploads folder:**
- "Right-click the 'uploads' folder"
- "Select 'Change Permissions'"
- "Set to 755 for the folder"
- "The api/config.php should be 644 - readable but not publicly accessible"

**Verify .htaccess:**
- "Make sure the .htaccess file in the api folder is uploaded"
- "This protects your config.php from direct access"

---

## PART 6: SETUP CRON JOB (9:30 - 11:00)

**[Screen: cPanel > Cron Jobs]**

**Narrator:**
"The cron job is what fetches emails from your mail server. Go to 'Cron Jobs' in cPanel."

**Add IMAP Polling Cron:**
- "Set timing to 'Every 2 minutes': put `*/2` in minute, and `*` in all others"
- "For the command, enter:"

```
/usr/bin/php /home/YOURUSERNAME/public_html/api/imap/poll.php >> /home/YOURUSERNAME/logs/imap.log 2>&1
```

- "Replace YOURUSERNAME with your actual cPanel username"
- "Click 'Add New Cron Job'"

**Add Cleanup Cron:**
- "Add another cron for daily cleanup at 3 AM:"
- "Set minute to 0, hour to 3, and `*` for day, month, weekday"

```
/usr/bin/php /home/YOURUSERNAME/public_html/api/cron/cleanup.php >> /home/YOURUSERNAME/logs/cleanup.log 2>&1
```

---

## PART 7: EMAIL SERVER SETUP (11:00 - 13:00)

**[Screen: cPanel > Email Accounts]**

**Narrator:**
"For receiving emails, you need to set up a catch-all email."

**Option A: Use cPanel Email (Simple)**

1. "Go to 'Email Accounts' and create an email like `catchall@yourdomain.com`"
2. "Go to 'Default Address' (Email Routing)"
3. "Set it to forward all unrouted emails to your catchall account"
4. "Update your config.php with the IMAP settings:
   - Host: mail.yourdomain.com
   - Port: 993
   - Username: catchall@yourdomain.com
   - Password: the email account password"

**Option B: Use External Service (Advanced)**

"Alternatively, use a service like Mailgun or SendGrid with webhooks for instant delivery."

---

## PART 8: TEST YOUR SETUP (13:00 - 14:30)

**[Screen: Browser showing the website]**

**Narrator:**
"Let's test everything!"

1. "Visit your domain - you should see the temp email homepage"
2. "Click 'Generate Email' - a new temporary email should be created"
3. "Copy that email address"
4. "Send a test email to it from your personal email"
5. "Wait 2-3 minutes for the cron job to run"
6. "Refresh the inbox - your email should appear!"

**If something doesn't work:**
- "Check the cron logs in your logs folder"
- "Enable debug mode in config.php to see detailed errors"
- "Verify your IMAP credentials are correct"

---

## PART 9: FIRST ADMIN SETUP (14:30 - 15:00)

**[Screen: Website registration page]**

**Narrator:**
"Finally, let's set up your admin account."

1. "Register a new account on your site"
2. "Go to phpMyAdmin"
3. "Find the user_roles table"
4. "Insert a new row with your user_id and role 'admin'"
5. "Now you have full admin access!"

---

## OUTRO (15:00 - 15:30)

**[Screen: Completed website]**

**Narrator:**
"Congratulations! You now have a fully self-hosted temporary email service running on your own domain. 

Here's what to do next:
- Add more domains in the admin panel
- Customize the appearance
- Set up SSL if you haven't already
- Consider upgrading to a VPS for higher traffic

Thanks for watching! If you found this helpful, give it a thumbs up and subscribe for more tutorials."

---

## TROUBLESHOOTING APPENDIX

**Common Issues:**

1. **500 Error on API calls**
   - Check PHP error logs in cPanel
   - Verify config.php syntax is correct
   - Ensure all required PHP extensions are enabled

2. **Emails not appearing**
   - Check cron job is running (look for recent log entries)
   - Verify IMAP credentials in config.php
   - Make sure catch-all is properly configured

3. **"Class not found" errors**
   - File paths may be wrong - check they match your folder structure
   - PHP version might be too old - upgrade to 8.0+

4. **CORS errors in browser**
   - Check .htaccess files are uploaded correctly
   - Verify API URL in frontend .env matches your setup

5. **Can't login**
   - Clear browser cache and cookies
   - Check sessions table in database
   - Verify JWT secret in config.php is set
