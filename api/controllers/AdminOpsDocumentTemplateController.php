<?php
declare(strict_types=1);

/**
 * Document Templates Controller
 * GET    /admin/ops/document-templates              — list
 * GET    /admin/ops/document-templates/{id}         — single
 * POST   /admin/ops/document-templates              — create
 * PUT    /admin/ops/document-templates/{id}         — update
 * DELETE /admin/ops/document-templates/{id}         — delete
 * POST   /admin/ops/document-templates/seed         — seed defaults (idempotent)
 */
class AdminOpsDocumentTemplateController
{
    // ── shared CSS ────────────────────────────────────────────────────────────

    private static function css(): string
    {
        return '
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,sans-serif; font-size:11px; color:#1A2333; background:#fff; padding:32px 36px; max-width:760px; margin:0 auto; }

/* Header */
.doc-header { display:table; width:100%; margin-bottom:10px; }
.doc-header-left { display:table-cell; vertical-align:top; }
.doc-header-right { display:table-cell; vertical-align:top; text-align:right; width:180px; }
.doc-title-line1 { font-size:40px; font-weight:bold; line-height:1.05; color:#1A2333; }
.doc-title-line2 { font-size:40px; font-weight:bold; line-height:1.05; color:#1A2333; }
.doc-title-sm { font-size:36px; font-weight:bold; line-height:1.15; color:#1A2333; }
.logo-area img { height:56px; max-width:190px; object-fit:contain; }

/* Meta line */
.meta { font-size:10px; color:#64748B; margin:8px 0 14px; }

/* Greeting box */
.greeting-table { width:100%; border-collapse:collapse; margin:10px 0 14px; }
.greeting-name-cell { width:36%; padding:12px 14px; font-weight:bold; font-size:11px; vertical-align:top; background:#EDF2FC; color:#1A2333; }
.greeting-body-cell { padding:12px 14px; font-size:11px; line-height:1.65; vertical-align:top; background:#EDF2FC; color:#1E293B; }

/* Section headings */
h2 { font-size:18px; font-weight:bold; color:#1E293B; margin:18px 0 6px; }
h3 { font-size:12px; font-weight:bold; color:#1E293B; margin:10px 0 4px; }
p  { font-size:11px; color:#1E293B; margin-bottom:7px; line-height:1.6; }
ul { list-style:none; margin:0 0 8px; padding:0; }
li { font-size:11px; color:#1E293B; margin-bottom:4px; line-height:1.6; }

/* Tables */
table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:10px; }

/* Header row — navy #3E4B63 */
.th td, .th th { background:#3E4B63; color:#fff; font-weight:bold; padding:8px 10px; text-align:left; }

/* Alternating data rows — matches DOCX: odd=#F7F9FC, even=white */
.ra td { background:#F7F9FC; padding:7px 10px; color:#1A2333; }
.rw td { background:#fff;    padding:7px 10px; color:#1A2333; }
/* Blue-tint row — #F0F4FF */
.rb td { background:#F0F4FF; padding:7px 10px; color:#1A2333; }

/* Total strip */
.total-strip { display:table; width:100%; border-collapse:collapse; margin-bottom:12px; }
.total-strip-lbl { display:table-cell; background:#3E4B63; color:#fff; font-weight:bold; font-size:11px; padding:10px 12px; }
.total-strip-val { display:table-cell; background:#47639F; color:#fff; font-weight:bold; font-size:18px; padding:10px 14px; text-align:center; white-space:nowrap; width:1%; }

/* Two-column card row */
.two-col { display:table; width:100%; border-collapse:collapse; margin-bottom:10px; }
.col-l { display:table-cell; background:#F0F4FF; padding:14px 16px; width:50%; vertical-align:top; }
.col-r { display:table-cell; background:#F7F9FC; padding:14px 16px; width:50%; vertical-align:top; }
.col-label { font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:.6px; color:#64748B; margin-bottom:4px; }
.col-name  { font-size:14px; font-weight:bold; color:#1A2333; margin-bottom:5px; }
.col-detail { font-size:11px; color:#1E293B; line-height:1.7; }
.col-price { font-size:16px; font-weight:bold; color:#47639F; margin-top:10px; }
.col-sub   { font-size:10px; color:#64748B; margin-bottom:6px; }
.col-feat  { font-size:10px; color:#1E293B; margin-bottom:3px; }

/* Receipt amount block — single full-width #F0F4FF */
.amount-table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.amount-big-cell { background:#F0F4FF; padding:22px 20px; vertical-align:middle; }
.amount-big { font-size:40px; font-weight:bold; color:#1A2333; display:inline-block; }
.amount-label { font-size:14px; font-weight:bold; color:#1E293B; margin-left:16px; }

/* Banner */
.banner { width:100%; border-collapse:collapse; margin-bottom:10px; }
.banner td { background:#E8F8EF; padding:13px 16px; font-weight:bold; font-size:14px; color:#10B981; }

/* Progress cards */
.prog-table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.prog-paid    td { background:#F0F4FF; padding:12px; text-align:center; }
.prog-pending td { background:#F7F9FC; padding:12px; text-align:center; }
.prog-status { font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:.5px; color:#47639F; margin-bottom:3px; }
.prog-ms     { font-size:11px; font-weight:bold; color:#1A2333; margin-bottom:3px; }
.prog-amt    { font-size:13px; font-weight:bold; color:#1A2333; }

/* Complete payment summary (receipt final) — #E8F8EF wrap, navy header */
.summary-wrap { background:#E8F8EF; padding:0; margin-bottom:12px; overflow:hidden; }
.summary-wrap table { margin-bottom:0; }
.summary-wrap .th td { background:#3E4B63; }
.summary-total td { background:#F0F4FF; font-weight:bold; padding:7px 10px; color:#1A2333; }

/* Signature */
.sig-row { display:table; width:100%; margin-bottom:10px; }
.sig-cell { display:table-cell; width:50%; padding:14px 16px; vertical-align:top; }
.sig-cell-l { background:#F0F4FF; }
.sig-cell-r { background:#F7F9FC; }
.sig-line { font-size:10px; color:#1E293B; margin-bottom:8px; }
.sig-blank { display:inline-block; width:200px; border-bottom:1px solid #64748B; }

/* Section numbering */
.sec { font-size:13px; font-weight:bold; color:#1E293B; margin:16px 0 5px; }

/* Footer */
.footer { background:#F7F9FC; padding:9px 12px; font-size:10px; text-align:center; margin-top:28px; color:#64748B; }

/* Key-value table — alternating #F0F4FF / #F7F9FC matching DOCX */
.kv td:first-child { font-weight:bold; width:38%; }

/* Checklist items */
.chk-item { font-size:11px; color:#1E293B; margin-bottom:5px; }
';
    }

    // ── templates ─────────────────────────────────────────────────────────────

    private static function tplPricingProposal(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-line1">Pricing</div>
    <div class="doc-title-line2">Proposal</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p class="meta">Prepared for: <b>{{CLIENT_NAME}}</b> &nbsp;&nbsp; Prepared by: <b>{{PROVIDER_NAME}}</b></p>

<table class="greeting-table">
  <tr>
    <td class="greeting-name-cell">Dear {{CLIENT_NAME}},</td>
    <td class="greeting-body-cell">Thank you for your interest in what {{PROVIDER_NAME}} offers. We're excited to share this pricing proposal for the {{PROJECT_NAME}} — a complete, purpose-built platform to streamline your operations. We look forward to collaborating soon!</td>
  </tr>
</table>

<h2>About Us</h2>
<p>{{PROVIDER_NAME}} is a software development service focused on delivering clean, scalable, and business-ready digital solutions. We specialise in custom web applications, management systems, and workflow automation — tailored precisely to each client's needs.</p>
<p>Our approach: understand your business first, then build technology that fits it — not the other way around. Every module we deliver is built for real-world use, not just demos.</p>

<h2>Scope of Work</h2>
<h3>Services</h3>
<p>We will design, develop, and deploy a full {{PROJECT_NAME}} across 3 focus areas over {{DELIVERY_DAYS}}.</p>

<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:28%">Focus Area</td><td>What's Included</td></tr>
  <tr class="ra"><td>1</td><td>{{SCOPE_1_AREA}}</td><td>{{SCOPE_1_DESC}}</td></tr>
  <tr class="rw"><td>2</td><td>{{SCOPE_2_AREA}}</td><td>{{SCOPE_2_DESC}}</td></tr>
  <tr class="ra"><td>3</td><td>{{SCOPE_3_AREA}}</td><td>{{SCOPE_3_DESC}}</td></tr>
</table>

<div class="total-strip">
  <div class="total-strip-lbl">TOTAL PROJECT COST — Development + Deployment + {{FREE_SUPPORT_DURATION}} Free Support</div>
  <div class="total-strip-val">{{TOTAL_AMOUNT}}</div>
</div>

<h2>Pricing</h2>
<p>The total investment for this project is {{TOTAL_AMOUNT}}, payable in 2 milestone-based installments.</p>

<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:48%">Milestone</td><td style="width:24%">When</td><td>Amount</td></tr>
  <tr class="ra"><td>1</td><td>Advance — Project Kickoff</td><td>On Signing</td><td><b>{{ADVANCE_AMOUNT}}</b></td></tr>
  <tr class="rw"><td>2</td><td>Development, Deployment &amp; Go-Live</td><td>On Delivery</td><td><b>{{FINAL_AMOUNT}}</b></td></tr>
</table>

<h2>Package Options</h2>
<p>We've structured the project into clear milestones — here's what each payment unlocks for you.</p>

<div class="two-col">
  <div class="col-l">
    <div class="col-name">Kickoff</div>
    <div class="col-sub">On agreement signing — project begins</div>
    <div class="col-feat">• {{KICKOFF_FEAT_1}}</div>
    <div class="col-feat">• {{KICKOFF_FEAT_2}}</div>
    <div class="col-feat">• {{KICKOFF_FEAT_3}}</div>
    <div class="col-price">{{ADVANCE_AMOUNT}}</div>
  </div>
  <div class="col-r">
    <div class="col-name">Delivery &amp; Go-Live</div>
    <div class="col-sub">Full build, testing, deployment &amp; handover</div>
    <div class="col-feat">• {{DELIVERY_FEAT_1}}</div>
    <div class="col-feat">• {{DELIVERY_FEAT_2}}</div>
    <div class="col-feat">• {{DELIVERY_FEAT_3}}</div>
    <div class="col-price">{{FINAL_AMOUNT}}</div>
  </div>
</div>

<h2>Additional Details</h2>
<p><b>Target Delivery Date:</b> {{DELIVERY_DAYS}} from Kickoff</p>
<h3>Billing Options</h3>
<p>Payment via Bank Transfer (NEFT/RTGS/UPI) or any preferred digital method. Invoice raised for each milestone payment.</p>
<ul>
  <li>• Any scope addition beyond agreed features will be quoted separately.</li>
  <li>• Full source code &amp; IP ownership transferred to Client upon final payment.</li>
  <li>• {{FREE_SUPPORT_DURATION}} free support included; thereafter AMC available at {{AMC_AMOUNT}}/year.</li>
  <li>• Proposal valid for 30 days from date of issue — {{ISSUE_DATE}}.</li>
</ul>

<h2>Contact Details</h2>
<table>
  <tr class="th"><td>Name</td><td>Phone</td><td>Email</td></tr>
  <tr class="ra"><td>{{PROVIDER_PERSON}}</td><td>{{PROVIDER_PHONE}}</td><td>{{PROVIDER_EMAIL}}</td></tr>
</table>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    private static function tplServiceAgreement(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-sm">Service<br>Agreement</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p class="meta">Prepared for: <b>{{CLIENT_NAME}}</b> &nbsp;&nbsp; Date: <b>{{ISSUE_DATE}}</b></p>

<h2>Parties</h2>
<div class="two-col">
  <div class="col-l">
    <div class="col-label">Service Provider</div>
    <div class="col-name">{{PROVIDER_NAME}}</div>
    <div class="col-detail">{{PROVIDER_ADDRESS}}<br>{{PROVIDER_EMAIL}}<br>{{PROVIDER_PHONE}}</div>
  </div>
  <div class="col-r">
    <div class="col-label">Client</div>
    <div class="col-name">{{CLIENT_NAME}}</div>
    <div class="col-detail">{{CLIENT_COMPANY}}<br>{{CLIENT_ADDRESS}}<br>{{CLIENT_EMAIL}}<br>{{CLIENT_PHONE}}</div>
  </div>
</div>

<div class="sec">1. &nbsp; Agreement</div>
<p>This agreement outlines the working understanding between {{PROVIDER_NAME}} (Service Provider) and the Client for development of the {{PROJECT_NAME}}.</p>
<p>Changes must be in writing and acknowledged by both parties. Outstanding payment amounts remain due and enforceable regardless of disputes.</p>

<div class="sec">2. &nbsp; Scope of Work</div>
<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:28%">Focus Area</td><td>What's Included</td></tr>
  <tr class="ra"><td>1</td><td>{{SCOPE_1_AREA}}</td><td>{{SCOPE_1_DESC}}</td></tr>
  <tr class="rw"><td>2</td><td>{{SCOPE_2_AREA}}</td><td>{{SCOPE_2_DESC}}</td></tr>
  <tr class="ra"><td>3</td><td>{{SCOPE_3_AREA}}</td><td>{{SCOPE_3_DESC}}</td></tr>
</table>

<div class="total-strip">
  <div class="total-strip-lbl">TOTAL</div>
  <div class="total-strip-val">{{TOTAL_AMOUNT}}</div>
</div>

<div class="sec">3. &nbsp; Support &amp; Maintenance</div>
<table>
  <tr class="th"><td style="width:52%">Service</td><td style="width:24%">Duration</td><td>Cost</td></tr>
  <tr class="ra"><td>Bug Fixes &amp; Issue Resolution</td><td>{{FREE_SUPPORT_DURATION}}</td><td><b>FREE</b></td></tr>
  <tr class="rw"><td>Minor Feature Tweaks</td><td>{{FREE_SUPPORT_DURATION}}</td><td><b>FREE</b></td></tr>
  <tr class="ra"><td>Email &amp; WhatsApp Support</td><td>{{FREE_SUPPORT_DURATION}}</td><td><b>FREE</b></td></tr>
  <tr class="rw"><td>Change Based Charges</td><td>As per Scope</td><td>Quoted Separately</td></tr>
  <tr class="ra"><td>Annual Maintenance (AMC)</td><td>From 2nd year</td><td>{{AMC_AMOUNT}}</td></tr>
</table>

<div class="sec">4. &nbsp; Payment Schedule</div>
<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:48%">Milestone</td><td style="width:24%">When</td><td>Amount</td></tr>
  <tr class="ra"><td>1</td><td>Advance — Project Kickoff</td><td>On Signing</td><td><b>{{ADVANCE_AMOUNT}}</b></td></tr>
  <tr class="rw"><td>2</td><td>Development, Deployment &amp; Go-Live</td><td>On Delivery</td><td><b>{{FINAL_AMOUNT}}</b></td></tr>
</table>

<div class="sec">5. &nbsp; Terms &amp; Conditions</div>
<ul>
  <li>• Any scope addition beyond agreed features will be quoted separately.</li>
  <li>• {{FREE_SUPPORT_DURATION}} free support included; thereafter Annual Maintenance Contract (AMC) available at {{AMC_AMOUNT}}/year.</li>
  <li>• Additional features beyond scope assessed and charged separately.</li>
  <li>• Agreement valid for 30 days from date of issue — {{ISSUE_DATE}}.</li>
</ul>

<div class="sec">6. &nbsp; Revision Policy</div>
<p>Revision requests beyond agreed scope will be assessed and charged based on complexity and time required.</p>

<div class="sec">7. &nbsp; Confidentiality</div>
<p>Both parties agree to keep all shared information, code, data and business details strictly confidential.</p>

<div class="sec">8. &nbsp; Termination</div>
<p>Either party may terminate with 30 days written notice. All outstanding invoices must be settled. Work completed to termination date remains billable.</p>

<h2>Signatures</h2>
<div class="sig-row">
  <div class="sig-cell sig-cell-l">
    <div class="col-label">Service Provider</div>
    <div class="col-name">{{PROVIDER_NAME}}</div>
    <br>
    <p class="sig-line">Name: <span class="sig-blank"></span></p>
    <p class="sig-line">Date: &nbsp;<span class="sig-blank"></span></p>
  </div>
  <div class="sig-cell sig-cell-r">
    <div class="col-label">Client</div>
    <div class="col-name">{{CLIENT_NAME}}</div>
    <br>
    <p class="sig-line">Name: <span class="sig-blank"></span></p>
    <p class="sig-line">Date: &nbsp;<span class="sig-blank"></span></p>
  </div>
</div>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    private static function tplInvoice(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-line1">Invoice</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p style="font-size:12px;font-weight:bold;margin-bottom:3px;">{{PROJECT_NAME}}</p>
<p class="meta">Date: {{ISSUE_DATE}} &nbsp;|&nbsp; Invoice No: {{INVOICE_NUMBER}} &nbsp;|&nbsp; Due: {{INVOICE_DUE_DATE}}</p>

<h2>Billing Details</h2>
<div class="two-col">
  <div class="col-l">
    <div class="col-label">From</div>
    <div class="col-name">{{PROVIDER_NAME}}</div>
    <div class="col-detail">{{PROVIDER_ADDRESS}}<br>{{PROVIDER_EMAIL}}<br>{{PROVIDER_PHONE}}</div>
  </div>
  <div class="col-r">
    <div class="col-label">Bill To</div>
    <div class="col-name">{{CLIENT_NAME}}</div>
    <div class="col-detail">{{CLIENT_COMPANY}}<br>{{CLIENT_ADDRESS}}<br>{{CLIENT_EMAIL}}<br>{{CLIENT_PHONE}}</div>
  </div>
</div>

<h2>Invoice Details</h2>
<table class="kv">
  <tr class="rb"><td>Date of Issue</td><td>{{ISSUE_DATE}}</td></tr>
  <tr class="ra"><td>Invoice Number</td><td>{{INVOICE_NUMBER}}</td></tr>
  <tr class="rb"><td>Client Name</td><td>{{CLIENT_NAME}}</td></tr>
  <tr class="ra"><td>Subject</td><td>{{PROJECT_NAME}} Development</td></tr>
  <tr class="rb"><td>Due Date</td><td>{{INVOICE_DUE_DATE}}</td></tr>
  <tr class="ra"><td>Payment Reference</td><td>{{PAYMENT_REFERENCE}}</td></tr>
</table>

<h2>Payment Options</h2>
<div class="two-col">
  <div class="col-l">
    <div class="col-label">Bank Transfer</div>
    <div class="col-name">{{BANK_ACCOUNT_NAME}}</div>
    <div class="col-detail">{{BANK_ACCOUNT_IFSC}}<br>{{BANK_UPI_ID}}</div>
  </div>
  <div class="col-r">
    <div class="col-label">Online Payment</div>
    <div class="col-name">{{ONLINE_PAYMENT_LINK}}</div>
    <div class="col-detail">Any preferred payment method accepted.</div>
  </div>
</div>

<h2>Payment Schedule</h2>
<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:48%">Milestone</td><td style="width:24%">When</td><td>Amount</td></tr>
  <tr class="ra"><td>1</td><td>Advance — Project Kickoff</td><td>On Signing</td><td><b>{{ADVANCE_AMOUNT}}</b></td></tr>
  <tr class="rw"><td>2</td><td>Development, Deployment &amp; Go-Live</td><td>On Delivery</td><td><b>{{FINAL_AMOUNT}}</b></td></tr>
</table>

<div class="total-strip">
  <div class="total-strip-lbl">TOTAL — 2 Milestone Payments</div>
  <div class="total-strip-val">{{TOTAL_AMOUNT}}</div>
</div>

<p style="text-align:center;font-size:10px;color:#555;margin-top:10px;">Please quote the invoice number with your payment. For any queries feel free to reach out.</p>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    private static function tplWelcomeLetter(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-line1">Welcome</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p class="meta">Prepared for: <b>{{CLIENT_NAME}}</b> &nbsp;&nbsp; Date: <b>{{ISSUE_DATE}}</b></p>

<table class="greeting-table">
  <tr>
    <td class="greeting-name-cell">Dear {{CLIENT_NAME}},</td>
    <td class="greeting-body-cell">Thank you for choosing {{PROVIDER_NAME}}. We're thrilled to have the opportunity to build the {{PROJECT_NAME}}. Below you'll find everything you need to get started smoothly. We look forward to creating something exceptional together!</td>
  </tr>
</table>

<h2>About This Project</h2>
<p>Your {{PROJECT_NAME}} is a complete platform designed to transform how you manage your business operations — all in one place.</p>

<h2>Scope of Work</h2>
<h3>What We're Building</h3>
<p>Here's an overview of the key focus areas in your project:</p>

<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:28%">Focus Area</td><td>What's Included</td></tr>
  <tr class="ra"><td>1</td><td>{{SCOPE_1_AREA}}</td><td>{{SCOPE_1_DESC}}</td></tr>
  <tr class="rw"><td>2</td><td>{{SCOPE_2_AREA}}</td><td>{{SCOPE_2_DESC}}</td></tr>
  <tr class="ra"><td>3</td><td>{{SCOPE_3_AREA}}</td><td>{{SCOPE_3_DESC}}</td></tr>
</table>

<h2>Pricing</h2>
<h3>Billing Options</h3>
<p>Payment via Bank Transfer (NEFT/RTGS/UPI) or any digital payment method. Invoice issued for each milestone.</p>

<table>
  <tr class="th"><td style="width:5%">#</td><td style="width:48%">Milestone</td><td style="width:24%">When</td><td>Amount</td></tr>
  <tr class="ra"><td>1</td><td>Advance — Project Kickoff</td><td>On Signing</td><td><b>{{ADVANCE_AMOUNT}}</b></td></tr>
  <tr class="rw"><td>2</td><td>Development, Deployment &amp; Go-Live</td><td>On Delivery</td><td><b>{{FINAL_AMOUNT}}</b></td></tr>
</table>

<h2>Additional Details</h2>
<p><b>Target Delivery Date:</b> {{DELIVERY_DAYS}} from Kickoff</p>

<h3>Free Support Included ({{FREE_SUPPORT_DURATION}})</h3>
<ul>
  <li>• Bug Fixes &amp; Issue Resolution at no cost.</li>
  <li>• Minor Feature Tweaks within agreed scope.</li>
  <li>• Email &amp; WhatsApp Support during business hours.</li>
  <li>• Annual Maintenance Contract (AMC) available at {{AMC_AMOUNT}}/year thereafter.</li>
</ul>

<h2>Contact Details</h2>
<table>
  <tr class="th"><td>Name</td><td>Phone</td><td>Email</td></tr>
  <tr class="ra"><td>{{PROVIDER_PERSON}}</td><td>{{PROVIDER_PHONE}}</td><td>{{PROVIDER_EMAIL}}</td></tr>
</table>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    private static function tplReceiptAdvance(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-sm">Payment<br>Receipt</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p style="font-size:11px;margin-bottom:3px;"><b>Receipt #1 of 2 — Advance — Project Kickoff</b></p>
<p class="meta">{{PROJECT_NAME}}</p>

<table class="banner"><tr><td>&#10003; &nbsp; PAYMENT RECEIVED — THANK YOU!</td></tr></table>

<table class="amount-table">
  <tr>
    <td class="amount-big-cell"><span class="amount-big">{{ADVANCE_AMOUNT}}</span><span class="amount-label">Advance — Project Kickoff</span></td>
  </tr>
</table>

<h2>Receipt Details</h2>
<table class="kv">
  <tr class="rb"><td>Receipt Number</td><td>{{RECEIPT_1_NUMBER}}</td></tr>
  <tr class="ra"><td>Date Received</td><td>{{RECEIPT_1_DATE}}</td></tr>
  <tr class="rb"><td>Invoice Ref</td><td>{{INVOICE_NUMBER}}</td></tr>
  <tr class="ra"><td>Project</td><td>{{PROJECT_NAME}}</td></tr>
  <tr class="rb"><td>Milestone</td><td>Advance — Project Kickoff</td></tr>
  <tr class="ra"><td>Payment Method</td><td>{{PAYMENT_MODE}}</td></tr>
  <tr class="rb"><td>Transaction ID</td><td>{{RECEIPT_1_TRANSACTION_ID}}</td></tr>
  <tr class="ra"><td>Amount Received</td><td><b>{{ADVANCE_AMOUNT}}</b></td></tr>
</table>

<h2>Payment Progress</h2>
<table class="prog-table">
  <tr>
    <td class="prog-paid" style="width:50%"><div class="prog-status">&#10003; &nbsp; PAID</div><div class="prog-ms">Advance</div><div class="prog-amt">{{ADVANCE_AMOUNT}}</div></td>
    <td class="prog-pending" style="width:50%"><div class="prog-status">PENDING</div><div class="prog-ms">Final</div><div class="prog-amt">{{FINAL_AMOUNT}}</div></td>
  </tr>
</table>

<table class="kv">
  <tr class="rw"><td>Amount Received So Far:</td><td>{{ADVANCE_AMOUNT}}</td></tr>
  <tr class="rw"><td>Balance Remaining:</td><td>{{FINAL_AMOUNT}}</td></tr>
  <tr class="rb"><td><b>Total Project Cost:</b></td><td><b>{{TOTAL_AMOUNT}}</b></td></tr>
</table>

<h2>Next Payment</h2>
<p>Receipt #2 (Final) — {{FINAL_AMOUNT}} due upon Development, Deployment &amp; Go-Live.</p>

<h2>From</h2>
<div class="two-col">
  <div class="col-l">
    <div class="col-label">{{PROVIDER_NAME}}</div>
    <div class="col-name">{{PROVIDER_PERSON}}</div>
    <div class="col-detail">{{PROVIDER_ADDRESS}}<br>{{PROVIDER_EMAIL}}<br>{{PROVIDER_PHONE}}</div>
  </div>
  <div class="col-r">
    <div class="col-label">Project</div>
    <div class="col-name">{{PROJECT_NAME}}</div>
    <div class="col-detail">{{CLIENT_NAME}}<br>Invoice: {{INVOICE_NUMBER}}</div>
  </div>
</div>

<p style="text-align:center;font-size:10px;color:#555;margin-top:4px;">This is an official payment receipt from {{PROVIDER_NAME}}.</p>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    private static function tplReceiptFinal(): string
    {
        $css = self::css();
        return <<<'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><style>{{CSS}}</style></head><body>

<div class="doc-header">
  <div class="doc-header-left">
    <div class="doc-title-sm">Final<br>Receipt</div>
  </div>
  <div class="doc-header-right">
    <div class="logo-area"><img src="{{LOGO_URL}}" alt="{{PROVIDER_NAME}}"></div>
  </div>
</div>

<p style="font-size:11px;margin-bottom:3px;"><b>Receipt #2 of 2 — Development, Deployment &amp; Go-Live</b></p>
<p class="meta">{{PROJECT_NAME}}</p>

<table class="banner"><tr><td>&#10003; &nbsp; PROJECT FULLY PAID — THANK YOU!</td></tr></table>

<table class="amount-table">
  <tr>
    <td class="amount-big-cell"><span class="amount-big">{{FINAL_AMOUNT}}</span><span class="amount-label">Development, Deployment &amp; Go-Live</span></td>
  </tr>
</table>

<h2>Receipt Details</h2>
<table class="kv">
  <tr class="rb"><td>Receipt Number</td><td>{{RECEIPT_2_NUMBER}}</td></tr>
  <tr class="ra"><td>Date Received</td><td>{{RECEIPT_2_DATE}}</td></tr>
  <tr class="rb"><td>Invoice Ref</td><td>{{INVOICE_NUMBER}}</td></tr>
  <tr class="ra"><td>Project</td><td>{{PROJECT_NAME}}</td></tr>
  <tr class="rb"><td>Milestone</td><td>Development, Deployment &amp; Go-Live</td></tr>
  <tr class="ra"><td>Payment Method</td><td>{{PAYMENT_MODE}}</td></tr>
  <tr class="rb"><td>Transaction ID</td><td>{{RECEIPT_2_TRANSACTION_ID}}</td></tr>
  <tr class="ra"><td>Amount Received</td><td><b>{{FINAL_AMOUNT}}</b></td></tr>
</table>

<h2>Payment Progress</h2>
<table class="prog-table">
  <tr>
    <td class="prog-paid" style="width:50%"><div class="prog-status">&#10003; &nbsp; PAID</div><div class="prog-ms">Advance</div><div class="prog-amt">{{ADVANCE_AMOUNT}}</div></td>
    <td class="prog-paid" style="width:50%"><div class="prog-status">&#10003; &nbsp; PAID</div><div class="prog-ms">Final</div><div class="prog-amt">{{FINAL_AMOUNT}}</div></td>
  </tr>
</table>

<table class="kv">
  <tr class="rw"><td>Amount Received So Far:</td><td>{{TOTAL_AMOUNT}}</td></tr>
  <tr class="rw"><td>Balance Remaining:</td><td>&#8377;0</td></tr>
  <tr class="rb"><td><b>Total Project Cost:</b></td><td><b>{{TOTAL_AMOUNT}}</b></td></tr>
</table>

<h2>Complete Payment Summary</h2>
<div class="summary-wrap">
  <table>
    <tr class="th"><td>Milestone</td><td>Amount</td></tr>
    <tr class="ra"><td>Receipt #1 — Advance (On Signing)</td><td>{{ADVANCE_AMOUNT}}</td></tr>
    <tr class="rw"><td>Receipt #2 — Development, Deployment &amp; Go-Live (On Delivery)</td><td>{{FINAL_AMOUNT}}</td></tr>
    <tr class="summary-total"><td><b>TOTAL RECEIVED — PROJECT FULLY PAID</b></td><td><b>{{TOTAL_AMOUNT}}</b></td></tr>
  </table>
</div>

<h2>Handover Checklist</h2>
<ul>
  <li class="chk-item">&#10003; &nbsp; Full source code transferred to Client.</li>
  <li class="chk-item">&#10003; &nbsp; Complete IP ownership transferred upon this final payment.</li>
  <li class="chk-item">&#10003; &nbsp; Hosting setup &amp; deployment completed and live.</li>
  <li class="chk-item">&#10003; &nbsp; {{FREE_SUPPORT_DURATION}} free support — Bug fixes, minor tweaks, WhatsApp/Email.</li>
  <li class="chk-item">&#10003; &nbsp; Optional Annual Maintenance Contract (AMC) available at {{AMC_AMOUNT}}/year thereafter.</li>
  <li class="chk-item">&#10003; &nbsp; Any additional features beyond scope quoted separately.</li>
</ul>

<h2>From</h2>
<div class="two-col">
  <div class="col-l">
    <div class="col-label">{{PROVIDER_NAME}}</div>
    <div class="col-name">{{PROVIDER_PERSON}}</div>
    <div class="col-detail">{{PROVIDER_ADDRESS}}<br>{{PROVIDER_EMAIL}}<br>{{PROVIDER_PHONE}}</div>
  </div>
  <div class="col-r">
    <div class="col-label">Project</div>
    <div class="col-name">{{PROJECT_NAME}}</div>
    <div class="col-detail">{{CLIENT_NAME}}<br>Invoice: {{INVOICE_NUMBER}}</div>
  </div>
</div>

<p style="text-align:center;font-size:10px;color:#555;margin-top:4px;">This is an official payment receipt from {{PROVIDER_NAME}}.</p>

<div class="footer">{{PROVIDER_WEBSITE}} &nbsp;|&nbsp; {{PROVIDER_EMAIL}} &nbsp;|&nbsp; {{PROVIDER_PHONE}}</div>
</body></html>
HTML;
    }

    // ── inject CSS into templates (heredoc can't call methods inline) ─────────

    private static function inject(string $tpl): string
    {
        return str_replace('{{CSS}}', self::css(), $tpl);
    }

    // ── DEFAULTS map ──────────────────────────────────────────────────────────

    private function defaults(): array
    {
        return [
            'pricing_proposal'  => ['name' => 'Pricing Proposal',       'body' => self::inject(self::tplPricingProposal())],
            'service_agreement' => ['name' => 'Service Agreement',       'body' => self::inject(self::tplServiceAgreement())],
            'invoice'           => ['name' => 'Invoice',                 'body' => self::inject(self::tplInvoice())],
            'welcome_letter'    => ['name' => 'Welcome Letter',          'body' => self::inject(self::tplWelcomeLetter())],
            'receipt_advance'   => ['name' => 'Advance Payment Receipt', 'body' => self::inject(self::tplReceiptAdvance())],
            'receipt_final'     => ['name' => 'Final Payment Receipt',   'body' => self::inject(self::tplReceiptFinal())],
        ];
    }

    // ── endpoints ─────────────────────────────────────────────────────────────

    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $type     = $request->query('type');

        $sql    = "SELECT * FROM ops_document_templates WHERE tenant_id = ?";
        $params = [$tenantId];
        if ($type) { $sql .= " AND type = ?"; $params[] = $type; }
        $sql .= " ORDER BY FIELD(type,'pricing_proposal','service_agreement','invoice','welcome_letter','receipt_advance','receipt_final'), is_default DESC";

        $rows = Database::fetchAll($sql, $params);

        if (empty($rows)) {
            $this->seedDefaults($tenantId);
            $rows = Database::fetchAll($sql, $params);
        }

        Response::success($rows);
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $row = Database::fetch(
            "SELECT * FROM ops_document_templates WHERE id = ? AND tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$row) Response::error('Template not found', 404);
        Response::success($row);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $validTypes = ['pricing_proposal','service_agreement','invoice','welcome_letter','receipt_advance','receipt_final'];
        $type     = trim((string)($body['type'] ?? ''));
        $name     = trim((string)($body['name'] ?? ''));
        $bodyText = trim((string)($body['body'] ?? ''));

        if (!in_array($type, $validTypes)) Response::error('Invalid type', 422);
        if (!$name)     Response::error('Name is required', 422);
        if (!$bodyText) Response::error('Body is required', 422);

        $id = Database::insert('ops_document_templates', [
            'tenant_id'  => $tenantId,
            'type'       => $type,
            'name'       => $name,
            'body'       => $bodyText,
            'is_default' => 0,
        ]);

        $row = Database::fetch("SELECT * FROM ops_document_templates WHERE id = ? LIMIT 1", [$id]);
        Response::success($row, 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $row = Database::fetch(
            "SELECT id FROM ops_document_templates WHERE id = ? AND tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$row) Response::error('Template not found', 404);

        $updates = [];
        if (isset($body['name'])) $updates['name'] = trim((string)$body['name']);
        if (isset($body['body'])) $updates['body'] = trim((string)$body['body']);

        if (!empty($updates)) {
            Database::update('ops_document_templates', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $updated = Database::fetch("SELECT * FROM ops_document_templates WHERE id = ? LIMIT 1", [$id]);
        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $row = Database::fetch(
            "SELECT id, is_default FROM ops_document_templates WHERE id = ? AND tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$row) Response::error('Template not found', 404);
        if ($row['is_default']) Response::error('Cannot delete a default template', 422);

        Database::query(
            "DELETE FROM ops_document_templates WHERE id = ? AND tenant_id = ?",
            [$id, $tenantId]
        );
        Response::success(['deleted' => true]);
    }

    public function seed(Request $request): void
    {
        $tenantId = Database::tenantId();
        $this->seedDefaults($tenantId);
        $rows = Database::fetchAll(
            "SELECT id, type, name, is_default FROM ops_document_templates WHERE tenant_id = ? ORDER BY type ASC",
            [$tenantId]
        );
        Response::success($rows, 'Templates seeded');
    }

    // ── private ───────────────────────────────────────────────────────────────

    private function seedDefaults(int $tenantId): void
    {
        foreach ($this->defaults() as $type => $tpl) {
            $exists = Database::fetch(
                "SELECT id FROM ops_document_templates WHERE tenant_id = ? AND type = ? AND is_default = 1 LIMIT 1",
                [$tenantId, $type]
            );
            if ($exists) {
                Database::update('ops_document_templates', ['body' => $tpl['body']], ['id' => $exists['id'], 'tenant_id' => $tenantId]);
            } else {
                Database::insert('ops_document_templates', [
                    'tenant_id'  => $tenantId,
                    'type'       => $type,
                    'name'       => $tpl['name'],
                    'body'       => $tpl['body'],
                    'is_default' => 1,
                ]);
            }
        }
    }
}
