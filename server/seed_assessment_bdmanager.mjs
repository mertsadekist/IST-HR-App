// Seeds "Senior Business Development Manager (Forex/CFD)" as Assessment
// Template v1 for every company, from the source interview questionnaire.
// Re-weighted onto the system's scoring model: 3 stages, 100 points each
// (10 questions x 10 points), 60/100 passing score per stage, 20-min default
// duration, 300-point maximum. The original document's own point scale
// (25/20/50) and per-round timings are NOT preserved — see
// docs (assessment module) for the rationale.
//
// Idempotent: matched by (company_id, name). Safe to re-run — an existing
// template for a company is left untouched (edit it via the UI instead).
// Run: node seed_assessment_bdmanager.mjs
import pool from './config/db.js';

const TEMPLATE_NAME = 'Senior Business Development Manager (Forex/CFD)';
const POSITION_TITLE = 'Senior Business Development Manager – Forex/CFD';

// ── Stage 1 — Screening & Commercial Experience (short/open answer) ────────
const STAGE1 = {
  name: 'Screening & Commercial Experience',
  duration_minutes: 20,
  questions: [
    {
      type: 'short_answer',
      question_text: 'How many total years of Business Development or Sales experience do you have, and how many of those years are specifically within Forex, CFDs, brokerage, or financial services?',
      ai_eval_instructions: 'Strong answer: 5+ years of relevant Business Development/Sales experience with meaningful direct exposure to Forex/CFD or financial services. The candidate should clearly separate total experience from directly relevant industry experience.',
    },
    {
      type: 'short_answer',
      question_text: 'Which client segments have you personally managed? (e.g. Retail / HNW / Professional / Institutional / Corporate / IBs / Affiliates / Money Managers)',
      ai_eval_instructions: 'Strong answer: Direct ownership of several relevant segments, ideally including HNW clients, IBs, affiliates, professional or institutional relationships. Look for specific examples rather than broad claims.',
    },
    {
      type: 'short_answer',
      question_text: 'Which countries or geographical markets have you actively developed or managed?',
      ai_eval_instructions: 'Strong answer: Specific countries/regions, client profiles, acquisition channels, and evidence of market familiarity. Senior candidates should be able to explain differences between markets rather than simply list countries.',
    },
    {
      type: 'short_answer',
      question_text: 'What languages do you use professionally when communicating with clients or partners?',
      ai_eval_instructions: 'English is essential. Additional languages are an advantage when relevant to target markets.',
    },
    {
      type: 'short_answer',
      question_text: 'What were the three most important KPIs in your current or most recent Business Development role?',
      ai_eval_instructions: 'Strong answer may include revenue, net deposits, funded accounts, active clients, trading volume, conversion rate, retention, IB productivity, pipeline value, or client lifetime value. Weak answer: only call volume, meetings, or generic activity metrics without commercial outcomes.',
    },
    {
      type: 'short_answer',
      question_text: 'Please provide one measurable example of your recent performance, such as monthly deposits, revenue, trading volume, new active clients, or number of productive IBs acquired.',
      ai_eval_instructions: "Strong answer: Specific numbers, defined period, personal contribution, and business outcome. Example: 'I brought 12 productive IBs in six months; 8 remained active and generated approximately X monthly volume/revenue.'",
    },
    {
      type: 'open_ended',
      question_text: 'Consistency Check A: How do you decide whether an IB or affiliate network is genuinely valuable to the brokerage?',
      expected_answer: 'Expected principle: Quality and sustainable commercial value matter more than the number of contacts. A strong answer should mention several of the following: funded active clients, deposit quality, trading volume, retention, conversion, profitability, client quality, compliance profile, target-market fit, and sustainability.',
      ai_eval_instructions: 'This question is paired with Stage 2 Q5 as a cross-stage consistency validation check on the same underlying principle. Score this answer on its own merits, but note in the evaluation whether the candidate leans quantity-of-contacts (weak) or quality/sustainable-value (strong) — that framing is compared against their Stage 2 Q5 selection to flag possible rehearsed or guessed answers.',
      consistency_pair: true,
    },
    {
      type: 'short_answer',
      question_text: 'Which trading platforms and CRM systems have you worked with? (e.g. MT4, MT5, cTrader, Salesforce, HubSpot, Bitrix24, proprietary brokerage CRMs)',
      ai_eval_instructions: 'Strong answer: Practical use of MT4/MT5 or comparable platforms plus CRM/pipeline systems, with a description of how the tools were actually used rather than just names listed.',
    },
    {
      type: 'short_answer',
      question_text: 'Have you managed or mentored Business Development or Sales employees? If yes, how many people and what was your responsibility?',
      ai_eval_instructions: 'Strong answer: Clear team size, target-setting responsibility, coaching, performance management, pipeline reviews, and measurable team outcomes.',
    },
    {
      type: 'short_answer',
      question_text: 'Why are you considering leaving your current company, why are you interested in this role, what are your compensation expectations, and when could you join?',
      ai_eval_instructions: 'Strong answer: Professional motivation, realistic expectations, clear availability, and no major contradictions. Assess stability, motivation, and practical alignment rather than over-weighting style.',
    },
  ],
};

// ── Stage 2 — Technical & Commercial Judgment (multiple choice) ────────────
const STAGE2 = {
  name: 'Technical & Commercial Judgment (MCQ)',
  duration_minutes: 20,
  questions: [
    {
      type: 'multiple_choice',
      question_text: 'Which statement best describes Forex and CFDs?',
      options: [
        { key: 'A', text: 'Forex and CFDs are exactly the same financial product.' },
        { key: 'B', text: 'Forex focuses on currency trading, while CFDs are derivative instruments that can provide exposure to currencies and other underlying markets.' },
        { key: 'C', text: 'CFDs can only be used for commodities.' },
        { key: 'D', text: 'Forex trading does not involve leverage.' },
      ],
      correct_option_key: 'B',
      ai_eval_instructions: 'Correct: B. Shows basic product understanding without oversimplifying the two concepts.',
    },
    {
      type: 'multiple_choice',
      question_text: 'A client asks why high leverage can be risky. Which is the most appropriate response?',
      options: [
        { key: 'A', text: 'Higher leverage guarantees higher profits.' },
        { key: 'B', text: 'Leverage only increases profit potential but does not affect losses.' },
        { key: 'C', text: 'Leverage increases market exposure relative to deposited capital and can significantly magnify both gains and losses.' },
        { key: 'D', text: 'Leverage has no material impact on risk.' },
      ],
      correct_option_key: 'C',
      ai_eval_instructions: 'Correct: C. Senior commercial staff should explain leverage accurately and without minimizing risk.',
    },
    {
      type: 'multiple_choice',
      question_text: 'Which answer provides the best general comparison between MT4 and MT5?',
      options: [
        { key: 'A', text: 'MT4 and MT5 have no meaningful differences.' },
        { key: 'B', text: 'MT5 generally offers broader functionality, additional order types, more timeframes, and multi-asset capabilities, while actual product availability depends on the broker.' },
        { key: 'C', text: 'MT5 only supports cryptocurrency trading.' },
        { key: 'D', text: 'MT4 is always faster than MT5.' },
      ],
      correct_option_key: 'B',
      ai_eval_instructions: 'Correct: B. A strong candidate should also explain practical differences beyond memorized marketing claims.',
    },
    {
      type: 'multiple_choice',
      question_text: 'You identify a potential high-net-worth client. What should your first priority be?',
      options: [
        { key: 'A', text: 'Immediately offer the highest possible leverage.' },
        { key: 'B', text: "Understand the client's profile, objectives, eligibility, needs, and commercial potential before presenting an appropriate solution." },
        { key: 'C', text: 'Offer the lowest possible spread before asking any questions.' },
        { key: 'D', text: 'Ask the client to deposit immediately.' },
      ],
      correct_option_key: 'B',
      ai_eval_instructions: 'Correct: B. Good business development starts with qualification and suitability, not immediate price discounting or deposit pressure.',
    },
    {
      type: 'multiple_choice',
      question_text: 'Consistency Check B: Which combination best indicates that an Introducing Broker is commercially valuable?',
      options: [
        { key: 'A', text: 'A large social-media following and a large contact list.' },
        { key: 'B', text: 'High requested commission and frequent communication with the sales team.' },
        { key: 'C', text: 'Quality funded clients, sustainable trading activity, retention, commercial profitability, market fit, and an acceptable compliance profile.' },
        { key: 'D', text: 'The number of leads submitted, regardless of conversion or quality.' },
      ],
      correct_option_key: 'C',
      ai_eval_instructions: "Correct: C. This tests the same core principle as Stage 1's Consistency Check A: sustainable quality is more important than superficial network size. Compare this choice against the candidate's Stage 1 answer — a quantity-focused Stage 1 answer paired with an unexplained correct choice here is a possible rehearsed/guessed-answer signal, not automatic disqualification.",
      consistency_pair: true,
    },
    {
      type: 'multiple_choice',
      question_text: 'Which sequence represents the most appropriate Business Development pipeline?',
      options: [
        { key: 'A', text: 'Lead → Deposit → Qualification → KYC.' },
        { key: 'B', text: 'Prospecting → Qualification → Needs Assessment → Proposal/Negotiation → Compliance & Onboarding → Activation → Relationship Management.' },
        { key: 'C', text: 'Marketing → Deposit → Client Call.' },
        { key: 'D', text: 'Prospecting → Commission Negotiation → Deposit.' },
      ],
      correct_option_key: 'B',
      ai_eval_instructions: 'Correct: B. The candidate should understand the full lifecycle, not only acquisition.',
    },
    {
      type: 'multiple_choice',
      question_text: 'A previously active client has significantly reduced trading activity. What is the best approach?',
      options: [
        { key: 'A', text: 'Pressure the client to increase trading volume.' },
        { key: 'B', text: 'Increase leverage automatically.' },
        { key: 'C', text: 'Diagnose why activity declined, identify service or product issues, segment the client correctly, and conduct appropriate compliant re-engagement.' },
        { key: 'D', text: 'Contact the client repeatedly until trading resumes.' },
      ],
      correct_option_key: 'C',
      ai_eval_instructions: 'Correct: C. The goal is sustainable reactivation based on client needs and service quality, not pressure.',
    },
    {
      type: 'multiple_choice',
      question_text: 'A potential IB says another broker offers higher commission and lower spreads. What is the strongest response?',
      options: [
        { key: 'A', text: 'Immediately offer a higher commission regardless of profitability.' },
        { key: 'B', text: 'Criticize the competitor.' },
        { key: 'C', text: "Understand the partner's commercial priorities and position the total value proposition, including execution, service, technology, conversion, retention, support, and sustainable commercial terms." },
        { key: 'D', text: 'End the discussion.' },
      ],
      correct_option_key: 'C',
      ai_eval_instructions: 'Correct: C. Senior BD professionals should sell total commercial value instead of competing only on price.',
    },
    {
      type: 'multiple_choice',
      question_text: 'A high-value partner could generate significant revenue, but Compliance identifies unresolved KYC/AML concerns. What should you do?',
      options: [
        { key: 'A', text: 'Approve the partner because the expected revenue is significant.' },
        { key: 'B', text: 'Ask Operations to bypass Compliance.' },
        { key: 'C', text: 'Pause onboarding and work with Compliance to resolve the concerns before proceeding.' },
        { key: 'D', text: 'Open the account first and complete KYC later.' },
      ],
      correct_option_key: 'C',
      ai_eval_instructions: 'Correct: C. Commercial importance does not override onboarding and compliance requirements. Treat a different answer here as a compliance-judgment concern worth an HR note regardless of the numeric score.',
    },
    {
      type: 'multiple_choice',
      question_text: 'You are assigned a new country with no existing company presence. What should be assessed first?',
      options: [
        { key: 'A', text: 'Office decoration and local branding.' },
        { key: 'B', text: 'Regulatory feasibility, market size, target client segments, competitors, acquisition channels, partnership opportunities, economics, and execution requirements.' },
        { key: 'C', text: 'Commission rates only.' },
        { key: 'D', text: 'Social-media follower numbers.' },
      ],
      correct_option_key: 'B',
      ai_eval_instructions: 'Correct: B. This demonstrates structured market-entry thinking.',
    },
  ],
};

// ── Stage 3 — Leadership & Strategic Management (open-ended) ───────────────
const STAGE3 = {
  name: 'Leadership & Strategic Management',
  duration_minutes: 20,
  questions: [
    {
      type: 'open_ended',
      question_text: 'You join the company next month. What would your first 90-day Business Development plan look like?',
      ai_eval_instructions: '30/60/90-day structure; pipeline audit; market and product understanding; client/IB segmentation; team assessment; early revenue opportunities; compliance alignment; CRM discipline; clear KPIs; reporting cadence; realistic quick wins and longer-term priorities.',
    },
    {
      type: 'open_ended',
      question_text: 'How would you build a 12-month Business Development strategy for a Forex/CFD brokerage?',
      ai_eval_instructions: 'Links target markets, client segments, partner channels, deposits, active clients, volume, revenue, retention, budgets, compliance constraints, ownership, and measurable milestones.',
    },
    {
      type: 'open_ended',
      question_text: 'How would you set targets for a Business Development team?',
      ai_eval_instructions: 'Balanced scorecard: revenue, deposits, active clients, volume, qualified pipeline, conversion, retention, productive IBs, quality metrics, activity levels, and market potential. Targets should be data-driven and reviewed regularly.',
    },
    {
      type: 'open_ended',
      question_text: 'A Business Development Manager has achieved only 55% of target for three consecutive months. How would you manage the situation?',
      ai_eval_instructions: 'Diagnose root cause before action: activity, lead quality, conversion, market, skills, discipline, pricing, product or strategy. Agree corrective actions, coaching, deadlines, measurable checkpoints, and consequences if performance does not improve.',
    },
    {
      type: 'open_ended',
      question_text: "Explain how you would forecast next quarter's revenue.",
      ai_eval_instructions: 'Uses weighted pipeline, historical conversion, deposits, funded/active accounts, trading volume, IB production, revenue per segment, retention/churn, seasonality, market assumptions, confidence ranges, and scenario analysis.',
    },
    {
      type: 'open_ended',
      question_text: 'The company is considering expansion into three new countries but can focus on only one. How would you decide which market to prioritize?',
      ai_eval_instructions: 'Regulation, addressable market, client economics, competition, acquisition cost, local payment/onboarding realities, partner availability, language, operational readiness, brand fit, risk, time-to-revenue, and expected return.',
    },
    {
      type: 'open_ended',
      question_text: 'A major IB can potentially generate significant monthly volume but is demanding a commission structure that makes the relationship commercially unattractive. How would you negotiate the deal?',
      ai_eval_instructions: "Quantifies unit economics, understands partner priorities, uses tiered/conditional terms, volume thresholds, pilot period, performance-based incentives, service differentiation, and walks away if economics remain unsustainable.",
    },
    {
      type: 'open_ended',
      question_text: 'One of your highest-revenue partners requests an exception that conflicts with internal Compliance requirements. What would you do, and how would you manage the relationship afterward?',
      ai_eval_instructions: 'No circumvention. Clarify the rule, involve Compliance, identify any legitimate compliant alternative, document the decision, communicate professionally, and protect the relationship without compromising regulatory or internal requirements.',
    },
    {
      type: 'open_ended',
      question_text: 'If our spreads, commissions, and leverage were similar to several competitors, how would you differentiate the brokerage?',
      ai_eval_instructions: 'Execution quality, platform stability, onboarding, service, partner support, product breadth, technology, reporting, local market support, payment experience, trust, transparency, retention support, operational responsiveness, and specialization.',
    },
    {
      type: 'open_ended',
      question_text: 'If we hire you, what measurable results would you expect to deliver during your first 6–12 months, and why should we believe you can achieve them?',
      ai_eval_instructions: 'Specific but credible ranges tied to baseline assumptions. Candidate should explain the mechanism, resources, pipeline, market knowledge, team capacity, and evidence from prior achievements. Avoid accepting unsupported "I will double revenue" claims without a rationale.',
    },
  ],
};

const STAGES = [STAGE1, STAGE2, STAGE3];

try {
  const [companies] = await pool.query("SELECT id FROM companies WHERE status = 'Active'");
  if (!companies.length) {
    console.log('No active companies found — nothing to seed.');
  }

  for (const { id: companyId } of companies) {
    const [[existing]] = await pool.query(
      'SELECT id FROM assessment_templates WHERE company_id = ? AND name = ?', [companyId, TEMPLATE_NAME]);
    if (existing) {
      console.log(`company ${companyId}: template already present (#${existing.id}) — skipped`);
      continue;
    }

    const [tplRes] = await pool.query('INSERT INTO assessment_templates SET ?', {
      company_id: companyId, name: TEMPLATE_NAME, position_title: POSITION_TITLE, status: 'Active',
    });
    const templateId = tplRes.insertId;

    const [verRes] = await pool.query('INSERT INTO assessment_template_versions SET ?', {
      template_id: templateId, version_no: 1, is_current: true,
      change_note: 'Initial version, seeded from the source interview questionnaire.',
    });
    const versionId = verRes.insertId;

    // stageOrder -> { questionOrder -> insertedQuestionId }, used to wire the
    // cross-stage consistency pair after every question has an id.
    const insertedIds = {};
    let consistencyPairSourceId = null; // Stage 1 Q7
    let consistencyPairTargetInfo = null; // { stageOrder, questionOrder } of Stage 2 Q5, resolved after the loop

    for (let s = 0; s < STAGES.length; s++) {
      const stageOrder = s + 1;
      const stageDef = STAGES[s];
      const [stageRes] = await pool.query('INSERT INTO assessment_stages SET ?', {
        template_version_id: versionId, stage_order: stageOrder, name: stageDef.name,
        duration_minutes: stageDef.duration_minutes, max_score: 100, passing_score: 60,
      });
      const stageId = stageRes.insertId;
      insertedIds[stageOrder] = {};

      for (let q = 0; q < stageDef.questions.length; q++) {
        const questionOrder = q + 1;
        const qDef = stageDef.questions[q];
        const [qRes] = await pool.query('INSERT INTO assessment_questions SET ?', {
          stage_id: stageId, question_order: questionOrder, type: qDef.type,
          question_text: qDef.question_text,
          options: qDef.options ? JSON.stringify(qDef.options) : null,
          correct_option_key: qDef.correct_option_key || null,
          expected_answer: qDef.expected_answer || null,
          ai_eval_instructions: qDef.ai_eval_instructions || null,
          weight: 10,
        });
        insertedIds[stageOrder][questionOrder] = qRes.insertId;

        if (stageOrder === 1 && questionOrder === 7) consistencyPairSourceId = qRes.insertId;
        if (stageOrder === 2 && questionOrder === 5) consistencyPairTargetInfo = qRes.insertId;
      }
    }

    if (consistencyPairSourceId && consistencyPairTargetInfo) {
      await pool.query('UPDATE assessment_questions SET consistency_pair_question_id = ? WHERE id = ?',
        [consistencyPairSourceId, consistencyPairTargetInfo]);
    }

    console.log(`company ${companyId}: seeded template #${templateId} (version #${versionId})`);
  }

  console.log('ASSESSMENT SEED OK');
} catch (e) {
  console.error('SEED ERROR:', e.message);
  process.exitCode = 1;
} finally { await pool.end(); }
