# Kynetropo Sales CRM Mobile/Web Sales Module — Final Implementation Specification

## 1. Objective

Implement a **Sales Lead, Call, Follow-Up, Meeting and Challenge Management module** inside the existing `project.kynetropo.com` codebase.

This is an internal Kynetropo sales application/module. It must work with the existing authentication, user management, project/customer records and project-management architecture.

The implementation must be **modular, production-ready and integrated into the existing codebase**, not a separate throwaway application.

The same sales functionality should be usable through the existing web application and its mobile/PWA/APK presentation where applicable. The UI must be responsive and mobile-first.

---

# 2. Existing Kynetropo Systems

## 2.1 Existing Project Management System

`project.kynetropo.com`

Already handles areas such as:

- Projects
- Customers
- Clients
- Follow-ups
- Bug reports
- Employee/project activities
- Existing company/project workflows

Do **not** rebuild these systems unnecessarily.

## 2.2 Sales Module Responsibility

The new module owns the sales lifecycle:

```text
LEAD
  ↓
CALL
  ↓
FOLLOW-UP
  ↓
HOT / WARM / COLD
  ↓
MEETING
  ↓
MEETING FOLLOW-UP
  ↓
ONBOARDING
  ↓
CUSTOMER
  ↓
EXISTING PROJECT / DRP WORKFLOW
```

After conversion, the existing project/DRP system remains responsible for project execution.

---

# 3. Authentication and Access Control

Use the existing authentication system if one already exists.

Do not create a second independent login system unless the existing architecture requires it.

## 3.1 Roles

At minimum:

### Admin

Admin can:

- Manage sales users
- Manage sales permissions
- View all leads
- View all calls
- View all follow-ups
- View all meetings
- View all challenges
- Create challenges
- Assign/manage challenges
- View sales activity
- Manage access control

### Sales User

Sales users can access only the modules and records permitted by their assigned permissions.

---

# 4. Admin Access Control

Add a dedicated access-control section under Admin.

Example:

```text
Admin
 └── Access Control
      ├── Sales Users
      ├── Roles
      └── Permissions
```

Permissions should be centrally defined.

Suggested permissions:

```text
sales.dashboard.view
sales.leads.view
sales.leads.create
sales.leads.edit
sales.leads.assign
sales.calls.create
sales.calls.view
sales.followups.create
sales.followups.view
sales.followups.complete
sales.meetings.create
sales.meetings.view
sales.meetings.edit
sales.leads.convert
sales.challenges.view
sales.challenges.accept
sales.challenges.complete
sales.challenges.create
sales.challenges.manage
sales.reports.view
```

The exact permission naming can follow the existing project conventions.

## Security requirement

Frontend visibility is not security.

Every protected API/action must validate:

```text
Authentication
    ↓
Role
    ↓
Permission
    ↓
Record ownership/access
    ↓
Business action
```

A Sales User must not be able to bypass the UI and call an Admin API directly.

---

# 5. Sales Mobile App Navigation

Use a **bottom tab navigation** for the mobile experience.

Recommended structure:

```text
┌─────────────────────────────────┐
│                                 │
│          PAGE CONTENT           │
│                                 │
├─────────────────────────────────┤
│ Home | Leads | Follow-ups |     │
│ Challenges | More               │
└─────────────────────────────────┘
```

## Tabs

### 1. Home

Primary sales dashboard.

Show:

- Today's follow-ups
- Overdue follow-ups
- Upcoming follow-ups
- Today's meetings
- Upcoming meetings
- Hot leads
- Warm leads
- Cold leads
- Active challenges

The salesperson should immediately understand:

> What do I need to do today?

---

### 2. Leads

Show:

- All leads
- Hot
- Warm
- Cold
- Search
- Filters
- Assigned leads

Lead cards should expose the most important information without requiring the user to open every record.

---

### 3. Follow-Ups

Show:

- Today
- Overdue
- Upcoming
- Completed

This tab is action-oriented.

---

### 4. Challenges

Show:

- Available
- Accepted
- In Progress
- Completed
- Expired

This is where the **Challenge Accepted** visual experience is implemented.

---

### 5. More

Less frequently used functions:

- Meetings
- Call history
- Activity history
- Profile
- Settings

Admin-only controls should appear only for authorized users.

---

# 6. Desktop/Web Navigation

On desktop, use the existing application's navigation/sidebar pattern.

Do not force mobile bottom tabs onto desktop.

The information architecture should remain consistent:

```text
Dashboard
Leads
Follow-Ups
Meetings
Challenges
Activity
```

Admin-only:

```text
Users
Access Control
Challenge Management
Sales Administration
```

Reuse the existing project's design system wherever possible.

---

# 7. Lead Management

Each lead should contain:

- Lead ID
- Name
- Company
- Contact person
- Phone
- Email
- Source
- Assigned sales user
- Lead status
- Lead temperature
- Created date
- Last activity
- Next follow-up
- Next meeting
- Notes

The schema must remain extensible.

---

# 8. Lead Temperature

Support:

```text
HOT
WARM
COLD
```

Temperature can be updated during sales activity.

Use clear visual differentiation, but do not make the UI overly colorful or noisy.

---

# 9. Log Call

From the Lead Details screen provide a prominent:

```text
[ LOG CALL ]
```

action.

## Call fields

- Lead
- Called By
- Call Date
- Call Time
- Call Duration
- Call Outcome
- Notes
- Next Follow-Up Date
- Optional Next Follow-Up Time
- Optional Lead Temperature update

The flow must be fast enough for repeated sales use.

---

# 10. Call Outcome

Initial options:

- Interested
- Follow-Up Required
- Meeting Required
- Proposal Required
- Not Interested
- No Response
- Call Back Later
- Converted
- Other

Keep the data model configurable for future changes.

---

# 11. Call Notes

Notes should answer:

> What was discussed?

Examples:

- Requirement
- Customer interest
- Budget
- Timeline
- Questions
- Objections
- Next action
- Important comments

Do not create an unnecessarily complex note editor.

---

# 12. Follow-Up

Every call can create a next follow-up.

Example:

```text
Call Date:          31 Aug 2026
Call Time:          11:30 AM
Duration:           12 minutes
Outcome:            Interested
Notes:              ERP requirement discussed
Next Follow-Up:     03 Sep 2026
```

The follow-up must automatically appear on the salesperson's dashboard.

---

# 13. Dashboard

The most important dashboard question is:

> Who do I need to follow up with?

## Sections

### Today's Follow-Ups

Show:

- Lead
- Contact
- Assigned salesperson
- Follow-up date/time
- Last outcome
- Lead temperature
- Quick action

### Overdue

Clearly identify missed follow-ups.

### Upcoming

Show future follow-ups.

### Meetings

Show today's and upcoming meetings.

### Lead Summary

```text
Total Leads
Hot
Warm
Cold
Today's Follow-Ups
Overdue
Today's Meetings
Upcoming Meetings
Active Challenges
```

Avoid unnecessary analytics in the first version.

---

# 14. Lead Details

Recommended structure:

```text
Lead Information

Contact Information

HOT / WARM / COLD

Next Follow-Up
Next Meeting

[ Log Call ]
[ Schedule Meeting ]
[ Add Follow-Up ]
[ Change Temperature ]
[ Convert to Customer ]

Activity Timeline
```

---

# 15. Activity Timeline

Maintain chronological history:

```text
31 Aug
Call Logged
12 minutes
Outcome: Interested
Notes: Requirement discussed

03 Sep
Follow-Up

05 Sep
Meeting Scheduled
10:30 AM
Virtual

07 Sep
Meeting Completed
Outcome: Positive

10 Sep
Next Follow-Up
```

The timeline is the single sales-history view for that lead.

---

# 16. Meeting Management

Allow a salesperson to schedule a meeting from a lead.

Fields:

- Lead
- Meeting title
- Meeting type
- Meeting date
- Meeting time
- Meeting place
- Virtual meeting link
- Participants
- Notes
- Meeting outcome
- Next meeting date
- Next action

## Meeting Types

```text
PHYSICAL
VIRTUAL
```

For physical meetings show:

```text
Meeting Place
```

For virtual meetings show:

```text
Meeting Link
Meeting Date
Meeting Time
```

---

# 17. Meeting Outcome

After the meeting, allow:

- Outcome
- Notes
- Requirements
- Decisions
- Next action
- Next meeting

Example:

```text
Outcome: Positive
Notes: Client wants to proceed
Next Action: Prepare onboarding
Next Meeting: 12 Sep 2026
```

---

# 18. Lead Conversion

Flow:

```text
LEAD
 ↓
ONBOARDING
 ↓
CUSTOMER
```

Preserve the entire sales history.

When converted, display:

```text
Converted to Customer
Conversion Date
Customer/Project Reference
```

Do not delete the original lead history.

---

# 19. Existing Project / DRP Integration

After conversion, pass/reference the customer information to the existing project/DRP system.

Do not duplicate:

- Project management
- Project tasks
- Bug management
- Existing customer project operations

The sales module should retain the sales history and conversion reference.

If an existing integration/API exists, reuse it.

If integration is not currently available, create a clean integration boundary rather than tightly coupling the sales module to project internals.

---

# 20. Challenge Accepted Feature

Implement a special internal sales feature:

# CHALLENGE ACCEPTED

Purpose:

Create a competitive sales-task experience where a challenge can be offered and a salesperson can accept it and complete it before a deadline.

---

# 21. Challenge Lifecycle

```text
AVAILABLE
   ↓
ACCEPTED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Expiration path:

```text
AVAILABLE / ACCEPTED / IN_PROGRESS
              ↓
       DEADLINE REACHED
              ↓
          EXPIRED
              ↓
      DESTROYED VISUAL STATE
```

Never allow an expired challenge to remain actionable.

---

# 22. Challenge Fields

Minimum fields:

- Challenge ID
- Title
- Description
- Created By
- Available/assigned sales users
- Related Lead (optional)
- Related Customer (optional)
- Deadline
- Priority
- Status
- Accepted By
- Accepted At
- Completed By
- Completed At
- Completion Notes
- Created At
- Updated At

---

# 23. Challenge Acceptance

Sales user sees:

```text
Challenge

Get requirement confirmation from ABC Technologies

Deadline:
02 Sep 2026 — 6:00 PM

[ ACCEPT CHALLENGE ]
```

After acceptance:

```text
CHALLENGE ACCEPTED

Accepted By:
Sales User

Status:
IN PROGRESS

Time Remaining:
18:42:31
```

Record acceptance on the server.

---

# 24. Challenge Timer

The countdown is visual only.

Backend remains authoritative.

Frontend:

```text
18:42:31
```

Backend validates:

```text
current_server_time >= deadline
```

Never trust the device/browser clock for challenge expiration.

---

# 25. Challenge Completion

If completed before deadline:

```text
CHALLENGE COMPLETED
```

Store:

- Completed By
- Completed At
- Completion notes

Completed challenges remain in history.

Do not physically delete completed records.

---

# 26. Challenge Expiration

If the deadline is reached:

```text
CHALLENGE EXPIRED
```

The challenge becomes non-actionable.

The expiration state must be enforced server-side.

The UI can then trigger the destruction animation.

---

# 27. Challenge Accepted Animation — Design Direction

Use the attached visual reference as the **design inspiration for the mobile UI language**, not as an exact copy.

The attached reference demonstrates:

- Mobile-first card-based dashboard
- Rounded cards
- Compact information blocks
- Bottom tab navigation
- Large primary hero section
- Strong visual hierarchy
- Clean modern app layout

Adapt this visual language to Kynetropo's sales application.

Do not copy the fitness-specific content.

Use sales content instead:

```text
Today's Follow-Ups
Hot Leads
Upcoming Meetings
Sales Challenges
Lead Activity
```

---

# 28. Destroy Animation — Adapted for Kynetropo

The Challenge Accepted expiration animation should feel like a **black-hole collapse / challenge destruction**, adapted to the Kynetropo sales UI.

Do not use the fitness app UI shown in the reference prompt.

Use the actual Kynetropo challenge card/screen as the object being destroyed.

## Total animation target

Approximately:

```text
2.7–3.0 seconds
```

---

# 29. Destroy Animation Sequence

## Phase 1 — Verification

Duration:

```text
0–1.2 seconds
```

Show a compact verification overlay.

Example:

```text
K

VERIFYING PACT…
```

Use a scanning line around/through the Kynetropo challenge icon or challenge mark.

Purpose:

Build tension before failure.

The animation must remain appropriate to a business application.

---

# 30. Phase 2 — Failure / Collapse

Duration:

```text
1.2–2.6 seconds
```

The entire challenge UI shell should collapse toward the screen center.

Primary transform:

```text
scale(1) rotate(0deg)
        ↓
scale(0.012) rotate(400deg)
```

Use:

```text
cubic-bezier(.62,.02,.2,1)
```

Do not use bounce easing.

Gravity should feel one-directional.

Add:

```text
blur(6px)
brightness(2.2)
saturate(1.6)
```

during the collapse to create a stretched/whitened fall-in effect.

---

# 31. Staggered Content Collapse

Do not shrink the entire layout uniformly.

Break the challenge screen into independent visual groups.

Suggested groups:

```text
1. Header
2. Challenge title/card
3. Deadline/timer
4. Description/details
5. Status section
6. CTA/button
```

Each group receives additional:

```text
translate
rotate
scale(.6)
```

with staggered timing:

```text
60ms
120ms
180ms
240ms
300ms
```

The layout should visually shear into a spiral.

---

# 32. Singularity Layer

At the center of the screen create a singularity.

Components:

### Accretion Disk

Use a rotating conic-gradient style visual.

Duration:

```text
2.6s linear
```

### Inner Disk

Counter-rotate.

Duration:

```text
1.25s reverse
```

Both can use controlled blur.

### Event Horizon

Pure black central core.

Thin hot rim:

```text
box-shadow:
0 0 0 2px rgba(255,214,170,.85),
0 0 60px 18px rgba(255,90,31,.45)
```

### Polar Jets

Two vertical light jets:

```text
top
bottom
```

Pulse opacity subtly.

### Darkness Layer

Full-screen radial gradient that progressively swallows the edges.

The disk should scale approximately:

```text
0.04 → 1
```

---

# 33. Ember Particles

Spawn approximately:

```text
30 particles
```

around a ring centered on the singularity.

Particles move:

```text
translate(var(--from))
scale(1)
        ↓
translate(0,0)
scale(.08)
```

Opacity:

```text
1 → 0
```

Duration:

```text
1.35 seconds
```

Stagger:

```text
0–300ms
```

Particles should visually appear to be sucked into the center.

Keep the effect performant on mobile devices.

---

# 34. Final Destroyed Screen

At approximately:

```text
2.75 seconds
```

hard cut to the destroyed state.

Background:

```text
Near-black radial background
```

Show:

```text
APP DESTROYED
```

Use ember/orange accent.

Add a faint remnant accretion ring.

---

# 35. Destroyed Receipt

Display a compact mono-style receipt/status block.

Example:

```text
CHALLENGE REPORT

CONTRACT        EXPIRED
COMPLETION      72%
TIME LEFT       00:00:00
STREAK          ERASED
STATUS          DESTROYED
WITNESSES       NOTIFIED
```

Only display fields that are actually supported by backend data.

Do not fabricate witness notifications if that feature is not implemented.

If witness notifications are not implemented, omit the line or mark it as future functionality rather than pretending it happened.

---

# 36. Final CTA

Display a ghost-style button:

```text
SIGN A NEW PACT
```

This can later initiate a new challenge.

If the actual action is not yet implemented, render it disabled or connect it only after the corresponding backend action exists.

---

# 37. Typography

Preferred:

```text
Space Grotesk
IBM Plex Mono
```

Use the existing project's font system if already established.

Use:

- Space Grotesk for primary UI
- IBM Plex Mono for technical/status/receipt text

Do not add external fonts unnecessarily if equivalent existing fonts are already available locally.

---

# 38. Color Direction

Primary palette for the destruction experience:

```text
Near Black:   #08080B
Bone:         #F4F2EC
Ember:        #FF5A1F
Hot Highlight:#FFE6CC
```

Normal application screens can use the existing Kynetropo design system.

The destruction animation may temporarily use the ember/black palette to create the special event.

---

# 39. Motion Rules

Do not use:

- Bounce
- Elastic easing
- Cartoonish movement
- Random UI movement
- Excessive screen shake

Use:

- Gravity
- Acceleration
- Rotation
- Blur
- Scale collapse
- Radial darkness
- Controlled particle motion

The visual should feel premium, cinematic and intentional.

---

# 40. Accessibility / Reduced Motion

Respect:

```text
prefers-reduced-motion
```

When reduced motion is enabled:

- Skip heavy particle animation
- Skip excessive rotation
- Use a short fade/scale transition
- Still communicate `CHALLENGE EXPIRED / APP DESTROYED`

Do not make the destruction animation required for understanding the state.

---

# 41. Performance

The animation must run smoothly on normal mobile devices.

Prefer:

```text
transform
opacity
filter
```

where practical.

Avoid expensive layout-triggering animation.

Do not animate large numbers of DOM properties that cause repeated layout/reflow.

Particles should be lightweight.

The animation should be isolated and removable from the normal application rendering path when not active.

---

# 42. Animation Component Architecture

Keep animation separate from business logic.

Suggested:

```text
ChallengeCard
ChallengeDetails
ChallengeTimer
ChallengeStatus
ChallengeAcceptedAnimation
ChallengeExpiredAnimation
Singularity
EmberParticles
DestroyedScreen
```

Business logic:

```text
Challenge state
Deadline
Acceptance
Completion
Expiration
```

must not be embedded inside animation components.

---

# 43. Important Animation Trigger

The destruction animation must be triggered only when the application receives a confirmed expired challenge state.

Example:

```text
Backend
  ↓
Challenge = EXPIRED
  ↓
Frontend receives state
  ↓
ChallengeExpiredAnimation
  ↓
DestroyedScreen
```

Do not trigger the animation merely because the frontend timer reaches zero.

The backend must remain authoritative.

---

# 44. Database Design

Reuse existing tables where appropriate.

If new entities are required, use normalized structures such as:

```text
users
roles
permissions
role_permissions

leads
lead_assignments
lead_activities

call_logs
follow_ups

meetings
meeting_participants

challenges
challenge_assignments
challenge_activity
```

Do not create duplicate user/customer/project tables if equivalent existing entities already exist.

---

# 45. API Boundaries

Follow the existing API conventions.

Conceptually:

```text
/auth

/leads
/leads/:id

/calls
/follow-ups

/meetings

/challenges
/challenges/:id
/challenges/:id/accept
/challenges/:id/complete
/challenges/:id/expire

/dashboard

/admin/users
/admin/roles
/admin/permissions
```

Use the existing route structure if different.

---

# 46. Server Validation

Validate:

- User authentication
- User permission
- Lead ownership/access
- Valid lead ID
- Valid follow-up date
- Valid meeting date
- Valid challenge deadline
- Challenge status
- Challenge assignment
- Challenge acceptance
- Challenge completion
- Challenge expiration

A challenge that has expired must not be completed through a manually crafted API request.

---

# 47. Time and Timezone

Use server/database timestamps consistently.

Display dates according to the application's configured timezone/user timezone.

Challenge expiration must be based on server time.

Do not rely on the device's local clock.

---

# 48. Audit Trail

Record important sales and challenge events.

Examples:

```text
Lead Created
Lead Assigned
Call Logged
Follow-Up Created
Follow-Up Completed
Lead Temperature Changed
Meeting Scheduled
Meeting Completed
Lead Converted
Challenge Created
Challenge Accepted
Challenge Started
Challenge Completed
Challenge Expired
```

Record:

- User
- Action
- Related record
- Timestamp
- Relevant metadata where required

---

# 49. Search and Filters

Leads:

```text
Search
Salesperson
Hot/Warm/Cold
Status
Follow-Up Date
Meeting Date
Created Date
```

Follow-ups:

```text
Today
Overdue
Upcoming
Completed
```

Challenges:

```text
Available
Accepted
In Progress
Completed
Expired
```

---

# 50. Responsive Design

The mobile experience is a priority.

Design for:

- Mobile phone
- Tablet
- Desktop

Mobile should use:

```text
Bottom tabs
Cards
Compact actions
Large touch targets
Sticky/visible primary actions
```

Desktop should use:

```text
Sidebar/navigation
Multi-column layouts
Tables where useful
Expanded detail views
```

Do not simply scale the desktop UI down to mobile.

---

# 51. Mobile Interaction Priorities

A salesperson should be able to perform these actions quickly:

```text
Open app
 ↓
See today's follow-ups
 ↓
Open lead
 ↓
Log call
 ↓
Write notes
 ↓
Set next follow-up
```

For meetings:

```text
Lead
 ↓
Schedule Meeting
 ↓
Select physical/virtual
 ↓
Set date/time
 ↓
Save
```

For challenges:

```text
Challenges
 ↓
Open Challenge
 ↓
Accept
 ↓
Work
 ↓
Complete
```

---

# 52. UI Reference Adaptation

Use the attached reference image as inspiration for:

- Mobile card composition
- Rounded containers
- Bottom navigation
- Hero cards
- Compact metrics
- Clean spacing
- Modern mobile hierarchy

Do NOT copy:

- Fitness content
- Fitness statistics
- Fitness icons
- Exact text
- Exact branding
- Exact layout dimensions

Replace them with Kynetropo sales concepts.

Example home screen:

```text
Good Morning

Today's Sales

┌─────────────────────────┐
│  Follow-Ups Today    08 │
│  Overdue             02 │
│  Meetings Today      03 │
└─────────────────────────┘

Today's Follow-Ups

┌─────────────────────────┐
│ ABC Technologies        │
│ Hot                     │
│ Follow-up 11:30 AM      │
│ [ Log Call ]            │
└─────────────────────────┘
```

---

# 53. Do Not Build a Generic CRM

Do not unnecessarily implement:

- Marketing automation
- Email campaigns
- Accounting
- Inventory
- Billing
- HR
- Full project management
- Complex sales forecasting

Core objective:

```text
LEAD
→ CALL
→ FOLLOW-UP
→ MEETING
→ ONBOARDING
→ CUSTOMER
```

plus:

```text
CHALLENGE ACCEPTED
→ COMPLETE
OR
→ EXPIRE / DESTROY
```

---

# 54. Implementation Strategy for Codex

Before writing code:

1. Inspect the cloned repository.
2. Identify the frontend framework.
3. Identify backend architecture.
4. Identify database.
5. Identify authentication.
6. Identify existing roles/permissions.
7. Identify existing user model.
8. Identify existing customer/project model.
9. Identify existing UI component library.
10. Identify existing routing.
11. Identify existing API conventions.
12. Identify existing responsive/mobile implementation.

Then implement the module using the existing architecture.

Do not rewrite unrelated code.

---

# 55. Code Quality Rules

- Reuse existing components.
- Reuse existing authentication.
- Reuse existing user records.
- Reuse existing customer/project records where applicable.
- Follow existing naming conventions.
- Follow existing folder structure.
- Avoid duplicate business logic.
- Keep API validation server-side.
- Keep animations isolated.
- Keep database relationships normalized.
- Add migrations when schema changes are required.
- Add loading/error/empty states.
- Handle network failures gracefully.
- Do not silently swallow API errors.

---

# 56. Testing Requirements

Test at minimum:

## Authentication

- Admin login
- Sales login
- Unauthorized access
- Expired session

## Permissions

- Sales user without permission
- Sales user with permission
- Admin access
- Direct API authorization

## Leads

- Create
- Edit
- Assign
- Temperature change
- Search/filter

## Calls

- Log call
- Duration
- Date/time
- Outcome
- Notes
- Next follow-up

## Follow-Ups

- Today
- Upcoming
- Overdue
- Complete

## Meetings

- Physical
- Virtual
- Meeting outcome
- Next meeting

## Conversion

- Lead → onboarding
- Onboarding → customer
- Existing project reference
- Preserve sales history

## Challenges

- Create
- Assign
- Accept
- Start/in-progress
- Complete before deadline
- Expire after deadline
- Cannot complete after expiration
- Timer
- Destroy animation
- Reduced-motion behavior

---

# 57. Acceptance Criteria

The module is complete when:

### Access Control

- Admin can control sales permissions.
- Sales users see only authorized modules.
- Backend authorization is enforced.

### Sales

- Salesperson can see assigned leads.
- Salesperson can log calls.
- Salesperson can record duration, date, time, outcome and notes.
- Salesperson can set next follow-up.
- Follow-ups appear on dashboard.
- Overdue follow-ups are clearly visible.
- Meetings can be scheduled and completed.
- Lead temperature can be Hot/Warm/Cold.
- Lead history is preserved.

### Conversion

- Lead can move through onboarding.
- Lead can convert to customer.
- Conversion is recorded.
- Existing project/DRP workflow receives the customer/project reference.

### Challenge Accepted

- Challenge can be created.
- Salesperson can accept challenge.
- Acceptance is recorded.
- Timer is shown.
- Challenge can be completed before deadline.
- Challenge expires after deadline.
- Expired challenge cannot be completed.
- Destruction animation plays for confirmed expiration.
- Final destroyed state is shown.
- Completed/expired history remains available.

---

# 58. Final Non-Negotiable Rules

1. **Do not rewrite the existing project system.**
2. **Do not create duplicate authentication unless required by the current architecture.**
3. **Do not duplicate existing customer/project entities unnecessarily.**
4. **Admin access control must be enforced server-side.**
5. **Sales users must not access Admin-only APIs.**
6. **The backend is authoritative for challenge deadlines.**
7. **The frontend timer is visual only.**
8. **The destruction animation must be isolated from business logic.**
9. **The supplied Challenge Accepted visual/motion design will be integrated into the challenge UI.**
10. **The attached mobile reference is a design reference, not something to copy literally.**
11. **The mobile app must use bottom tabs for primary navigation.**
12. **Calls should not be a dedicated bottom tab; calls belong naturally inside the Lead/Follow-Up workflow.**
13. **The first screen must prioritize today's sales actions.**
14. **Do not fabricate notifications, witnesses, metrics or backend functionality that does not exist.**
15. **Keep the implementation modular so future CRM features can be added without restructuring the entire application.**

---

# 59. Final Product Flow

The final user experience should be:

```text
LOGIN
  ↓
ROLE / PERMISSION CHECK
  ↓
SALES DASHBOARD
  ↓
TODAY'S FOLLOW-UPS
  ↓
LEAD
  ├── LOG CALL
  │      ├── Duration
  │      ├── Outcome
  │      ├── Notes
  │      └── Next Follow-Up
  │
  ├── MEETING
  │      ├── Physical / Virtual
  │      ├── Date / Time
  │      ├── Place / Link
  │      ├── Outcome
  │      └── Next Meeting
  │
  ├── HOT / WARM / COLD
  │
  └── ONBOARDING
           ↓
        CUSTOMER
           ↓
EXISTING PROJECT / DRP SYSTEM


CHALLENGES
  ↓
AVAILABLE
  ↓
ACCEPT CHALLENGE
  ↓
IN PROGRESS
  ↓
 ┌───────────────┐
 │               │
COMPLETED     DEADLINE
 │               │
HISTORY        EXPIRED
                 ↓
          BLACK-HOLE DESTROY
                 ↓
           APP DESTROYED
                 ↓
          SIGN A NEW PACT
```

# END
