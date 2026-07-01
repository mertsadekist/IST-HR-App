/**
 * Ready-to-send offer presets for IST Real Estate / IST Markets, extracted
 * verbatim (terms + responsibilities) from real, previously-issued offer
 * letters. Selecting one pre-fills the offer form (Onboarding's "Create Offer"
 * step, or the standalone Quick Offer page) with that role's standard terms —
 * candidate-specific fields (name, joining date, offer expiry, and salary if it
 * differs) are left for HR to fill in per hire.
 *
 * Fields map 1:1 to `onboarding_offers` columns (see OFFER_FIELDS in
 * server/routes/onboardingV2.js). Anything not stated in the source letter is
 * left blank rather than invented (e.g. Real Estate Agent has no fixed salary
 * or listed responsibilities in the original document).
 */

const STANDARD_HOURS = '10:00 AM to 7:00 PM, Monday to Friday\n10:00 AM to 3:00 PM, Saturday';
const STANDARD_LEAVE = '30 Days as per UAE Labor Law';
const STANDARD_VISA = 'Company-sponsored UAE residence visa and medical insurance';

export const OFFER_PRESETS = [
  {
    key: 'accountant',
    label: 'Accountant',
    job_title: 'Accountant',
    department: '',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: '',
    notice_period: '',
    basic_salary: 3500,
    additional_terms:
`As an Accountant, your key roles and responsibilities include but are not limited to the following:
- Manage day-to-day accounting operations, including accounts payable, receivable, and general ledger.
- Prepare financial statements, balance sheets, and income statements.
- Handle monthly, quarterly, and annual closings.
- Maintain accurate financial records and documentation.
- Reconcile bank statements and manage cash flow.
- Prepare and process VAT filings and other tax-related documents.
- Support the budgeting and forecasting process.
- Ensure compliance with company policies and UAE financial regulations.
- Assist auditors during internal and external audits.
- Coordinate with other departments to ensure accurate financial reporting.`,
  },
  {
    key: 'data_analyst',
    label: 'Data Analyst',
    job_title: 'Data Analyst',
    department: 'Marketing',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: '',
    notice_period: '',
    basic_salary: 3000,
    additional_terms:
`Key Responsibilities:
- Collect and analyze real estate market data, property listings, and transaction records.
- Prepare daily, weekly, and monthly reports on sales performance, listings, and leads.
- Monitor Dubai real estate trends using platforms such as DXB Interact, Property Finder, and Bayut.
- Create dashboards and reports to track agent performance and company KPIs.
- Maintain accurate CRM and database records for listings and transactions.
- Provide market insights and data analysis to support sales and management decisions.

Targets / KPIs:
- Ensure accurate and timely reporting to management.
- Maintain updated CRM data and property records.
- Track agent performance including listings, leads, and closed deals.
- Provide monthly market insights to support company sales targets.`,
  },
  {
    key: 'photographer',
    label: 'Photographer & Video Editor',
    job_title: 'Photographer & Video Editor',
    department: 'Marketing',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: '',
    notice_period: '',
    basic_salary: 5000,
    additional_terms:
`Key Responsibilities:
- Capture high-quality property photographs and videos for listings, marketing materials, and promotional campaigns.
- Conduct on-site shoots for residential and commercial properties, ensuring proper lighting, angles, and composition.
- Create engaging video content including walkthroughs, drone shots (if applicable), and lifestyle footage.
- Edit photos and videos using professional software to produce polished, market-ready content.
- Coordinate with sales and marketing teams to understand project requirements and deliverables.
- Ensure all content aligns with company branding and visual guidelines.
- Maintain and manage photography and videography equipment, ensuring everything is in good working condition.
- Organize and archive visual content for easy access by the marketing team.
- Deliver projects within assigned timelines and meet quality standards.
- Support marketing campaigns by producing creative content for social media, websites, and advertisements.
- Stay updated with the latest trends, tools, and techniques in real estate photography and videography.

1. Photography — capture of high-quality images for:
- Residential and commercial property listings and projects for IST Real Estate.
- Corporate events, internal activities, and team functions.
- Lifestyle and brand-focused content for marketing use.
- Product, platform, and promotional materials for IST Markets (e.g. trading platforms, campaigns, events).
- Plan and schedule photo shoots with relevant stakeholders.
- Set up, handle, and operate cameras, lenses, lighting, and related equipment.
- Perform basic equipment care, checks, and maintenance; report any issues promptly.

2. Videography — plan, film, and capture:
- Property walkthroughs and project videos for IST Real Estate.
- Promotional and marketing videos for IST Markets and IST Real Estate.
- Interviews, testimonials, and profile videos (e.g. agents, clients, management).
- Corporate events, seminars, and activations.
- Short-form videos tailored to social media platforms (Reels, Stories, TikTok-style, etc.).
- Ensure appropriate composition, lighting, and audio capture.

Policies & Employee Handbook: Your employment is subject to your compliance with IST Groups' policies and procedures, including but not limited to the employee handbook, code of conduct and ethics, IT, data protection, social media policies, and health and safety regulations. You will be provided with access to these documents and are expected to familiarize yourself with them.

Conditions of Offer: This offer is subject to your legal right to work in the UAE, completion of any background or reference checks where applicable and permitted by law, and your signing of the formal employment contract and any related onboarding documentation. In the event of any conflict between this letter and your employment contract, the terms of the employment contract shall prevail.`,
  },
  {
    key: 'seo_executive',
    label: 'SEO Executive',
    job_title: 'SEO Executive',
    department: 'IST Markets',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: 'Semiannual discretionary performance bonus tied to audited SEO KPIs (management discretion; not guaranteed — see full terms).',
    notice_period: 'Probation: 14 days (employer), 14–30 days (employee, per UAE Labour Law). Post-probation: 30 days (both parties).',
    basic_salary: 5000,
    additional_terms:
`1) Roles and Responsibilities: You are offered the position of SEO Executive, reporting to the Head of Marketing / SEO Lead. Your primary scope is SEO execution across IST Groups' digital brands, with emphasis on IST Markets (istmarkets.com, istmarkets.mu) and, when assigned, IST Real Estate (istrealestate.ae, istrealestate.com), and their social channels. You will ideate, draft, and publish SEO-optimized content for both website entities (blogs, guides, landing pages), and create search-optimized scripts and copy for Reels, Carousel posts, and Stories across Meta (Facebook, Instagram, Threads), X.com, YouTube, TikTok, and Snapchat. All social content must comply with each platform's policies, reflect white-hat practices, and be produced to maximize search discoverability and audience engagement.

2) Employer & Group Assignment: Your legal employer is IST Real Estate (part of IST Groups). You may be assigned work across IST Groups brands, including IST Markets, as business needs require. Such assignments do not change your employing entity or the terms of this offer.

3) Work Hours, Breaks, Ramadan & Overtime: Normal hours: 8 hours per day, up to 48 hours per week in line with UAE Labour Law. Schedule: Monday–Friday 10:00–19:00 and Saturday 10:00–15:00, including a 1-hour unpaid meal break on weekdays. Ramadan: daily working hours are reduced by 2 hours. Overtime requires prior written approval and is compensated per UAE Labour Law and company policy.

4) Compensation: Base salary paid monthly in arrears (all-in; separate allowances are not provided). Benefits: visa sponsorship and medical insurance per company policy. Annual leave & holidays: 30 calendar days of paid annual leave per completed year of service, plus UAE public holidays, in accordance with company policy.

5) Semiannual Discretionary Bonus (Management Discretion): Eligible for a performance bonus tied to audited SEO KPIs, in line with company policy and the KPI scorecard. This bonus is not guaranteed and may vary in amount or may not be awarded. You must be employed and in good standing on the bonus payout date; payouts, if any, are processed within 30 days following the semiannual review window. Organic performance must be reasonably attributable to organic non-brand research and documented per Evidence & Attribution rules. Management reserves the right to adjust or withhold the bonus based on audit findings, policy violations, or business conditions.

5.1) Quality Gate, Attribution & Clawbacks: No payout if spammy links (PBNs, link schemes), policy/regulatory breaches, or invalid traffic are identified. Attribution must be to Organic Search (GA4) with non-brand filtering; GBP traffic must be UTM-tagged; calls/messages validated via GBP/telephony exports. GA4, GSC, GBP, platform dashboards, and CRM/BI exports may be requested as audit evidence. Reversed/invalid leads, chargebacks, or compliance violations identified within 90 days after payout will be deducted from the next commission/bonus payout.

6) Probation & Notices: Probation is 6 months from the start date. Notice during probation: 14 days (employer), 14–30 days (employee, per UAE Labour Law depending on whether transferring within the UAE or leaving the UAE). Post-probation notice: 30 days (both parties), unless amended by law or policy.

7) Duties, Conduct & Intellectual Property: You shall perform your duties diligently, follow all policies, and not engage in conflicts of interest. All work products, code, content, and data created in the course of employment are the intellectual property of IST Real Estate L.L.C, IST Markets / IST Groups. You must always maintain confidentiality of company and customer data.

8) Data Protection & Confidentiality: You agree to comply with internal information security standards and applicable data-protection requirements. Confidential information must not be disclosed during or after employment.

9) Company Property & Exit: Upon termination, you must return all company property and remove company data from personal devices. Final settlement will be processed per UAE Labour Law.

10) Governing Law & Dispute Resolution: This offer and your employment are governed by the laws of the United Arab Emirates. The Dubai Courts shall have jurisdiction, unless UAE law mandates otherwise.

11) Content Standards & Platform Compliance: All content must be white-hat and compliant with the current policies of each platform, including Meta, X.com, YouTube, TikTok, and Snapchat, following platform community guidelines, ad policies, intellectual property rules, disclosures, and applicable UAE regulations. Creative outputs must be SEO-first and designed to maximize discoverability and engagement while meeting the Quality Gate.

12) Entire Agreement & Variations: This letter constitutes the entire agreement relating to compensation structure and supersedes prior understandings. The Company may modify policies and KPI targets prospectively, with reasonable written notice.`,
  },
  {
    key: 'telesales',
    label: 'Tele Sales Executive',
    job_title: 'Tele Sales Executive',
    department: 'Sales',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: '20% Commission for leads provided by the company.\n30% for Personal Clients.',
    notice_period: '',
    basic_salary: 3000,
    additional_terms:
`As a Tele Sales Executive, your duties will include but are not limited to the following:
- Initiating outbound calls to potential clients and qualifying leads with a target of 200 successful calls per day.
- Explaining the company's real estate offerings and services clearly and persuasively.
- Managing and maintaining the CRM system and ensuring accurate data.
- Following up on leads and closing deals in coordination with the sales team.
- Achieving monthly sales targets and KPIs set by management.
- Handling client objections and providing appropriate solutions.
- Keeping up to date with real estate market trends and competitor offerings.
- Ensuring compliance with the company's code of conduct and client service standards.
- Representing the company in a professional manner in all communications.`,
  },
  {
    key: 'real_estate_agent',
    label: 'Real Estate Agent',
    job_title: 'Real Estate Agent',
    department: 'Sales',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: 'Employment Visa and Medical Insurance',
    commission_structure: '50% Commission for leads provided by the company.\n60% Commission for personal leads generated by the agent.',
    notice_period: '',
    basic_salary: '',
    additional_terms: '',
  },
  {
    key: 'hr_executive',
    label: 'HR Executive',
    job_title: 'HR Executive',
    department: 'Human Resources',
    reporting_manager: 'CEO',
    employment_type: 'Full-time',
    probation_period: '6 Months',
    working_hours: STANDARD_HOURS,
    leave_policy: STANDARD_LEAVE,
    benefits: STANDARD_VISA,
    commission_structure: '',
    notice_period: '',
    basic_salary: 4000,
    additional_terms:
`Job Scope & Responsibilities: You will be responsible for supporting the recruitment and onboarding function across all business units within IST Group, including:
- Managing end-to-end recruitment: sourcing, screening, shortlisting, and coordination of interviews for roles including real estate agents, telesales/business development executives, marketing and support staff, tech and operations roles.
- Posting, optimizing, and monitoring job ads on LinkedIn, Bayt, Dubizzle and other portals.
- Building and maintaining talent pipelines for active and passive candidates.
- Coordinating interviews, screening candidates, and facilitating a smooth candidate experience.
- Maintaining recruitment trackers and assisting in reporting to HR management.
- Ensuring compliance with UAE labor law during hiring, onboarding, and HR record maintenance.
- Preparing employee documentation, onboarding kits, and managing the onboarding experience.
- Coordinating pre-employment documentation and visa processing in collaboration with the PRO.
- Monitoring retention, performance metrics, and probation evaluation of new hires.
- Maintaining accurate HR records, assisting with payroll coordination, and issuing HR letters.
- Supporting employer branding, referral campaigns, and representing the company at recruitment events.
- Collaborating with department heads to document and implement HR-related policies and SOPs across all departments.

Performance Evaluation (quarterly KPIs):
Recruitment Metrics — hiring targets (5 hires monthly), time-to-fill, 85% of hires remaining beyond 6 months, 80% of hires meeting or exceeding departmental performance KPIs, reduction in early turnover (before 90 days).
HR Operational Metrics — accuracy/compliance of onboarding documentation, timely processing of visa and HR formalities, probation evaluation tracking and follow-up.
Engagement & Strategy — candidate satisfaction scores, contribution to recruitment SOPs/HR policies/onboarding enhancements, employer branding or referral program contributions, ATS data accuracy and lead conversion time.`,
  },
];

export const findOfferPreset = (key) => OFFER_PRESETS.find((p) => p.key === key) || null;
