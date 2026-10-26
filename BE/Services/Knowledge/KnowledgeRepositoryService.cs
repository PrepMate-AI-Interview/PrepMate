using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Knowledge
{
    public class KnowledgeRepositoryService : IKnowledgeRepository
    {
        private readonly List<KnowledgeRepositoryItem> _items = new();
        private readonly object _lock = new();

        public KnowledgeRepositoryService()
        {
            SeedCuratedItems();
        }

        public void AddItem(KnowledgeRepositoryItem item)
        {
            if (item == null) return;
            lock (_lock)
            {
                _items.Add(item);
            }
        }

        public void AddItems(IEnumerable<KnowledgeRepositoryItem> items)
        {
            if (items == null) return;
            lock (_lock)
            {
                _items.AddRange(items);
            }
        }

        public IReadOnlyList<KnowledgeRepositoryItem> GetAllItems()
        {
            lock (_lock)
            {
                return _items.Where(i => i.IsActive).ToList().AsReadOnly();
            }
        }

        public List<KnowledgeRepositoryItem> GetItemsByConcept(string conceptId)
        {
            if (string.IsNullOrWhiteSpace(conceptId)) return new List<KnowledgeRepositoryItem>();

            var normalized = conceptId.Trim().ToLowerInvariant();
            lock (_lock)
            {
                return _items
                    .Where(i => i.IsActive && MatchesConcept(i, normalized))
                    .ToList();
            }
        }

        public List<KnowledgeRepositoryItem> GetPatternsByAction(string conceptId, InterviewAction action, string? level = null)
        {
            return GetRelevantItems(conceptId, action, level);
        }

        public List<KnowledgeRepositoryItem> GetRelevantItems(
            string conceptId,
            InterviewAction? action = null,
            string? level = null,
            int limit = 3)
        {
            if (string.IsNullOrWhiteSpace(conceptId)) return new List<KnowledgeRepositoryItem>();

            var normalized = conceptId.Trim().ToLowerInvariant();
            List<KnowledgeRepositoryItem> candidates;

            lock (_lock)
            {
                candidates = _items
                    .Where(i => i.IsActive && MatchesConcept(i, normalized))
                    .ToList();
            }

            if (candidates.Count == 0) return new List<KnowledgeRepositoryItem>();

            // Score and prioritize matching items
            var scored = candidates.Select(item =>
            {
                int score = 0;

                // 1. Action alignment
                if (action.HasValue)
                {
                    if (item.AssociatedAction.HasValue && item.AssociatedAction.Value == action.Value)
                    {
                        score += 50;
                    }
                    else if (IsActionTypeComplementary(action.Value, item.Type))
                    {
                        score += 35;
                    }
                }

                // 2. Level / Difficulty alignment
                if (!string.IsNullOrWhiteSpace(level))
                {
                    var lvl = level.Trim().ToLowerInvariant();
                    if (lvl.Contains("junior") || lvl.Contains("fresher"))
                    {
                        if (item.Difficulty == RepositoryItemDifficulty.BASIC) score += 30;
                        else if (item.Difficulty == RepositoryItemDifficulty.INTERMEDIATE) score += 15;
                        else if (item.Difficulty == RepositoryItemDifficulty.ADVANCED) score -= 20;

                        if (string.Equals(item.TargetLevel, "Junior", StringComparison.OrdinalIgnoreCase)) score += 20;
                    }
                    else if (lvl.Contains("senior") || lvl.Contains("lead") || lvl.Contains("principal"))
                    {
                        if (item.Difficulty == RepositoryItemDifficulty.ADVANCED) score += 30;
                        else if (item.Difficulty == RepositoryItemDifficulty.INTERMEDIATE) score += 15;
                        else if (item.Difficulty == RepositoryItemDifficulty.BASIC) score -= 10;

                        if (string.Equals(item.TargetLevel, "Senior", StringComparison.OrdinalIgnoreCase)) score += 20;
                    }
                    else // Middle
                    {
                        if (item.Difficulty == RepositoryItemDifficulty.INTERMEDIATE) score += 30;
                        else if (item.Difficulty == RepositoryItemDifficulty.BASIC) score += 10;
                        else if (item.Difficulty == RepositoryItemDifficulty.ADVANCED) score += 10;

                        if (string.Equals(item.TargetLevel, "Middle", StringComparison.OrdinalIgnoreCase)) score += 20;
                    }
                }

                // 3. Official / Trusted sources preferred
                if (item.SourceReliability == RequirementSource.OFFICIAL) score += 15;
                else if (item.SourceReliability == RequirementSource.TRUSTED_EXTERNAL) score += 10;
                else if (item.SourceReliability == RequirementSource.INFERRED) score += 5;

                return new { Item = item, Score = score };
            })
            .OrderByDescending(x => x.Score)
            .Select(x => x.Item)
            .Take(limit)
            .ToList();

            return scored;
        }

        private static bool MatchesConcept(KnowledgeRepositoryItem item, string normalizedConcept)
        {
            if (string.Equals(item.ConceptId, normalizedConcept, StringComparison.OrdinalIgnoreCase))
                return true;

            if (string.Equals(item.ConceptName, normalizedConcept, StringComparison.OrdinalIgnoreCase))
                return true;

            if (item.Tags != null && item.Tags.Any(t => string.Equals(t, normalizedConcept, StringComparison.OrdinalIgnoreCase)))
                return true;

            // Substring boundary matching
            if (item.ConceptId.IndexOf(normalizedConcept, StringComparison.OrdinalIgnoreCase) >= 0 ||
                normalizedConcept.IndexOf(item.ConceptId, StringComparison.OrdinalIgnoreCase) >= 0)
                return true;

            return false;
        }

        private static bool IsActionTypeComplementary(InterviewAction action, RepositoryItemType itemType)
        {
            return action switch
            {
                InterviewAction.Verify => itemType == RepositoryItemType.MISCONCEPTION || itemType == RepositoryItemType.QUESTION_PATTERN,
                InterviewAction.DeepenTopic => itemType == RepositoryItemType.QUESTION_PATTERN || itemType == RepositoryItemType.FOLLOW_UP_PATTERN,
                InterviewAction.Application => itemType == RepositoryItemType.SCENARIO || itemType == RepositoryItemType.EXAMPLE,
                InterviewAction.Challenge => itemType == RepositoryItemType.CHALLENGE_PATTERN || itemType == RepositoryItemType.SCENARIO,
                InterviewAction.Clarify => itemType == RepositoryItemType.QUESTION_PATTERN,
                _ => false
            };
        }

        private void SeedCuratedItems()
        {
            // JAVA
            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-001",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.CONCEPT,
                Content = "Nguyên lý OOP, JVM memory model (Heap/Stack), Garbage Collection (G1, ZGC), Java Collections Framework và Concurrency.",
                Difficulty = RepositoryItemDifficulty.BASIC,
                Source = "Official Java Specification",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "backend", "oop", "jvm" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-002",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.QUESTION_PATTERN,
                AssociatedAction = InterviewAction.Verify,
                TargetLevel = "Junior",
                Content = "Hỏi ứng viên giải thích sự khác biệt cốt lõi giữa String, StringBuilder và StringBuffer; hoặc sự khác biệt giữa == và equals() đối với đối tượng.",
                Difficulty = RepositoryItemDifficulty.BASIC,
                Source = "PrepMate Curated",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "string", "memory", "junior" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-003",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.MISCONCEPTION,
                AssociatedAction = InterviewAction.Verify,
                TargetLevel = "Middle",
                Content = "Ngộ nhận phổ biến: Cho rằng ArrayList luôn nhanh hơn LinkedList trong mọi trường hợp, hoặc nhầm lẫn giữa Synchronized và Volatile khi quản lý bộ nhớ chia sẻ.",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "PrepMate Curated",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "collections", "diagnostic", "concurrency" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-004",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.QUESTION_PATTERN,
                AssociatedAction = InterviewAction.DeepenTopic,
                TargetLevel = "Middle",
                Content = "Đào sâu cơ chế hoạt động bên dưới của HashMap: cách tính hash, index bucket, giải quyết collision (LinkedList vs Red-Black Tree) và resize table.",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "PrepMate Curated",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "hashmap", "internals", "deepen" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-005",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.SCENARIO,
                AssociatedAction = InterviewAction.Application,
                TargetLevel = "Middle",
                Content = "Tình huống: Xây dựng service xử lý đồng thời 5.000 đơn hàng/giây trong đợt flash sale. Ứng viên sử dụng cấu trúc dữ liệu và cơ chế đồng bộ (ConcurrentHashMap, CompletableFuture, Virtual Threads) như thế nào để đảm bảo throughput?",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "Production Engineering Patterns",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "application", "concurrency", "flash-sale" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-java-006",
                ConceptId = "java",
                ConceptName = "Java",
                Type = RepositoryItemType.CHALLENGE_PATTERN,
                AssociatedAction = InterviewAction.Challenge,
                TargetLevel = "Senior",
                Content = "Thách thức giới hạn chịu tải: Ứng dụng Java gặp sự cố Stop-The-World GC kéo dài 800ms gây timeout các request thanh toán. Ứng viên phân tích heap dump, nhận diện memory leak và tune JVM collector (G1GC tuning vs ZGC low-latency) ra sao?",
                Difficulty = RepositoryItemDifficulty.ADVANCED,
                Source = "Senior Architecture Incidents",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "challenge", "gc-tuning", "senior", "jvm" }
            });

            // POSTGRESQL / DATABASE
            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-pg-004",
                ConceptId = "postgresql",
                ConceptName = "PostgreSQL",
                Type = RepositoryItemType.MISCONCEPTION,
                AssociatedAction = InterviewAction.Verify,
                TargetLevel = "Middle",
                Content = "Ngộ nhận phổ biến: Cho rằng thêm index cho mọi cột đều làm tăng tốc độ đọc mà không tính đến chi phí ghi và bảo trì index khi INSERT/UPDATE.",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "PostgreSQL Best Practices",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "indexing", "diagnostic", "misconception" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-pg-001",
                ConceptId = "postgresql",
                ConceptName = "PostgreSQL",
                Type = RepositoryItemType.QUESTION_PATTERN,
                AssociatedAction = InterviewAction.DeepenTopic,
                TargetLevel = "Middle",
                Content = "Đào sâu cơ chế hoạt động của B-Tree Index so với GiST / GIN trong PostgreSQL, và cách đọc hiểu kết quả EXPLAIN (ANALYZE, BUFFERS) để tối ưu hóa truy vấn.",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "PostgreSQL Official Docs",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "database", "indexing", "explain-analyze" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-pg-002",
                ConceptId = "postgresql",
                ConceptName = "PostgreSQL",
                Type = RepositoryItemType.SCENARIO,
                AssociatedAction = InterviewAction.Application,
                TargetLevel = "Middle",
                Content = "Tình huống: Bảng lịch sử giao dịch tăng lên 80 triệu bản ghi, các câu lệnh tổng hợp báo cáo hàng ngày bắt đầu gây nghẽn I/O. Ứng viên đề xuất chiến lược tối ưu: Table Partitioning (theo tháng/năm), Materialized Views, hay Read Replicas?",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "Production Architecture Patterns",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "partitioning", "application", "database" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-pg-003",
                ConceptId = "postgresql",
                ConceptName = "PostgreSQL",
                Type = RepositoryItemType.CHALLENGE_PATTERN,
                AssociatedAction = InterviewAction.Challenge,
                TargetLevel = "Senior",
                Content = "Thách thức tranh chấp tài nguyên (Deadlock / Lock Contention): Hệ thống tài chính có hàng trăm worker đồng thời trừ số dư ví người dùng. Ứng viên phân tích sự khác nhau giữa Read Committed và Serializable, giải quyết deadlock bằng SELECT FOR UPDATE hay Optimistic Locking?",
                Difficulty = RepositoryItemDifficulty.ADVANCED,
                Source = "Financial System Architecture",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "challenge", "transactions", "locks", "senior" }
            });

            // SPRING BOOT
            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-spring-001",
                ConceptId = "spring",
                ConceptName = "Spring Boot",
                Type = RepositoryItemType.QUESTION_PATTERN,
                AssociatedAction = InterviewAction.DeepenTopic,
                TargetLevel = "Middle",
                Content = "Đào sâu vòng đời của Bean trong Spring IoC container (Bean Lifecycle), cơ chế Dependency Injection và phạm vi (Scopes: Singleton, Prototype, Request, Session).",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "Spring Framework Docs",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "spring", "ioc", "beans" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-spring-002",
                ConceptId = "spring",
                ConceptName = "Spring Boot",
                Type = RepositoryItemType.CHALLENGE_PATTERN,
                AssociatedAction = InterviewAction.Challenge,
                TargetLevel = "Senior",
                Content = "Thách thức Transaction Propagation: Giải thích trường hợp @Transactional không hoạt động khi gọi nội bộ (self-invocation do Spring AOP proxy) và cách khắc phục; sự khác nhau giữa REQUIRES_NEW và NESTED.",
                Difficulty = RepositoryItemDifficulty.ADVANCED,
                Source = "Spring Architecture Review",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "spring", "aop", "transactions", "senior" }
            });

            // SYSTEM DESIGN / MICROSERVICES
            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-sys-001",
                ConceptId = "system_design",
                ConceptName = "System Design",
                Type = RepositoryItemType.QUESTION_PATTERN,
                AssociatedAction = InterviewAction.DeepenTopic,
                TargetLevel = "Middle",
                Content = "Đào sâu kiến trúc phân tán: So sánh tính nhất quán cuối cùng (Eventual Consistency) với nhất quán mạnh (Strong Consistency), và cách áp dụng Transactional Outbox Pattern.",
                Difficulty = RepositoryItemDifficulty.INTERMEDIATE,
                Source = "Distributed Systems Patterns",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "system-design", "outbox", "consistency" }
            });

            _items.Add(new KnowledgeRepositoryItem
            {
                Id = "repo-sys-002",
                ConceptId = "system_design",
                ConceptName = "System Design",
                Type = RepositoryItemType.CHALLENGE_PATTERN,
                AssociatedAction = InterviewAction.Challenge,
                TargetLevel = "Senior",
                Content = "Thách thức chịu lỗi dây chuyền (Cascading Failure): Một dịch vụ hạ tầng thanh toán downstream bị lag hoặc sập làm tắc nghẽn toàn bộ connection pool của các upstream service. Thiết kế giải pháp Circuit Breaker, Rate Limiting và Fallback strategy.",
                Difficulty = RepositoryItemDifficulty.ADVANCED,
                Source = "High-scale Reliability Engineering",
                SourceReliability = RequirementSource.OFFICIAL,
                Tags = new List<string> { "resilience", "circuit-breaker", "senior", "system-design" }
            });
        }
    }
}
