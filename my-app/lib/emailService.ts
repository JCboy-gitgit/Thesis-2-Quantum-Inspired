import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export interface EmailRecipient {
  email: string
  name: string
  participant_number?: string
  batch_name?: string
  room?: string
  time_slot?: string
  campus?: string
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Send a single email - NEW FUNCTION ADDED
 */
export async function sendEmail(options: EmailOptions): Promise<any> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('EMAIL_USER or EMAIL_PASSWORD not configured')
  }

  try {
    const info = await transporter.sendMail({
      from: `"Qtime Scheduler" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    return info
  } catch (error: any) {
    console.error(`❌ Error sending email to ${options.to}:`, error.message)
    throw error
  }
}

/**
 * Send batch emails to multiple participants via Gmail
 */
export async function sendBatchEmails(recipients: EmailRecipient[]) {
  console.log(`\n📧 Sending ${recipients.length} emails via Gmail...`)

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not configured')
    return { success: false, error: 'Email service not configured', sent: 0, failed: recipients.length }
  }

  let sentCount = 0
  const failedEmails: Array<{ email: string; reason: string }> = []

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i]
    console.log(`\n   [${i + 1}/${recipients.length}] Sending to ${recipient.email}...`)

    try {
      await transporter.sendMail({
        from: `"Qtime Scheduler" <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: `✅ Your Schedule Confirmed: ${recipient.batch_name || 'Test'}`,
        html: generateEmailHTML(recipient),
      })

      console.log(`      ✅ Sent successfully`)
      sentCount++
    } catch (error: any) {
      console.error(`      ❌ Failed: ${error.message}`)
      failedEmails.push({ email: recipient.email, reason: error.message })
    }

    // Small delay between emails
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n✅ Complete: ${sentCount} sent, ${failedEmails.length} failed\n`)

  return {
    success: sentCount > 0,
    sent: sentCount,
    failed: failedEmails.length,
    message: `Sent ${sentCount} emails${failedEmails.length > 0 ? `, ${failedEmails.length} failed` : ''}`,
    failedList: failedEmails,
  }
}

/**
 * Send single email to a participant
 */
export async function sendBatchNotification(
  recipient: EmailRecipient,
  batchDetails: {
    batch_name: string
    room: string
    time_slot: string
    campus: string
    building?: string
  }
) {
  console.log(`\n📧 Sending batch notification to ${recipient.email}`)

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not configured')
    return { success: false, error: 'Email service not configured', id: null }
  }

  try {
    const mailInfo = await transporter.sendMail({
      from: `"Qtime Scheduler" <${process.env.EMAIL_USER}>`,
      to: recipient.email,
      subject: `📅 Test Schedule: ${batchDetails.batch_name}`,
      html: generateBatchEmailHTML(recipient, batchDetails),
    })

    console.log(`✅ Email sent (ID: ${mailInfo.messageId})`)
    return { success: true, id: mailInfo.messageId, error: null }
  } catch (error: any) {
    console.error(`❌ sendBatchNotification error: ${error.message}`)
    return { success: false, error: error?.message, id: null }
  }
}

/**
 * Send schedule emails (alias for sendBatchEmails)
 */
export async function sendScheduleEmails(recipients: EmailRecipient[]) {
  return sendBatchEmails(recipients)
}

const LOGO_SVG = `
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="40" height="40" rx="8" fill="url(#logoGradient)"/>
  
  <!-- Calendar Icon -->
  <g transform="translate(8, 6)">
    <!-- Calendar Box -->
    <rect x="0" y="4" width="24" height="20" rx="2" fill="none" stroke="white" stroke-width="1.5"/>
    
    <!-- Calendar Top Bar -->
    <rect x="0" y="4" width="24" height="4" rx="1" fill="white" opacity="0.3"/>
    
    <!-- Date Grid -->
    <circle cx="4" cy="12" r="1.5" fill="white"/>
    <circle cx="12" cy="12" r="1.5" fill="white"/>
    <circle cx="20" cy="12" r="1.5" fill="white"/>
    
    <circle cx="4" cy="18" r="1.5" fill="white"/>
    <circle cx="12" cy="18" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="20" cy="18" r="1.5" fill="white"/>
  </g>
  
  <!-- Checkmark -->
  <g transform="translate(20, 18)">
    <circle cx="0" cy="0" r="6" fill="white" opacity="0.2"/>
    <path d="M-2 0L1 3L4 -1" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`

function generateBatchEmailHTML(
  recipient: EmailRecipient,
  batch: any
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            color: #333; 
            background-color: #f5f5f5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            margin: 0;
            padding: 0;
            width: 100% !important;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 15px;
            width: 100%;
          }
          .header { 
            background-color: #28a745; 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
            border-radius: 8px; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px;
            line-height: 1.3;
            word-wrap: break-word;
          }
          .content { 
            background-color: #ffffff; 
            padding: 20px; 
            margin-top: 15px; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .content p {
            font-size: 15px;
            line-height: 1.6;
            margin: 10px 0;
          }
          .details { 
            background-color: #f8f9fa; 
            padding: 15px; 
            margin: 15px 0; 
            border-left: 4px solid #28a745;
            border-radius: 4px;
          }
          .details p { 
            margin: 10px 0;
            font-size: 14px;
            word-wrap: break-word;
          }
          .details strong {
            display: inline-block;
            min-width: 80px;
          }
          .footer { 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            margin-top: 20px;
            padding: 15px;
          }
          
          @media only screen and (max-width: 600px) {
            .container { padding: 10px; }
            .header { 
              padding: 20px 15px;
              border-radius: 6px;
            }
            .header h1 { font-size: 20px; }
            .content { 
              padding: 15px;
              margin-top: 10px;
              border-radius: 6px;
            }
            .content p { font-size: 14px; }
            .details { 
              padding: 12px;
              margin: 12px 0;
            }
            .details p { font-size: 13px; }
            .details strong { 
              display: block;
              margin-bottom: 3px;
            }
            .footer { font-size: 11px; }
          }
          
          @media only screen and (max-width: 480px) {
            .header h1 { font-size: 18px; }
            .content p { font-size: 13px; }
            .details p { font-size: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 ${batch.batch_name || 'Test Schedule'}</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${recipient.name || 'Participant'}</strong>,</p>
            
            <div class="details">
              ${batch.time_slot ? `<p><strong>Time:</strong> ${batch.time_slot}</p>` : ''}
              ${batch.room ? `<p><strong>Room:</strong> ${batch.room}</p>` : ''}
              ${batch.campus ? `<p><strong>Campus:</strong> ${batch.campus}</p>` : ''}
              ${batch.building ? `<p><strong>Building:</strong> ${batch.building}</p>` : ''}
            </div>

            <p>See you soon!</p>
          </div>

          <div class="footer">
            <p>CLA Admission Test Scheduler</p>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateEmailHTML(recipient: EmailRecipient): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            color: #333; 
            line-height: 1.6; 
            margin: 0; 
            padding: 0;
            background-color: #f5f5f5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            width: 100% !important;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #f5f5f5;
            width: 100%;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 35px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 26px; 
            font-weight: 700;
            line-height: 1.3;
            word-wrap: break-word;
          }
          .header p { 
            margin: 10px 0 0 0; 
            font-size: 14px; 
            opacity: 0.9; 
          }
          .content { 
            background-color: white; 
            padding: 30px 20px; 
            margin: 15px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
          }
          .greeting { 
            font-size: 16px; 
            margin-bottom: 15px; 
          }
          .content > p {
            font-size: 15px;
            line-height: 1.6;
            margin: 12px 0;
          }
          .details { 
            background-color: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 5px solid #667eea; 
            margin: 20px 0; 
          }
          .detail-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 0; 
            border-bottom: 1px solid #e0e0e0;
            gap: 10px;
            flex-wrap: wrap;
          }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { 
            font-weight: 700; 
            color: #667eea; 
            font-size: 14px;
            flex-shrink: 0;
          }
          .detail-value { 
            color: #333; 
            font-size: 14px; 
            font-weight: 500;
            text-align: right;
            word-wrap: break-word;
          }
          .important { 
            background-color: #fffbea; 
            padding: 18px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 5px solid #ffc107; 
          }
          .important h3 { 
            margin: 0 0 12px 0; 
            color: #ff9800; 
            font-size: 16px; 
          }
          .important ul { 
            margin: 10px 0; 
            padding-left: 20px; 
          }
          .important li { 
            margin: 8px 0; 
            font-size: 14px;
            line-height: 1.5;
          }
          .footer { 
            background-color: #2c3e50; 
            color: white; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
          }
          .footer p { 
            margin: 6px 0;
            line-height: 1.5;
          }
          
          @media only screen and (max-width: 600px) {
            .container { width: 100%; }
            .header { padding: 25px 15px; }
            .header h1 { font-size: 22px; }
            .header p { font-size: 13px; }
            .content { 
              padding: 20px 15px; 
              margin: 10px; 
              border-radius: 6px;
            }
            .greeting { font-size: 15px; }
            .content > p { font-size: 14px; }
            .details { 
              padding: 15px; 
              margin: 15px 0;
            }
            .detail-row { 
              padding: 10px 0;
              flex-direction: column;
              gap: 5px;
            }
            .detail-label { font-size: 13px; }
            .detail-value { 
              font-size: 13px;
              text-align: left;
            }
            .important { 
              padding: 15px;
              margin: 15px 0;
            }
            .important h3 { 
              font-size: 15px;
              margin-bottom: 10px;
            }
            .important ul { padding-left: 18px; }
            .important li { 
              font-size: 13px;
              margin: 6px 0;
            }
            .footer { 
              padding: 15px;
              font-size: 11px;
            }
          }
          
          @media only screen and (max-width: 480px) {
            .header { padding: 20px 12px; }
            .header h1 { font-size: 20px; }
            .header p { font-size: 12px; }
            .content { 
              padding: 15px 12px; 
              margin: 8px;
            }
            .greeting { font-size: 14px; }
            .content > p { font-size: 13px; }
            .details { 
              padding: 12px;
              border-left-width: 3px;
            }
            .detail-label { font-size: 12px; }
            .detail-value { font-size: 12px; }
            .important { 
              padding: 12px;
              border-left-width: 3px;
            }
            .important h3 { font-size: 14px; }
            .important li { font-size: 12px; }
            .footer { 
              padding: 12px;
              font-size: 10px;
            }
          }
          
          @media only screen and (max-width: 360px) {
            .header h1 { font-size: 18px; }
            .content > p { font-size: 12px; }
            .important li { font-size: 11px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Your Schedule is Confirmed!</h1>
            <p>Your admission test schedule is ready</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hi <strong>${recipient.name}</strong>,</p>
            <p>Great news! Your admission test schedule has been confirmed. Please review your details below:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📋 Participant Number:</span>
                <span class="detail-value"><strong>${recipient.participant_number || 'N/A'}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📦 Batch:</span>
                <span class="detail-value"><strong>${recipient.batch_name || 'N/A'}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏰ Test Time:</span>
                <span class="detail-value"><strong>${recipient.time_slot || 'N/A'}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🏢 Room:</span>
                <span class="detail-value"><strong>${recipient.room || 'N/A'}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🏫 Campus:</span>
                <span class="detail-value"><strong>${recipient.campus || 'N/A'}</strong></span>
              </div>
            </div>

            <div class="important">
              <h3>⚠️ Important Reminders</h3>
              <ul>
                <li><strong>Arrive Early:</strong> Come 15 minutes before your scheduled time</li>
                <li><strong>Bring ID:</strong> Valid government-issued ID required</li>
                <li><strong>No Devices:</strong> Mobile phones and electronic devices not allowed</li>
                <li><strong>Bring Supplies:</strong> Pen, pencil, and eraser required</li>
                <li><strong>Be Punctual:</strong> Latecomers may not be admitted</li>
              </ul>
            </div>

            <p>If you have any questions or need to reschedule, please contact the admissions office as soon as possible.</p>
            <p>Good luck with your test!</p>
          </div>

          <div class="footer">
            <p><strong>CLA Admission Test Scheduler</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2024 CLA State University. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `
}