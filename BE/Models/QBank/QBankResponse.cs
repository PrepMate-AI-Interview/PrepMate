using System.Collections.Generic;

namespace backend.Models.QBank
{
    public class IndustryFacet
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class QBankResponse
    {
        public int TotalCount { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 6;
        public int TotalPages { get; set; } = 1;
        public List<QuestionItemDto> Questions { get; set; } = new();
        public List<QuestionSource> Sources { get; set; } = new();
        public List<IndustryFacet> IndustryFacets { get; set; } = new();
        public List<string> Companies { get; set; } = new();
    }
}
