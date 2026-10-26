using backend.Models.AI;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;

namespace backend.Services
{
    public class QuestionGenerationService
    {
        private readonly GeminiService _geminiService;
        private readonly backend.Services.Knowledge.IKnowledgeRepository? _knowledgeRepository;

        public QuestionGenerationService(
            GeminiService geminiService,
            backend.Services.Knowledge.IKnowledgeRepository? knowledgeRepository = null)
        {
            _geminiService = geminiService;
            _knowledgeRepository = knowledgeRepository;
        }

        // =========================================================
        // GENERATE FIRST QUESTION AFTER INTRODUCTION
        // =========================================================
        public async Task<GeneratedQuestion>
            GenerateAfterIntroductionAsync(
                Session session,
                AnswerAnalysis introductionAnalysis)
        {
            var context = session.InterviewContext;
            var state = session.InterviewState;

            if (context == null)
            {
                throw new InvalidOperationException(
                    "InterviewContext chưa được khởi tạo."
                );
            }

            var skills =
                context.Skills.Count > 0
                    ? string.Join(", ", context.Skills)
                    : "Chưa xác định";

            var candidateTopics =
                context.CandidateTopics.Count > 0
                    ? string.Join(", ", context.CandidateTopics)
                    : "Chưa xác định";

            var expectedTopics =
                context.ExpectedTopics.Count > 0
                    ? string.Join(", ", context.ExpectedTopics)
                    : "Chưa xác định";


            var persona = context.Persona ?? InterviewerPersona.CreateDefault(context.TargetPosition);

            var prompt = backend.Prompts.Interview.QuestionGenerationPrompt.BuildFirstQuestion(
                state,
                context,
                introductionAnalysis
            );
            var json =
                await _geminiService.CallGeminiApiForTaskAsync(AITaskType.QuestionGeneration,                    prompt,
                    isJsonMode: true
                );



            Console.WriteLine(
                "========== FIRST QUESTION =========="
            );

            Console.WriteLine(json);



            var options =
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };



            var result =
                JsonSerializer.Deserialize<GeneratedQuestion>(
                    json,
                    options
                );



            ValidateQuestion(result);



            result!.DecisionUsed =
                "INTRODUCTION";


            result.IsFollowUp =
                false;



            UpdateState(
                state,
                result
            );



            return result;
        }





        // =========================================================
        // GENERATE ADAPTIVE QUESTION
        // =========================================================

        public async Task<GeneratedQuestion>
            GenerateAsync(
                Session session,
                AnswerAnalysis analysis)
        {

            var context =
                session.InterviewContext;

            var state =
                session.InterviewState;

            string nextTopic = state.CurrentTopic;

            if (state.LastDecision == "ChangeTopic")
            {
                nextTopic = !string.IsNullOrWhiteSpace(state.ActiveTargetEvaluation?.AreaName)
                    ? state.ActiveTargetEvaluation.AreaName
                    : (!string.IsNullOrWhiteSpace(state.CurrentTopic)
                        ? state.CurrentTopic
                        : (state.TopicsRemaining.FirstOrDefault() ?? string.Empty));
            }

            if (context == null)
            {
                throw new InvalidOperationException(
                    "InterviewContext chưa được khởi tạo."
                );
            }



            var recentHistory =
                session.Answers
                .TakeLast(5)
                .Select(
                    (x, i) =>
                    $"""
Q{i + 1}: {x.Question}

A{i + 1}: {x.Answer}
"""
                )
                .ToList();



            var history =
                recentHistory.Count > 0
                ?
                string.Join(
                    "\n\n",
                    recentHistory
                )
                :
                "Chưa có lịch sử";

            // Step 8: Ensure ActiveTargetEvaluation has repository context if available and not yet populated
            if (state.ActiveTargetEvaluation != null && _knowledgeRepository != null &&
                (state.ActiveTargetEvaluation.RepositoryItems == null || state.ActiveTargetEvaluation.RepositoryItems.Count == 0))
            {
                try
                {
                    InterviewAction? currentAction = null;
                    if (Enum.TryParse<InterviewAction>(state.LastDecision, out var act))
                    {
                        currentAction = act;
                    }
                    var repoItems = _knowledgeRepository.GetRelevantItems(state.ActiveTargetEvaluation.ConceptId, currentAction, state.CandidateLevel);
                    if (repoItems != null && repoItems.Count > 0)
                    {
                        state.ActiveTargetEvaluation.RepositoryItems = repoItems;
                        foreach (var item in repoItems)
                        {
                            if (item.Type == RepositoryItemType.SCENARIO || item.Type == RepositoryItemType.EXAMPLE)
                            {
                                state.ActiveTargetEvaluation.ReferenceScenarios.Add(item.Content);
                            }
                            else
                            {
                                state.ActiveTargetEvaluation.QuestionPatterns.Add(item.Content);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[QUESTION GEN REPOSITORY FALLBACK] {ex.Message}");
                }
            }

            var prompt = QuestionPrompt.Build(
                state,
                nextTopic,
                context,
                analysis,
                history,
                state.ActiveTargetEvaluation
            );

            var json =
                await _geminiService.CallGeminiApiAsync(
                    prompt,
                    isJsonMode: true
                );

            Console.WriteLine(
                "========== ADAPTIVE QUESTION =========="
            );

            Console.WriteLine(json);
            var options =
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

            var result =
                JsonSerializer.Deserialize<GeneratedQuestion>(
                    json,
                    options
                );
            ValidateQuestion(result);

            if (string.IsNullOrWhiteSpace(result!.TargetConcept) && state.ActiveTargetEvaluation != null)
            {
                result.TargetConcept = state.ActiveTargetEvaluation.ConceptName;
            }

            result!.DecisionUsed =
                state.LastDecision;

            result.IsFollowUp =
                !string.Equals(state.LastDecision, "ChangeTopic", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(state.LastDecision, "INTRODUCTION_COMPLETE", StringComparison.OrdinalIgnoreCase);

            UpdateState(
                state,
                result
            );

            if (session.EvidenceState != null)
            {
                var spec = new InterviewQuestionSpecification
                {
                    Stage = result.Stage ?? session.InterviewState?.InterviewPhase ?? InterviewStageNames.TechnicalAssessment,
                    TargetCompetency = result.TargetConcept ?? state.ActiveTargetEvaluation?.ConceptName ?? nextTopic,
                    TargetDimension = result.Dimension ?? "Technical",
                    QuestionType = result.IsFollowUp ? InterviewQuestionType.FOLLOW_UP : (string.Equals(state.LastDecision, "ChangeTopic", StringComparison.OrdinalIgnoreCase) ? InterviewQuestionType.BRIDGE : InterviewQuestionType.INITIAL),
                    Objective = $"Khảo sát năng lực {result.TargetConcept ?? nextTopic} ở khía cạnh {result.Dimension ?? "chuyên môn"}.",
                    Context = $"{context.Industry} / {context.TargetPosition} / {context.ExperienceLevel}",
                    ParentQuestionId = result.ParentQuestionId ?? state.LastParentQuestionId,
                    Difficulty = result.Difficulty,
                    IsFollowUp = result.IsFollowUp,
                    DeterministicWording = result.Question
                };
                session.EvidenceState.QuestionSpecifications.Add(spec);
                session.EvidenceState.CurrentQuestionSpecification = spec;
            }

            return result;
        }

        // =========================================================
        // VALIDATE GENERATED QUESTION
        // =========================================================
        private void ValidateQuestion(
            GeneratedQuestion? question)
        {
            if (question == null)
            {
                throw new InvalidOperationException(
                    "AI trả về null question."
                );
            }

            if (string.IsNullOrWhiteSpace(
                question.Question))
            {
                throw new InvalidOperationException(
                    "AI không tạo được nội dung câu hỏi."
                );
            }

            if (string.IsNullOrWhiteSpace(
                question.Topic))
            {
                question.Topic =
                    "General";
            }

            if (string.IsNullOrWhiteSpace(
                question.Subtopic))
            {
                question.Subtopic =
                    question.Topic;
            }

            if (string.IsNullOrWhiteSpace(
                question.Dimension))
            {
                question.Dimension =
                    "Technical";
            }

            if (string.IsNullOrWhiteSpace(
                question.QuestionType))
            {
                question.QuestionType =
                    "EXPLANATION";
            }

            if (question.Difficulty < 1)
            {
                question.Difficulty = 1;
            }

            if (question.Difficulty > 4)
            {
                question.Difficulty = 4;
            }
        }

        // =========================================================
        // UPDATE INTERVIEW STATE
        // =========================================================
        private void UpdateState(
    InterviewState state,
    GeneratedQuestion question)
        {
            // Generated question metadata only.
            // Interview flow state is controlled by AdaptiveInterviewEngine.

            state.CurrentTopic =
                question.Topic;

            state.CurrentSubtopic =
                question.Subtopic;

            state.CurrentDimension =
                question.Dimension;

            if (!string.IsNullOrWhiteSpace(question.QuestionType))
            {
                if (!state.QuestionTypesUsed.Contains(
                    question.QuestionType,
                    StringComparer.OrdinalIgnoreCase))
                {
                    state.QuestionTypesUsed.Add(
                        question.QuestionType);
                }
            }

            if (!string.IsNullOrWhiteSpace(question.TargetConcept))
            {
                if (!state.DiscoveredConcepts.Contains(
                    question.TargetConcept,
                    StringComparer.OrdinalIgnoreCase))
                {
                    state.DiscoveredConcepts.Add(
                        question.TargetConcept);
                }
            }
        }
        // =========================================================
        // BUILD HISTORY STRING
        // =========================================================

        private string BuildRecentHistory(
            Session session,
            int take = 5)
        {

            var history =
                session.Answers
                .TakeLast(take)
                .Select(
                    (x, index) =>
                    $"""
Question {index + 1}:
{x.Question}

Answer:
{x.Answer}
"""
                )
                .ToList();

            if (history.Count == 0)
            {
                return
                    "Chưa có lịch sử.";
            }

            return string.Join(
                "\n\n",
                history
            );
        }

        // =========================================================
        // SAFE JOIN LIST
        // =========================================================

        private string JoinList(
            System.Collections.Generic.List<string>? values)
        {
            if (values == null ||
               values.Count == 0)
            {
                return "Không có";
            }

            return string.Join(
                ", ",
                values
            );
        }

    }
}