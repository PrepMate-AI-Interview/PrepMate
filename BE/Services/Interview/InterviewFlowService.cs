using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using backend.Models;
using backend.Prompts.Interview;
using backend.Services;
using backend.Services.AI;
using backend.Services.Knowledge;

namespace backend.Services.Interview
{
    public class InterviewFlowService
    {
        private readonly FileDb _fileDb;
        private readonly GeminiService _geminiService;
        private readonly AdaptiveInterviewEngine _adaptiveInterviewEngine;
        private readonly QuestionGenerationService _questionGenerationService;
        private readonly KnowledgeCoverageService _knowledgeCoverageService;
        private readonly InterviewStageOrchestrator _stageOrchestrator;
        private readonly IBehavioralInterviewService _behavioralService;
        private readonly ISituationalInterviewService _situationalService;
        private readonly ICandidateQuestionService _candidateQuestionService;
        private readonly IClosingService _closingService;
        private readonly backend.Services.Storage.ISessionLockManager? _sessionLockManager;
        private readonly INoAiModeService? _noAiModeService;
        private readonly IAIRouter? _aiRouter;

        public InterviewFlowService(
            FileDb fileDb,
            GeminiService geminiService,
            AdaptiveInterviewEngine adaptiveInterviewEngine,
            QuestionGenerationService questionGenerationService,
            KnowledgeCoverageService knowledgeCoverageService,
            InterviewStageOrchestrator? stageOrchestrator = null,
            IBehavioralInterviewService? behavioralService = null,
            ISituationalInterviewService? situationalService = null,
            ICandidateQuestionService? candidateQuestionService = null,
            IClosingService? closingService = null,
            backend.Services.Storage.ISessionLockManager? sessionLockManager = null,
            INoAiModeService? noAiModeService = null,
            IAIRouter? aiRouter = null)
        {
            _fileDb = fileDb;
            _geminiService = geminiService;
            _adaptiveInterviewEngine = adaptiveInterviewEngine;
            _questionGenerationService = questionGenerationService;
            _knowledgeCoverageService = knowledgeCoverageService;
            _stageOrchestrator = stageOrchestrator ?? new InterviewStageOrchestrator();
            _behavioralService = behavioralService ?? new BehavioralInterviewService(geminiService);
            _situationalService = situationalService ?? new SituationalInterviewService(geminiService);
            _candidateQuestionService = candidateQuestionService ?? new CandidateQuestionService(geminiService);
            _closingService = closingService ?? new ClosingService(geminiService);
            _sessionLockManager = sessionLockManager;
            _noAiModeService = noAiModeService;
            _aiRouter = aiRouter;
        }

        public async Task<InterviewFlowResult> ProcessIntroductionAsync(
            IntroductionRequest request)
        {
            Console.WriteLine();
            Console.WriteLine(
                "========== /api/ai/introduction CALLED =========="
            );

            Console.WriteLine(
                $"SessionId: {request.SessionId}"
            );

            Console.WriteLine(
                $"Introduction length: {request.Introduction?.Length ?? 0}"
            );

            Console.WriteLine(
                "=================================================="
            );
            Console.WriteLine();

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return InterviewFlowResult.BadRequest(
                    "Thiếu SessionId."
                );
            }

            if (string.IsNullOrWhiteSpace(request.Introduction))
            {
                return InterviewFlowResult.BadRequest(
                    "Phần giới thiệu không được để trống."
                );
            }

            IDisposable? sessionLock = null;
            if (_sessionLockManager != null)
            {
                sessionLock = await _sessionLockManager.AcquireLockAsync(request.SessionId);
            }

            Session? session = null;
            InterviewState? state = null;

            try
            {
                if (!_fileDb.Sessions.TryGetValue(
                        request.SessionId,
                        out session) || session == null)
                {
                    return InterviewFlowResult.NotFound(
                        "Không tìm thấy session."
                    );
                }

                var isCompleted = session.Status.Equals("completed", StringComparison.OrdinalIgnoreCase) ||
                                  session.InterviewState?.InterviewPhase.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true;
                if (isCompleted)
                {
                    return InterviewFlowResult.BadRequest("Phiên phỏng vấn đã hoàn tất, không thể tiếp tục gửi câu trả lời.");
                }

                if (session.InterviewContext == null)
                {
                    return InterviewFlowResult.BadRequest(
                        "Session chưa có InterviewContext."
                    );
                }

                state = session.InterviewState ??= new();

                if (state.InterviewPhase != "INTRODUCTION")
                {
                    return InterviewFlowResult.BadRequest(
                        "Session không ở phase INTRODUCTION."
                    );
                }

                if (state.IntroductionCompleted)
                {
                    return InterviewFlowResult.BadRequest(
                        "Phần giới thiệu đã được hoàn thành."
                    );
                }

                if (string.IsNullOrWhiteSpace(request.Introduction))
                {
                    return InterviewFlowResult.BadRequest(
                        "Nội dung giới thiệu bản thân không được để trống."
                    );
                }

                // =====================================================
                // 1. SAVE INTRODUCTION
                // =====================================================

                var introduction =
                    request.Introduction.Trim();

                state.IntroductionAnswer =
                    introduction;

                state.IntroductionCompleted =
                    true;

                // =====================================================
                // 2. STORE INTRODUCTION IN TRANSCRIPT
                // =====================================================

                session.Answers ??=
                    new List<AnswerItem>();

                session.Answers.Add(
                    new AnswerItem
                    {
                        Question =
                            "Giới thiệu bản thân",

                        Answer =
                            introduction
                    }
                );

                // =====================================================
                // 3. ANALYZE INTRODUCTION
                // =====================================================

                var targetPosition =
                    string.IsNullOrWhiteSpace(
                        session.InterviewContext.TargetPosition)
                        ? session.JobTitle
                        : session.InterviewContext.TargetPosition;

                var prompt = IntroductionPrompt.Build(targetPosition, introduction);

                var json =
                    await _geminiService.CallGeminiApiForTaskAsync(
                        backend.Models.AI.AITaskType.IntroductionAnalysis,
                        prompt,
                        isJsonMode: true
                    );

                Console.WriteLine();
                Console.WriteLine(
                    "========== INTRODUCTION ANALYSIS =========="
                );
                Console.WriteLine(json);
                Console.WriteLine(
                    "==========================================="
                );
                Console.WriteLine();

                var options =
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                var cleanJson = json.Trim();
                if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                {
                    cleanJson = cleanJson.Substring(7);
                }
                else if (cleanJson.StartsWith("```"))
                {
                    cleanJson = cleanJson.Substring(3);
                }
                if (cleanJson.EndsWith("```"))
                {
                    cleanJson = cleanJson.Substring(0, cleanJson.Length - 3);
                }
                cleanJson = cleanJson.Trim();

                var analysis =
                    JsonSerializer.Deserialize<AnswerAnalysis>(
                        cleanJson,
                        options
                    );

                if (analysis == null)
                {
                    throw new InvalidOperationException(
                        "AI không phân tích được phần introduction."
                    );
                }

                // =====================================================
                session.EvidenceLedger ??= new backend.Models.AI.EvidenceLedger { SessionId = session.Id };
                session.EvidenceLedger.RecordTurn(
                    1,
                    "Giới thiệu bản thân",
                    introduction,
                    "Introduction",
                    backend.Models.AI.AdaptiveActions.ProbeDeeper,
                    confirmed: null, // Candidate self-introduction claims are not yet independently verified
                    gaps: analysis.IncorrectConcepts,
                    unverifiedClaims: analysis.CorrectConcepts != null && analysis.CorrectConcepts.Count > 0
                        ? analysis.CorrectConcepts
                        : analysis.Concepts
                );

                // 4. UPDATE DISCOVERED CONCEPTS
                // =====================================================

                foreach (var concept in analysis.Concepts)
                {
                    AddUnique(
                        state.DiscoveredConcepts,
                        concept
                    );
                }

                // =====================================================
                // 5. UPDATE STRONG CONCEPTS
                // =====================================================

                foreach (var concept in analysis.CorrectConcepts ?? new List<string>())
                {
                    AddUnique(
                        state.StrongConcepts,
                        concept
                    );

                    RemoveIgnoreCase(
                        state.WeakConcepts,
                        concept
                    );

                    RemoveIgnoreCase(
                        state.UnknownConcepts,
                        concept
                    );
                }

                // =====================================================
                // 6. UPDATE WEAK CONCEPTS
                // =====================================================

                foreach (var concept in analysis.IncorrectConcepts)
                {
                    AddUnique(
                        state.WeakConcepts,
                        concept
                    );

                    RemoveIgnoreCase(
                        state.StrongConcepts,
                        concept
                    );
                }

                // =====================================================
                // 7. UPDATE UNKNOWN CONCEPTS
                // =====================================================

                foreach (var concept in analysis.MissingConcepts)
                {
                    AddUnique(
                        state.UnknownConcepts,
                        concept
                    );
                }

                // =====================================================
                // 8. UPDATE LAST ANSWER CONCEPTS
                // =====================================================

                state.LastAnswerConcepts =
                    analysis.Concepts
                        .Where(x =>
                            !string.IsNullOrWhiteSpace(x))
                        .Distinct(
                            StringComparer.OrdinalIgnoreCase)
                        .ToList();

                // Phase 2: Update Knowledge Coverage from Introduction
                _knowledgeCoverageService.UpdateCoverage(
                    state,
                    session.InterviewContext?.KnowledgeBlueprint,
                    analysis
                );

                // =====================================================
                // 9. SWITCH PHASE VIA STAGE ORCHESTRATOR
                // =====================================================

                _stageOrchestrator.ApplyTransition(session, InterviewStage.TECHNICAL_ASSESSMENT, "Introduction analysis complete");

                state.LastDecision =
                    "INTRODUCTION_COMPLETE";

                state.FollowUpCount = 0;

                state.TopicDepth =
                    analysis.Depth;

                // =====================================================
                // 10. GENERATE FIRST REAL INTERVIEW QUESTION
                // =====================================================

                var nextQuestion =
                    await _questionGenerationService
                        .GenerateAfterIntroductionAsync(
                            session,
                            analysis
                        );

                // Attach question stage metadata
                nextQuestion.Stage = InterviewStageNames.TechnicalAssessment;

                // =====================================================
                // 11. SAVE GENERATED QUESTION
                // =====================================================

                session.Questions ??=
                    new List<string>();

                session.Questions.Add(
                    nextQuestion.Question
                );

                // =====================================================
                // 12. SAVE SESSION
                // =====================================================

                _fileDb.Sessions[session.Id] =
                    session;

                _fileDb.Save();

                // =====================================================
                // 13. RETURN QUESTION
                // =====================================================

                return InterviewFlowResult.Success(
                    new
                    {
                        sessionId = session.Id,

                        nextQuestion =
                            nextQuestion.Question,

                        topic =
                            nextQuestion.Topic,

                        subtopic =
                            nextQuestion.Subtopic,

                        dimension =
                            nextQuestion.Dimension,

                        questionType =
                            nextQuestion.QuestionType,

                        difficulty =
                            nextQuestion.Difficulty,

                        isFollowUp = false,

                        isFinished = false,

                        stage = _stageOrchestrator.GetCurrentStage(session).ToString()
                    }
                );
            }
            catch (AiGatewayException aiEx)
            {
                Console.WriteLine(
                    $"[INTERVIEW] Introduction AI Gateway error ({aiEx.StatusCode}): {aiEx.Message}"
                );

                if (session != null && state != null)
                {
                    state.IntroductionCompleted = false;
                    state.IntroductionAnswer = string.Empty;
                    if (session.Answers != null && session.Answers.Count > 0 && session.Answers.Last().Question == "Giới thiệu bản thân")
                    {
                        session.Answers.RemoveAt(session.Answers.Count - 1);
                    }
                }

                return InterviewFlowResult.Error(
                    aiEx.UserFacingMessage,
                    statusCode: aiEx.StatusCode
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"[INTERVIEW] Introduction error: {ex}"
                );

                if (session != null && state != null)
                {
                    state.IntroductionCompleted = false;
                    state.IntroductionAnswer = string.Empty;
                    if (session.Answers != null && session.Answers.Count > 0 && session.Answers.Last().Question == "Giới thiệu bản thân")
                    {
                        session.Answers.RemoveAt(session.Answers.Count - 1);
                    }
                }

                return InterviewFlowResult.Error(
                    "Không thể xử lý phần giới thiệu. Vui lòng thử lại.",
                    statusCode: 500
                );
            }
            finally
            {
                sessionLock?.Dispose();
            }
        }

        private InterviewFlowResult? HandleGuestDemoCompletionIfEligible(Session session)
        {
            if (session == null || session.Answers == null || session.InterviewState == null)
            {
                return null;
            }

            bool isGuest = session.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(session.PlanSnapshot, "guest", StringComparison.OrdinalIgnoreCase);

            if (!isGuest)
            {
                return null;
            }

            int realAnswerCount = session.Answers.Count(a => !string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase));
            if (realAnswerCount >= 5)
            {
                session.InterviewState.IsReadyToFinish = true;
                _stageOrchestrator.ApplyTransition(session, InterviewStage.COMPLETED, "Đã hoàn thành 5 câu hỏi demo dành cho khách");
                session.Status = "completed";
                _fileDb.Sessions[session.Id] = session;
                _fileDb.Save();

                return InterviewFlowResult.Success(new
                {
                    sessionId = session.Id,
                    message = "Bạn đã hoàn thành 5 câu hỏi của phiên phỏng vấn demo dành cho khách. Báo cáo đánh giá năng lực chi tiết đã sẵn sàng.",
                    nextQuestion = (string?)null,
                    isFinished = true,
                    demoLimitReached = true,
                    stage = InterviewStageNames.Completed
                });
            }

            return null;
        }

        public async Task<InterviewFlowResult> RespondAsync(
            AIRespondRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return InterviewFlowResult.BadRequest(
                    "Thiếu SessionId.");
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return InterviewFlowResult.BadRequest(
                    "Câu trả lời không được để trống.");
            }

            IDisposable? sessionLock = null;
            if (_sessionLockManager != null)
            {
                sessionLock = await _sessionLockManager.AcquireLockAsync(request.SessionId);
            }

            Session? session = null;
            int initialAnswerCount = 0;
            int initialQuestionCount = 0;
            int initialStageQuestionCount = 0;
            string initialPhase = string.Empty;
            int initialStageHistoryCount = 0;
            bool initialClosingCompleted = false;
            bool initialIsReadyToFinish = false;

            void RollbackTurn()
            {
                if (session == null) return;

                if (session.Answers != null && session.Answers.Count > initialAnswerCount)
                {
                    session.Answers.RemoveRange(initialAnswerCount, session.Answers.Count - initialAnswerCount);
                }

                if (session.Questions != null && session.Questions.Count > initialQuestionCount)
                {
                    session.Questions.RemoveRange(initialQuestionCount, session.Questions.Count - initialQuestionCount);
                }

                if (session.InterviewState != null)
                {
                    session.InterviewState.CurrentStageQuestionCount = initialStageQuestionCount;
                    session.InterviewState.InterviewPhase = initialPhase;
                    session.InterviewState.ClosingCompleted = initialClosingCompleted;
                    session.InterviewState.IsReadyToFinish = initialIsReadyToFinish;

                    if (session.InterviewState.StageHistory != null && session.InterviewState.StageHistory.Count > initialStageHistoryCount)
                    {
                        session.InterviewState.StageHistory.RemoveRange(initialStageHistoryCount, session.InterviewState.StageHistory.Count - initialStageHistoryCount);
                    }
                }
            }

            try
            {
                if (!_fileDb.Sessions.TryGetValue(
                        request.SessionId,
                        out session) || session == null)
                {
                    return InterviewFlowResult.NotFound(
                        "Không tìm thấy session.");
                }

                var isCompleted = session.Status.Equals("completed", StringComparison.OrdinalIgnoreCase) ||
                                  session.InterviewState?.InterviewPhase.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) == true;
                if (isCompleted)
                {
                    return InterviewFlowResult.BadRequest("Phiên phỏng vấn đã hoàn tất, không thể tiếp tục gửi câu trả lời.");
                }

                if (session.InterviewContext == null)
                {
                    return InterviewFlowResult.BadRequest(
                        "Session chưa có InterviewContext.");
                }

                session.InterviewState ??= new();
                session.Answers ??= new List<AnswerItem>();
                session.Questions ??= new List<string>();

                var currentStage = _stageOrchestrator.GetCurrentStage(session);
                if (currentStage == InterviewStage.SETUP || currentStage == InterviewStage.INTRODUCTION)
                {
                    return InterviewFlowResult.BadRequest(
                        "Interview chưa hoàn thành phần giới thiệu.");
                }

                if (currentStage == InterviewStage.COMPLETED)
                {
                    return InterviewFlowResult.BadRequest(
                        "Phiên phỏng vấn đã hoàn tất, không thể tiếp tục gửi câu trả lời.");
                }

                var currentQuestion = request.Question;

                if (string.IsNullOrWhiteSpace(currentQuestion))
                {
                    currentQuestion =
                        session.Questions?
                            .LastOrDefault()
                        ?? string.Empty;
                }

                if (string.IsNullOrWhiteSpace(currentQuestion))
                {
                    return InterviewFlowResult.BadRequest(
                        "Không xác định được câu hỏi hiện tại.");
                }

                bool isGuestCaller = session.UserId.StartsWith("guest", StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(session.PlanSnapshot, "guest", StringComparison.OrdinalIgnoreCase);
                if (isGuestCaller)
                {
                    int existingReal = session.Answers.Count(a => !string.Equals(a.Question, "Giới thiệu bản thân", StringComparison.OrdinalIgnoreCase));
                    if (existingReal >= 5)
                    {
                        session.InterviewState.IsReadyToFinish = true;
                        session.Status = "completed";
                        _stageOrchestrator.ApplyTransition(session, InterviewStage.COMPLETED, "Đã hoàn thành 5 câu hỏi demo dành cho khách");
                        _fileDb.Sessions[session.Id] = session;
                        _fileDb.Save();
                        return InterviewFlowResult.BadRequest("Phiên phỏng vấn demo dành cho khách đã hoàn tất 5 câu hỏi.");
                    }
                }

                var answer = request.Message.Trim();
                initialAnswerCount = session.Answers.Count;
                initialQuestionCount = session.Questions?.Count ?? 0;
                initialStageQuestionCount = session.InterviewState.CurrentStageQuestionCount;
                initialPhase = session.InterviewState.InterviewPhase;
                initialStageHistoryCount = session.InterviewState.StageHistory?.Count ?? 0;
                initialClosingCompleted = session.InterviewState.ClosingCompleted;
                initialIsReadyToFinish = session.InterviewState.IsReadyToFinish;

                // =================================================================
                // 1. BEHAVIORAL STAR STAGE EXECUTION
                // =================================================================
                if (currentStage == InterviewStage.BEHAVIORAL_STAR)
                {
                    session.InterviewState.CurrentStageQuestionCount++;

                    var answerItem = new AnswerItem
                    {
                        Question = currentQuestion,
                        Answer = answer,
                        Stage = InterviewStageNames.BehavioralStar,
                        QuestionType = "Behavioral"
                    };
                    session.Answers.Add(answerItem);

                    var behavioralEvidence = await _behavioralService.AnalyzeAnswerAsync(
                        session,
                        currentQuestion,
                        answer,
                        session.InterviewState.LastParentQuestionId
                    );
                    answerItem.BehavioralEvidence = behavioralEvidence;

                    var guestDemoCheck1 = HandleGuestDemoCompletionIfEligible(session);
                    if (guestDemoCheck1 != null) return guestDemoCheck1;

                    var transition = _stageOrchestrator.EvaluateTransition(session);
                    if (transition.HasTransitioned || session.InterviewState.IsReadyToFinish)
                    {
                        var targetStage = transition.HasTransitioned ? transition.ToStage : InterviewStage.COMPLETED;
                        _stageOrchestrator.ApplyTransition(session, targetStage, transition.Reason);

                        if (targetStage == InterviewStage.SITUATIONAL_CASE)
                        {
                            var firstSituationalQ = await _situationalService.GenerateScenarioAsync(session);
                            session.Questions ??= new List<string>();
                            session.Questions.Add(firstSituationalQ.Question);

                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();

                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                nextQuestion = firstSituationalQ.Question,
                                questionId = firstSituationalQ.QuestionId,
                                parentQuestionId = firstSituationalQ.ParentQuestionId,
                                message = transition.TransitionMessage,
                                topic = "Situational",
                                dimension = "SITUATIONAL",
                                questionType = firstSituationalQ.QuestionType,
                                stage = InterviewStageNames.SituationalCase,
                                isFinished = false
                            });
                        }

                        if (targetStage == InterviewStage.COMPLETED || transition.IsFinished)
                        {
                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();
                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                message = "Phần phỏng vấn hành vi đã hoàn thành.",
                                nextQuestion = (string?)null,
                                isFinished = true,
                                stage = InterviewStageNames.Completed
                            });
                        }
                    }

                    // Behavioral continues (follow-up or new competency)
                    var nextBehavioralQ = await _behavioralService.GenerateQuestionAsync(session, behavioralEvidence);
                    session.Questions ??= new List<string>();
                    session.Questions.Add(nextBehavioralQ.Question);

                    _fileDb.Sessions[session.Id] = session;
                    _fileDb.Save();

                    return InterviewFlowResult.Success(new
                    {
                        sessionId = session.Id,
                        nextQuestion = nextBehavioralQ.Question,
                        questionId = nextBehavioralQ.QuestionId,
                        parentQuestionId = nextBehavioralQ.ParentQuestionId,
                        topic = "Behavioral",
                        subtopic = nextBehavioralQ.Subtopic,
                        dimension = "BEHAVIORAL",
                        questionType = nextBehavioralQ.QuestionType,
                        isFollowUp = nextBehavioralQ.IsFollowUp,
                        isFinished = false,
                        stage = InterviewStageNames.BehavioralStar
                    });
                }

                // =================================================================
                // 2. SITUATIONAL CASE STAGE EXECUTION
                // =================================================================
                if (currentStage == InterviewStage.SITUATIONAL_CASE)
                {
                    session.InterviewState.CurrentStageQuestionCount++;

                    var answerItem = new AnswerItem
                    {
                        Question = currentQuestion,
                        Answer = answer,
                        Stage = InterviewStageNames.SituationalCase,
                        QuestionType = "Situational"
                    };
                    session.Answers.Add(answerItem);

                    var situationalEvidence = await _situationalService.AnalyzeAnswerAsync(
                        session,
                        currentQuestion,
                        answer,
                        session.InterviewState.LastParentQuestionId
                    );
                    answerItem.SituationalEvidence = situationalEvidence;

                    var guestDemoCheck2 = HandleGuestDemoCompletionIfEligible(session);
                    if (guestDemoCheck2 != null) return guestDemoCheck2;

                    var transition = _stageOrchestrator.EvaluateTransition(session);
                    if (transition.HasTransitioned || session.InterviewState.IsReadyToFinish)
                    {
                        var targetStage = transition.HasTransitioned ? transition.ToStage : InterviewStage.COMPLETED;
                        _stageOrchestrator.ApplyTransition(session, targetStage, transition.Reason);

                        if (targetStage == InterviewStage.CANDIDATE_QUESTIONS)
                        {
                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();

                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                message = transition.TransitionMessage,
                                nextQuestion = (string?)null,
                                topic = "CandidateQuestions",
                                stage = InterviewStageNames.CandidateQuestions,
                                isFinished = false
                            });
                        }

                        if (targetStage == InterviewStage.COMPLETED || transition.IsFinished)
                        {
                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();
                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                message = "Phần phỏng vấn tình huống đã hoàn thành.",
                                nextQuestion = (string?)null,
                                isFinished = true,
                                stage = InterviewStageNames.Completed
                            });
                        }
                    }

                    // Situational continues
                    var nextSituationalQ = await _situationalService.GenerateScenarioAsync(session, situationalEvidence);
                    session.Questions ??= new List<string>();
                    session.Questions.Add(nextSituationalQ.Question);

                    _fileDb.Sessions[session.Id] = session;
                    _fileDb.Save();

                    return InterviewFlowResult.Success(new
                    {
                        sessionId = session.Id,
                        nextQuestion = nextSituationalQ.Question,
                        questionId = nextSituationalQ.QuestionId,
                        parentQuestionId = nextSituationalQ.ParentQuestionId,
                        topic = "Situational",
                        subtopic = nextSituationalQ.Subtopic,
                        dimension = "SITUATIONAL",
                        questionType = nextSituationalQ.QuestionType,
                        isFollowUp = nextSituationalQ.IsFollowUp,
                        isFinished = false,
                        stage = InterviewStageNames.SituationalCase
                    });
                }

                // =================================================================
                // 3. CANDIDATE QUESTIONS STAGE EXECUTION
                // =================================================================
                if (currentStage == InterviewStage.CANDIDATE_QUESTIONS)
                {
                    session.InterviewState.CurrentStageQuestionCount++;

                    var answerItem = new AnswerItem
                    {
                        Question = currentQuestion,
                        Answer = answer,
                        Stage = InterviewStageNames.CandidateQuestions,
                        QuestionType = "CandidateQuestion"
                    };
                    session.Answers.Add(answerItem);

                    var answerResult = await _candidateQuestionService.ProcessCandidateQuestionAsync(session, answer);
                    answerItem.CandidateQuestionEvidence = answerResult.Evidence;
                    answerItem.InterviewerAnswer = answerResult.Answer;
                    session.InterviewState.LastCandidateQuestion = answer;
                    session.InterviewState.LastInterviewerAnswer = answerResult.Answer;

                    var guestDemoCheck3 = HandleGuestDemoCompletionIfEligible(session);
                    if (guestDemoCheck3 != null) return guestDemoCheck3;

                    var transition = _stageOrchestrator.EvaluateTransition(session);
                    if (transition.HasTransitioned || session.InterviewState.IsReadyToFinish)
                    {
                        var targetStage = transition.HasTransitioned ? transition.ToStage : InterviewStage.CLOSING;
                        _stageOrchestrator.ApplyTransition(session, targetStage, transition.Reason);

                        if (targetStage == InterviewStage.CLOSING)
                        {
                            var closingStatementResult = await _closingService.GenerateClosingStatementAsync(session);
                            session.InterviewState.LastClosingStatement = closingStatementResult.ClosingStatement;
                            session.Questions ??= new List<string>();
                            session.Questions.Add(closingStatementResult.ClosingStatement);

                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();

                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                message = answerResult.Answer,
                                nextQuestion = closingStatementResult.ClosingStatement,
                                topic = "Closing",
                                stage = InterviewStageNames.Closing,
                                isFinished = false
                            });
                        }

                        if (targetStage == InterviewStage.COMPLETED || transition.IsFinished)
                        {
                            _fileDb.Sessions[session.Id] = session;
                            _fileDb.Save();
                            return InterviewFlowResult.Success(new
                            {
                                sessionId = session.Id,
                                message = answerResult.Answer,
                                nextQuestion = (string?)null,
                                isFinished = true,
                                stage = InterviewStageNames.Completed
                            });
                        }
                    }

                    // Candidate questions stage continues
                    session.Questions ??= new List<string>();
                    var followUpPrompt = !string.IsNullOrWhiteSpace(answerResult.FollowUpQuestion)
                        ? $"{answerResult.Answer}\n\n{answerResult.FollowUpQuestion}"
                        : $"{answerResult.Answer}\n\nBạn còn câu hỏi nào khác muốn tìm hiểu thêm không?";

                    session.Questions.Add(followUpPrompt);
                    _fileDb.Sessions[session.Id] = session;
                    _fileDb.Save();

                    return InterviewFlowResult.Success(new
                    {
                        sessionId = session.Id,
                        message = answerResult.Answer,
                        nextQuestion = followUpPrompt,
                        topic = "CandidateQuestions",
                        stage = InterviewStageNames.CandidateQuestions,
                        isFinished = false
                    });
                }

                // =================================================================
                // 4. CLOSING STAGE EXECUTION
                // =================================================================
                if (currentStage == InterviewStage.CLOSING)
                {
                    session.InterviewState.CurrentStageQuestionCount++;

                    var closingAnswerItem = new AnswerItem
                    {
                        Question = currentQuestion,
                        Answer = answer,
                        Stage = InterviewStageNames.Closing,
                        QuestionType = "Closing"
                    };
                    session.Answers.Add(closingAnswerItem);

                    var closingEvidence = await _closingService.AnalyzeClosingResponseAsync(session, answer);
                    closingAnswerItem.ClosingEvidence = closingEvidence;
                    session.InterviewState.ClosingCompleted = true;

                    // Transition to COMPLETED
                    _stageOrchestrator.ApplyTransition(session, InterviewStage.COMPLETED, "Closing completed by candidate acknowledgment");

                    _fileDb.Sessions[session.Id] = session;
                    _fileDb.Save();

                    return InterviewFlowResult.Success(new
                    {
                        sessionId = session.Id,
                        message = "Buổi phỏng vấn đã hoàn tất thành công. Báo cáo đánh giá năng lực chi tiết đã sẵn sàng.",
                        nextQuestion = (string?)null,
                        isFinished = true,
                        stage = InterviewStageNames.Completed
                    });
                }

                // =================================================================
                // 5. TECHNICAL ASSESSMENT STAGE EXECUTION
                // =================================================================
                session.InterviewState.CurrentStageQuestionCount++;

                var techAnswerItem = new AnswerItem
                {
                    Question = currentQuestion,
                    Answer = answer,
                    Stage = session.InterviewState.InterviewPhase,
                    QuestionType = session.InterviewState.CurrentDimension ?? "Technical"
                };
                session.Answers.Add(techAnswerItem);

                // 2. Analyze answer + decide next action (includes Knowledge Coverage update)
                var analysis =
                    await _adaptiveInterviewEngine
                        .ProcessAnswerAsync(
                            session,
                            currentQuestion,
                            answer
                        );

                // Phase 3 Step 1: Record turn evidence metadata on answerItem for final evaluation traceability
                techAnswerItem.TargetConceptId = session.InterviewState.ActiveTargetEvaluation?.ConceptId;
                techAnswerItem.TargetConceptName = session.InterviewState.ActiveTargetEvaluation?.ConceptName;
                techAnswerItem.Depth = analysis.Depth;
                techAnswerItem.ShowsPracticalExperience = analysis.ShowsPracticalExperience;
                techAnswerItem.CorrectConcepts = analysis.CorrectConcepts != null ? new List<string>(analysis.CorrectConcepts) : new List<string>();
                techAnswerItem.IncorrectConcepts = analysis.IncorrectConcepts != null ? new List<string>(analysis.IncorrectConcepts) : new List<string>();
                techAnswerItem.VerifiedFacts = analysis.VerifiedFacts != null ? new List<string>(analysis.VerifiedFacts) : new List<string>();
                techAnswerItem.UnverifiedClaims = analysis.UnverifiedClaims != null ? new List<string>(analysis.UnverifiedClaims) : new List<string>();
                techAnswerItem.HasInconsistency = analysis.HasInconsistency;
                techAnswerItem.InconsistencyDetail = analysis.InconsistencyDetail ?? string.Empty;

                session.EvidenceLedger ??= new backend.Models.AI.EvidenceLedger { SessionId = session.Id };
                // Combine incorrect concepts and missing concepts/gaps for ledger
                var combinedGaps = new List<string>();
                if (analysis.IncorrectConcepts != null)
                {
                    foreach (var ic in analysis.IncorrectConcepts)
                    {
                        if (!string.IsNullOrWhiteSpace(ic) && !combinedGaps.Contains(ic))
                            combinedGaps.Add(ic);
                    }
                }
                if (analysis.MissingConcepts != null)
                {
                    foreach (var mc in analysis.MissingConcepts)
                    {
                        if (!string.IsNullOrWhiteSpace(mc) && !combinedGaps.Contains(mc))
                            combinedGaps.Add(mc);
                    }
                }

                session.EvidenceLedger.RecordTurn(
                    session.Answers.Count,
                    currentQuestion,
                    answer,
                    techAnswerItem.TargetConceptName ?? session.InterviewState.CurrentTopic ?? "Technical",
                    session.InterviewState.LastDecision ?? "AdaptiveFollowUp",
                    analysis.VerifiedFacts,
                    combinedGaps,
                    analysis.UnverifiedClaims,
                    analysis.HasInconsistency && !string.IsNullOrWhiteSpace(analysis.InconsistencyDetail)
                        ? new List<string> { analysis.InconsistencyDetail }
                        : null
                );

                var guestDemoCheck4 = HandleGuestDemoCompletionIfEligible(session);
                if (guestDemoCheck4 != null) return guestDemoCheck4;

                // 3. Check stage transition and interview completion via Stage Orchestrator
                var techTransition = _stageOrchestrator.EvaluateTransition(session);
                if (techTransition.HasTransitioned || session.InterviewState.IsReadyToFinish)
                {
                    var targetStage = techTransition.HasTransitioned ? techTransition.ToStage : InterviewStage.COMPLETED;
                    _stageOrchestrator.ApplyTransition(session, targetStage, techTransition.Reason);

                    if (targetStage == InterviewStage.BEHAVIORAL_STAR)
                    {
                        var firstBehavioralQ = await _behavioralService.GenerateQuestionAsync(session);
                        session.Questions ??= new List<string>();
                        session.Questions.Add(firstBehavioralQ.Question);

                        _fileDb.Sessions[session.Id] = session;
                        _fileDb.Save();

                        return InterviewFlowResult.Success(new
                        {
                            sessionId = session.Id,
                            nextQuestion = firstBehavioralQ.Question,
                            questionId = firstBehavioralQ.QuestionId,
                            parentQuestionId = firstBehavioralQ.ParentQuestionId,
                            message = techTransition.TransitionMessage,
                            topic = "Behavioral",
                            dimension = "BEHAVIORAL",
                            questionType = firstBehavioralQ.QuestionType,
                            stage = InterviewStageNames.BehavioralStar,
                            isFinished = false
                        });
                    }

                    if (targetStage == InterviewStage.COMPLETED || techTransition.IsFinished)
                    {
                        _fileDb.Sessions[session.Id] = session;
                        _fileDb.Save();

                        return InterviewFlowResult.Success(
                            new
                            {
                                sessionId = session.Id,
                                message =
                                    "Buổi phỏng vấn đã đạt giới hạn câu hỏi.",
                                nextQuestion = (string?)null,
                                isFinished = true,
                                stage = InterviewStageNames.Completed
                            }
                        );
                    }
                }

                // 4. Generate next question
                var nextQuestion =
                    await _questionGenerationService
                        .GenerateAsync(
                            session,
                            analysis
                        );

                // Attach question stage metadata
                nextQuestion.Stage = session.InterviewState.InterviewPhase;

                // 5. Update state
                session.InterviewState.CurrentTopic =
                    nextQuestion.Topic;

                session.InterviewState.CurrentSubtopic =
                    nextQuestion.Subtopic;

                session.InterviewState.CurrentDimension =
                    nextQuestion.Dimension;

                if (!string.IsNullOrWhiteSpace(
                        nextQuestion.QuestionType))
                {
                    AddUnique(
                        session.InterviewState.QuestionTypesUsed,
                        nextQuestion.QuestionType
                    );
                }

                // 6. Store generated question
                session.Questions ??= new List<string>();

                session.Questions.Add(
                    nextQuestion.Question
                );

                // 7. Save session
                _fileDb.Sessions[session.Id] = session;
                _fileDb.Save();

                // 8. Return next question
                return InterviewFlowResult.Success(
                    new
                    {
                        sessionId = session.Id,
                        nextQuestion =
                            nextQuestion.Question,
                        topic =
                            nextQuestion.Topic,
                        subtopic =
                            nextQuestion.Subtopic,
                        dimension =
                            nextQuestion.Dimension,
                        questionType =
                            nextQuestion.QuestionType,
                        difficulty =
                            nextQuestion.Difficulty,
                        isFollowUp =
                            !string.Equals(session.InterviewState.LastDecision, nameof(InterviewAction.ChangeTopic), StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(session.InterviewState.LastDecision, "INTRODUCTION_COMPLETE", StringComparison.OrdinalIgnoreCase),
                        isFinished = false,
                        stage = _stageOrchestrator.GetCurrentStage(session).ToString()
                    }
                );
            }
            catch (AiGatewayException aiEx)
            {
                Console.WriteLine(
                    $"[INTERVIEW] Respond AI Gateway error ({aiEx.StatusCode}): {aiEx.Message}"
                );

                RollbackTurn();

                return InterviewFlowResult.Error(
                    aiEx.UserFacingMessage,
                    statusCode: aiEx.StatusCode
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"[INTERVIEW] Respond error: {ex}"
                );

                RollbackTurn();

                return InterviewFlowResult.Error(
                    "Không thể xử lý câu trả lời phỏng vấn. Vui lòng thử lại.",
                    statusCode: 500
                );
            }
            finally
            {
                sessionLock?.Dispose();
            }
        }

        private static void AddUnique(
            List<string> list,
            string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return;

            if (!list.Contains(
                    value,
                    StringComparer.OrdinalIgnoreCase))
            {
                list.Add(value);
            }
        }

        private static void RemoveIgnoreCase(
    List<string> list,
    string value)
        {
            var item =
                list.FirstOrDefault(
                    x => x.Equals(
                        value,
                        StringComparison.OrdinalIgnoreCase)
                );

            if (item != null)
            {
                list.Remove(item);
            }
        }
    }


    public class InterviewFlowResult
    {
        public int StatusCode { get; init; }
        public object? Data { get; init; }
        public bool IsSuccess => StatusCode >= 200 && StatusCode < 300;

        public static InterviewFlowResult Success(
            object data)
        {
            return new InterviewFlowResult
            {
                StatusCode = 200,
                Data = data
            };
        }

        public static InterviewFlowResult BadRequest(
            string error)
        {
            return new InterviewFlowResult
            {
                StatusCode = 400,
                Data = new
                {
                    error
                }
            };
        }

        public static InterviewFlowResult NotFound(
            string error)
        {
            return new InterviewFlowResult
            {
                StatusCode = 404,
                Data = new
                {
                    error
                }
            };
        }

        public static InterviewFlowResult Error(
            string error,
            string? detail = null,
            int statusCode = 500)
        {
            return new InterviewFlowResult
            {
                StatusCode = statusCode,
                Data = string.IsNullOrEmpty(detail)
                    ? (object)new { error }
                    : new { error, detail }
            };
        }
    }
}