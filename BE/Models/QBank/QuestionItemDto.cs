using System;
using System.Collections.Generic;

namespace backend.Models.QBank
{
    public class QuestionItemDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string QuestionText { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string SourceId { get; set; } = string.Empty;
        public string? SourceUrl { get; set; }
        public string? SourceAttribution { get; set; }
        public string Provenance { get; set; } = "PrepMateCurated"; // OfficialPublic, PrepMateCurated, LicensedPartner
        public string Industry { get; set; } = "it"; // it, marketing, design, sales, languages, finance, hr, operations
        public string IndustryLabel { get; set; } = "Công nghệ";
        public string Role { get; set; } = string.Empty;
        public string Seniority { get; set; } = "Mid"; // Fresher, Mid, Senior, Lead
        public List<string> Skills { get; set; } = new();
        public string Type { get; set; } = "technical"; // technical, star, case, system
        public string TypeLabel { get; set; } = "Kỹ thuật";
        public string Difficulty { get; set; } = "medium"; // easy, medium, hard
        public string DifficultyLabel { get; set; } = "Trung cấp";
        public string Lang { get; set; } = "vi"; // vi, en, ja
        public string LangLabel { get; set; } = "Tiếng Việt";
        public string LangFlag { get; set; } = "🇻🇳";
        public string Duration { get; set; } = "6-8 phút";
        public string Context { get; set; } = string.Empty;
        public string Followup { get; set; } = string.Empty;
        public StarResponseModel Star { get; set; } = new();
        public List<string> Keywords { get; set; } = new();
        public string TopicParam { get; set; } = string.Empty;
        public List<string> ExpectedCompetencies { get; set; } = new();
        public string? RubricGuidance { get; set; }
        public bool Published { get; set; } = true;
    }
}
