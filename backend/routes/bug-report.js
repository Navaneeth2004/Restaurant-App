'use strict';

const express = require('express');
const router  = express.Router();

/**
 * POST /api/bug-report
 * Accepts a structured bug report and emails it to BUG_REPORT_EMAIL.
 * Uses nodemailer with SMTP from env vars — falls back to console log
 * if nodemailer is not installed (graceful degradation).
 */
router.post('/', async (req, res) => {
  const {
    title,
    description,
    steps,
    severity,
    category,
    diagnostics,   // auto-collected client data
    screenshot,    // optional base64 PNG
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const to = process.env.BUG_REPORT_EMAIL;
  if (!to) {
    console.warn('[BugReport] BUG_REPORT_EMAIL not set in env — logging report only');
    console.log('[BugReport]', JSON.stringify({ title, description, steps, severity, category, diagnostics }, null, 2));
    return res.json({ success: true, note: 'Email not configured — report logged to console' });
  }

  const timestamp = new Date().toISOString();
  const d = diagnostics || {};

  // ── Build rich HTML email ─────────────────────────────────────────────
  const severityColor = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#f59e0b',
    low:      '#6b7280',
  }[severity] || '#6b7280';

  const stepsHtml = Array.isArray(steps) && steps.length
    ? `<ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">${steps.map(s => `<li style="margin-bottom:4px">${escHtml(s)}</li>`).join('')}</ol>`
    : '<p style="color:#9ca3af;font-size:13px;margin:0">No steps provided</p>';

  const errorsHtml = Array.isArray(d.consoleErrors) && d.consoleErrors.length
    ? `<div style="background:#1f1f23;border-radius:8px;padding:12px;margin-top:8px;overflow-x:auto"><pre style="margin:0;color:#f87171;font-size:12px;font-family:monospace;white-space:pre-wrap">${escHtml(d.consoleErrors.join('\n'))}</pre></div>`
    : '<p style="color:#9ca3af;font-size:13px;margin:0">No errors captured</p>';

  const netHtml = d.network ? `
    <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Connection Type</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.network.effectiveType || 'unknown')}</td></tr>
    <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Downlink</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.network.downlink || 'unknown'))} Mbps</td></tr>
    <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">RTT</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.network.rtt || 'unknown'))} ms</td></tr>
  ` : '';

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Bug Report: ${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">

  <!-- Header -->
  <div style="background:#18181b;padding:24px 28px 20px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <span style="display:inline-flex;align-items:center;gap:6px;background:${severityColor}22;border:1px solid ${severityColor}55;color:${severityColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:3px 10px;border-radius:99px">
        ${escHtml(severity || 'unknown')}
      </span>
      <span style="display:inline-flex;background:#27272a;color:#a1a1aa;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px">
        ${escHtml(category || 'general')}
      </span>
    </div>
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 4px">${escHtml(title)}</h1>
    <p style="color:#71717a;font-size:12px;margin:0">Submitted ${new Date(timestamp).toLocaleString('en-IN', { dateStyle:'long', timeStyle:'short' })} · Restaurant POS</p>
  </div>

  <!-- Description -->
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 10px">Description</h2>
    <p style="color:#111827;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap">${escHtml(description)}</p>
  </div>

  <!-- Steps to reproduce -->
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 10px">Steps to Reproduce</h2>
    ${stepsHtml}
  </div>

  <!-- App context -->
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 12px">App Context</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0;width:160px">Active View</td><td style="font-size:12px;padding:4px 8px;font-weight:600;color:#111827">${escHtml(d.appContext?.currentView || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">User Role</td><td style="font-size:12px;padding:4px 8px;font-weight:600;color:#111827">${escHtml(d.appContext?.userRole || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">User Name</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.appContext?.userName || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Selected Table</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.appContext?.selectedTable || 'none')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Session Duration</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.appContext?.sessionDuration || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Page URL</td><td style="font-size:12px;padding:4px 8px;word-break:break-all">${escHtml(d.appContext?.url || 'unknown')}</td></tr>
    </table>
  </div>

  <!-- Device & browser -->
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 12px">Device &amp; Browser</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0;width:160px">Browser</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.browser || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Browser Version</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.browserVersion || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Operating System</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.os || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Device Type</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.type || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Screen</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.screen || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Viewport</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.viewport || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Touch Support</td><td style="font-size:12px;padding:4px 8px">${d.device?.touch ? 'Yes' : 'No'}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Timezone</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.timezone || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Language</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.language || 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Memory</td><td style="font-size:12px;padding:4px 8px">${escHtml(d.device?.memory ? d.device.memory + ' GB' : 'unknown')}</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">CPU Cores</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.device?.cores || 'unknown'))}</td></tr>
      ${netHtml}
    </table>
  </div>

  <!-- Console errors -->
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 10px">Captured Console Errors</h2>
    ${errorsHtml}
  </div>

  <!-- Performance -->
  ${d.performance ? `
  <div style="padding:24px 28px;border-bottom:1px solid #e5e7eb">
    <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;margin:0 0 12px">Performance</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0;width:160px">Page Load Time</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.performance.pageLoad || 'unknown'))} ms</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">DOM Ready</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.performance.domReady || 'unknown'))} ms</td></tr>
      <tr><td style="color:#9ca3af;font-size:12px;padding:4px 0">Memory Used</td><td style="font-size:12px;padding:4px 8px">${escHtml(String(d.performance.memoryUsed || 'unknown'))}</td></tr>
    </table>
  </div>` : ''}

  <!-- Raw JSON for devs -->
  <div style="padding:24px 28px;background:#f9fafb">
    <details>
      <summary style="cursor:pointer;color:#6b7280;font-size:12px;font-weight:600;user-select:none">Raw Diagnostics JSON (for developers)</summary>
      <div style="background:#1f1f23;border-radius:8px;padding:12px;margin-top:10px;overflow-x:auto">
        <pre style="margin:0;color:#a3e635;font-size:11px;font-family:monospace;white-space:pre-wrap">${escHtml(JSON.stringify({ title, description, steps, severity, category, diagnostics, timestamp }, null, 2))}</pre>
      </div>
    </details>
  </div>

</div>
</body>
</html>`;

  // ── Plain text fallback ───────────────────────────────────────────────
  const textBody = [
    `BUG REPORT — ${title}`,
    `Severity: ${severity} | Category: ${category}`,
    `Submitted: ${timestamp}`,
    '',
    'DESCRIPTION',
    description,
    '',
    'STEPS TO REPRODUCE',
    Array.isArray(steps) ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None provided',
    '',
    'APP CONTEXT',
    JSON.stringify(d.appContext, null, 2),
    '',
    'DEVICE',
    JSON.stringify(d.device, null, 2),
    '',
    'CONSOLE ERRORS',
    Array.isArray(d.consoleErrors) ? d.consoleErrors.join('\n') : 'None',
    '',
    'FULL DIAGNOSTICS',
    JSON.stringify(diagnostics, null, 2),
  ].join('\n');

  // ── Send via nodemailer ───────────────────────────────────────────────
  try {
    let transporter;
    try {
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } catch (_) {
      // nodemailer not installed
      console.warn('[BugReport] nodemailer not installed. Run: cd backend && npm install nodemailer');
      console.log('[BugReport] Report would have been sent to:', to);
      console.log('[BugReport] Title:', title);
      return res.json({ success: true, note: 'nodemailer not installed — report logged to console. Run: npm install nodemailer' });
    }

    const mailOptions = {
      from:    process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@restaurantpos.local',
      to,
      subject: `[POS Bug] [${(severity || 'unknown').toUpperCase()}] ${title}`,
      text:    textBody,
      html:    htmlBody,
    };

    // Attach screenshot if provided
    if (screenshot && screenshot.startsWith('data:image/')) {
      const base64Data = screenshot.split(',')[1];
      mailOptions.attachments = [{
        filename:    'screenshot.png',
        content:     base64Data,
        encoding:    'base64',
        contentType: 'image/png',
      }];
    }

    await transporter.sendMail(mailOptions);
    console.log(`[BugReport] Report sent to ${to}: ${title}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[BugReport] Failed to send email:', err.message);
    res.status(500).json({ error: `Failed to send report: ${err.message}` });
  }
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = router;