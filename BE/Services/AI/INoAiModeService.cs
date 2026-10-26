using System.Collections.Generic;
using backend.Models;

namespace backend.Services.AI
{
    public interface INoAiModeService
    {
        bool IsNoAiActive();

        string GetNoAiNotice();

        string GetCuratedQuestion(string industry, string difficulty, int index);

        AnswerAnalysis AnalyzeAnswerRuleBased(string question, string answer, string targetCompetency);

        string GenerateQuestionRuleBased(string targetPosition, string lastAnswer, int questionIndex);
    }
}
