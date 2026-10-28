namespace backend.Models.QBank
{
    public class QBankQuery
    {
        public string? Keyword { get; set; }
        public string? Industry { get; set; }
        public string? Company { get; set; }
        public string? Difficulty { get; set; }
        public string? Seniority { get; set; }
        public string? QuestionType { get; set; }
        public string? Language { get; set; }
        public string? Provenance { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 6;
        public string SortBy { get; set; } = "recommended";
    }
}
