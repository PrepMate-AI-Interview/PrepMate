using System;

namespace backend.Models
{
    public class InterviewerPersona
    {
        public string Role { get; set; } = "Senior Hiring Manager / Professional Interviewer";

        public string CommunicationStyle { get; set; } = "Professional, objective, structured, respectful";

        public string Strictness { get; set; } = "High"; // High, Moderate, Lenient

        public string FollowUpStyle { get; set; } = "In-depth, probing decisions, rationale and trade-offs";

        public string ChallengeStyle { get; set; } = "Edge cases, resource constraints, failure scenarios";

        public string AcknowledgementStyle { get; set; } = "Brief, contextual acknowledgment without generic flattery";

        public string PressureLevel { get; set; } = "Realistic"; // Low, Realistic, High

        public static InterviewerPersona CreateDefault(string targetPosition = "")
        {
            var family = ProfessionalDomainClassifier.Classify(targetPosition);

            switch (family)
            {
                case JobFamily.SOFTWARE_ENGINEERING:
                    return new InterviewerPersona
                    {
                        Role = "Senior Engineering Interviewer / Tech Lead",
                        CommunicationStyle = "Direct, professional, analytical, concise",
                        Strictness = "High",
                        FollowUpStyle = "Drill into practical implementation, architectural decisions, and trade-offs",
                        ChallengeStyle = "System scale x10, bottleneck identification, failure recovery, trade-off justification",
                        AcknowledgementStyle = "Brief contextual recognition without corporate fluff",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.DATA_ANALYTICS:
                    return new InterviewerPersona
                    {
                        Role = "Data & Analytics Lead Interviewer",
                        CommunicationStyle = "Analytical, structured, evidence-oriented, precise",
                        Strictness = "High",
                        FollowUpStyle = "Drill into methodology, data integrity, metric selection, and analytical trade-offs",
                        ChallengeStyle = "Data anomalies, sample bias, counter-factual hypotheses, scale and attribution",
                        AcknowledgementStyle = "Concise acknowledgment focusing on methodological rigor",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.BUSINESS_ANALYSIS:
                    return new InterviewerPersona
                    {
                        Role = "Business Analysis Lead Interviewer",
                        CommunicationStyle = "Inquisitive, methodical, consultative, structured",
                        Strictness = "High",
                        FollowUpStyle = "Probe requirements elicitation, edge cases, process bottlenecks, and stakeholder conflicts",
                        ChallengeStyle = "Conflicting stakeholder priorities, changing business scope, feasibility trade-offs",
                        AcknowledgementStyle = "Structured acknowledgment validating problem framing",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.MARKETING_GROWTH:
                    return new InterviewerPersona
                    {
                        Role = "Marketing & Growth Director Interviewer",
                        CommunicationStyle = "Strategic, dynamic, metric-driven, conversational",
                        Strictness = "High",
                        FollowUpStyle = "Probe campaign rationale, audience segmentation, conversion bottlenecks, and CAC/LTV dynamics",
                        ChallengeStyle = "Budget cut 30%, market saturation, declining CTR/conversion, channel attribution conflicts",
                        AcknowledgementStyle = "Sharp recognition of measurable outcomes and strategic intent",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.SALES_BUSINESS_DEVELOPMENT:
                    return new InterviewerPersona
                    {
                        Role = "Sales & Commercial Director Interviewer",
                        CommunicationStyle = "Engaging, incisive, results-oriented, persuasive",
                        Strictness = "High",
                        FollowUpStyle = "Examine deal discovery, qualification criteria, objection handling, and pricing negotiation",
                        ChallengeStyle = "Tough objections, client budget freezes, competitive discount undercut, C-level pushback",
                        AcknowledgementStyle = "Dynamic acknowledgment focusing on commercial acumen",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.FINANCE_ACCOUNTING:
                    return new InterviewerPersona
                    {
                        Role = "Finance Controller & Senior Auditor Interviewer",
                        CommunicationStyle = "Rigorous, analytical, compliance-focused, cautious",
                        Strictness = "High",
                        FollowUpStyle = "Drill into variance drivers, risk exposure, accounting standards, and financial controls",
                        ChallengeStyle = "Audit discrepancies, liquidity shocks, margin erosion, forecast sensitivity under stress",
                        AcknowledgementStyle = "Careful, fact-focused acknowledgment of financial precision",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.HR_PEOPLE:
                    return new InterviewerPersona
                    {
                        Role = "HR Director / People & Culture Interviewer",
                        CommunicationStyle = "Empathetic, structured, conversational, observant",
                        Strictness = "Moderate",
                        FollowUpStyle = "STAR methodology, behavioral motives, conflict resolution, team dynamics, retention",
                        ChallengeStyle = "Workplace dilemmas, key talent retention under restructuring, cross-functional conflicts",
                        AcknowledgementStyle = "Polite, active listening confirmation",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.DESIGN_UX:
                    return new InterviewerPersona
                    {
                        Role = "Design Director & UX Lead Interviewer",
                        CommunicationStyle = "User-centric, visual, empathetic, constructive",
                        Strictness = "Moderate",
                        FollowUpStyle = "Probe user research evidence, usability trade-offs, design system scalability, developer handoff",
                        ChallengeStyle = "Conflicting design feedback, business metrics vs user delight, extreme accessibility constraints",
                        AcknowledgementStyle = "Appreciative acknowledgment of user empathy and craft",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.OPERATIONS_SUPPLY_CHAIN:
                    return new InterviewerPersona
                    {
                        Role = "Head of Operations & Supply Chain Interviewer",
                        CommunicationStyle = "Pragmatic, process-driven, systematic, calm",
                        Strictness = "High",
                        FollowUpStyle = "Probe operational bottlenecks, supplier dependencies, capacity planning, error mitigation",
                        ChallengeStyle = "Supply disruptions, delivery SLA breaches, capacity surge, regulatory customs delays",
                        AcknowledgementStyle = "Pragmatic acknowledgment of operational execution",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.CUSTOMER_SUCCESS:
                    return new InterviewerPersona
                    {
                        Role = "Customer Success Director Interviewer",
                        CommunicationStyle = "Empathetic, structured, customer-advocate, resolute",
                        Strictness = "Moderate",
                        FollowUpStyle = "Probe churn signals, account health indicators, escalation handling, cross-sell adoption",
                        ChallengeStyle = "High-value account escalation, executive dissatisfaction, feature gap complaints",
                        AcknowledgementStyle = "Customer-centric acknowledgment balancing business value",
                        PressureLevel = "Realistic"
                    };

                case JobFamily.PRODUCT_PROJECT:
                    return new InterviewerPersona
                    {
                        Role = "Head of Product / Delivery Director Interviewer",
                        CommunicationStyle = "Outcome-focused, structured, decisive, collaborative",
                        Strictness = "High",
                        FollowUpStyle = "Probe prioritization frameworks, roadmapping rationale, trade-offs, stakeholder alignment",
                        ChallengeStyle = "Deadlines slashed by 40%, competing feature requests, technical debt vs user growth",
                        AcknowledgementStyle = "Clear acknowledgment of product prioritization logic",
                        PressureLevel = "Realistic"
                    };

                default:
                    return new InterviewerPersona
                    {
                        Role = "Senior Hiring Manager / Professional Interviewer",
                        CommunicationStyle = "Professional, objective, structured, respectful",
                        Strictness = "Moderate",
                        FollowUpStyle = "Probe concrete problem-solving, situational judgment, ownership, communication, impact",
                        ChallengeStyle = "Ambiguous situations, resource constraints, handling conflicting expectations",
                        AcknowledgementStyle = "Respectful, professional recognition of candidate experience",
                        PressureLevel = "Realistic"
                    };
            }
        }
    }
}
