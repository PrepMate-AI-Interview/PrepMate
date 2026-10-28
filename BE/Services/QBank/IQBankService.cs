using System.Collections.Generic;
using System.Threading.Tasks;
using backend.Models.QBank;

namespace backend.Services.QBank
{
    public interface IQBankService
    {
        Task<QBankResponse> SearchQuestionsAsync(QBankQuery query);
        Task<QuestionItemDto?> GetQuestionByIdAsync(string id);
        Task<List<QuestionSource>> GetSourcesAsync();
        Task<object> GetTaxonomyAsync();
    }
}
