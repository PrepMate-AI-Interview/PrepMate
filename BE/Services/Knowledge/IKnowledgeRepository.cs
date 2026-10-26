using System.Collections.Generic;
using backend.Models;

namespace backend.Services.Knowledge
{
    public interface IKnowledgeRepository
    {
        void AddItem(KnowledgeRepositoryItem item);
        void AddItems(IEnumerable<KnowledgeRepositoryItem> items);
        IReadOnlyList<KnowledgeRepositoryItem> GetAllItems();
        List<KnowledgeRepositoryItem> GetItemsByConcept(string conceptId);
        List<KnowledgeRepositoryItem> GetPatternsByAction(string conceptId, InterviewAction action, string? level = null);
        List<KnowledgeRepositoryItem> GetRelevantItems(string conceptId, InterviewAction? action = null, string? level = null, int limit = 3);
    }
}
