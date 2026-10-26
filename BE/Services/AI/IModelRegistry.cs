using System.Collections.Generic;
using backend.Models;

namespace backend.Services.AI
{
    public interface IModelRegistry
    {
        IEnumerable<ModelRegistration> GetAllModels();

        ModelRegistration? GetModel(string id);

        IEnumerable<ModelRegistration> GetModelsByProvider(string providerId);

        IEnumerable<ModelRegistration> GetModelsByTask(string taskType);

        ModelRegistration CreateModel(CreateModelRegistrationRequest request);

        ModelRegistration UpdateModel(string id, UpdateModelRegistrationRequest request);

        bool DeleteModel(string id, out string? errorMessage);

        void RecordVerificationResult(string modelId, bool isHealthy, string message);

        ModelRegistrationDto ToDto(ModelRegistration model);
    }
}
